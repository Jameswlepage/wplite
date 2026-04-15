import { spawn } from 'node:child_process';
import { WebSocketServer } from 'ws';
import path from 'node:path';
import { handleFsRequest } from './fs-handler.mjs';

const DEFAULT_AGENT_CMD = 'npx';
const DEFAULT_AGENT_ARGS = ['-y', '@zed-industries/claude-code-acp'];

function log(...args) {
  // eslint-disable-next-line no-console
  console.log('[acp-bridge]', ...args);
}

function logErr(...args) {
  // eslint-disable-next-line no-console
  console.error('[acp-bridge]', ...args);
}

/**
 * Start the bridge: a WebSocket server that brokers ACP traffic between a
 * browser client and a single spawned ACP agent subprocess.
 *
 * Architecture: one agent process is spawned *per connected browser client*.
 * When the browser disconnects, its agent is terminated. This keeps session
 * state isolated and avoids cross-tab leakage during local dev.
 */
export async function startBridge({ port = 7842, host = '127.0.0.1', cwd = process.cwd() } = {}) {
  const resolvedCwd = path.resolve(cwd);
  const wss = new WebSocketServer({ port, host });

  log(`listening on ws://${host}:${port} (cwd=${resolvedCwd})`);

  wss.on('connection', (ws, req) => {
    const peer = req.socket.remoteAddress;
    log(`client connected from ${peer}`);
    attachAgent(ws, resolvedCwd);
  });

  wss.on('error', (error) => {
    logErr('server error:', error.message);
  });

  return {
    port,
    host,
    close() {
      return new Promise((resolve) => {
        wss.close(() => resolve());
        for (const client of wss.clients) {
          try {
            client.terminate();
          } catch {
            // best-effort
          }
        }
      });
    },
  };
}

function attachAgent(ws, cwd) {
  const agentCmd = process.env.WPLITE_ACP_AGENT_CMD || DEFAULT_AGENT_CMD;
  const agentArgs = process.env.WPLITE_ACP_AGENT_ARGS
    ? process.env.WPLITE_ACP_AGENT_ARGS.split(' ').filter(Boolean)
    : DEFAULT_AGENT_ARGS;

  log(`spawning agent: ${agentCmd} ${agentArgs.join(' ')}`);

  const agent = spawn(agentCmd, agentArgs, {
    cwd,
    env: { ...process.env, WPLITE_CWD: cwd },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let agentClosed = false;
  let wsClosed = false;

  // Buffer partial stdout lines (ACP frames are newline-delimited JSON).
  let stdoutBuffer = '';

  agent.stdout.setEncoding('utf8');
  agent.stdout.on('data', (chunk) => {
    stdoutBuffer += chunk;
    let newlineIndex;
    while ((newlineIndex = stdoutBuffer.indexOf('\n')) !== -1) {
      const raw = stdoutBuffer.slice(0, newlineIndex).trim();
      stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
      if (!raw) continue;
      routeFromAgent(raw, ws, agent, cwd);
    }
  });

  agent.stderr.setEncoding('utf8');
  agent.stderr.on('data', (chunk) => {
    // Surface agent stderr to our console for debugging, but never to the browser.
    process.stderr.write(`[agent] ${chunk}`);
  });

  agent.on('exit', (code, signal) => {
    agentClosed = true;
    log(`agent exited code=${code} signal=${signal}`);
    if (!wsClosed) {
      try {
        ws.send(
          JSON.stringify({
            jsonrpc: '2.0',
            method: '_bridge/agent_exited',
            params: { code, signal },
          })
        );
      } catch {
        // best-effort
      }
      ws.close(1011, 'agent exited');
    }
  });

  agent.on('error', (error) => {
    logErr('agent spawn error:', error.message);
    if (!wsClosed) {
      try {
        ws.send(
          JSON.stringify({
            jsonrpc: '2.0',
            method: '_bridge/agent_error',
            params: { message: error.message },
          })
        );
      } catch {
        // best-effort
      }
    }
  });

  ws.on('message', (data) => {
    if (agentClosed) return;
    const text = data.toString('utf8').trim();
    if (!text) return;

    let message;
    try {
      message = JSON.parse(text);
    } catch (error) {
      logErr('bad JSON from client:', error.message);
      return;
    }

    // Inject cwd into session/new — the browser has no filesystem concept,
    // so the bridge authoritatively provides the working directory.
    if (message?.method === 'session/new') {
      message.params = message.params || {};
      if (!message.params.cwd) {
        message.params.cwd = cwd;
      }
      if (!Array.isArray(message.params.mcpServers)) {
        message.params.mcpServers = [];
      }
    }

    agent.stdin.write(`${JSON.stringify(message)}\n`);
  });

  ws.on('close', () => {
    wsClosed = true;
    log('client disconnected');
    if (!agentClosed) {
      try {
        agent.kill('SIGTERM');
      } catch {
        // best-effort
      }
    }
  });

  ws.on('error', (error) => {
    logErr('ws error:', error.message);
  });
}

/**
 * Messages coming out of the agent either:
 *   - are notifications (method + params, no id) → forward to browser
 *   - are responses to things the browser asked → forward to browser
 *   - are requests the agent is making of the *client* (fs/*, terminal/*) →
 *     we intercept what we can handle locally (fs/*), else forward to browser.
 */
function routeFromAgent(raw, ws, agent, cwd) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch (error) {
    logErr('bad JSON from agent:', error.message, raw.slice(0, 200));
    return;
  }

  const isRequest = message.method && message.id !== undefined;

  if (isRequest && typeof message.method === 'string' && message.method.startsWith('fs/')) {
    // Handle filesystem requests locally so the browser never has to.
    handleFsRequest(message, cwd)
      .then((response) => {
        agent.stdin.write(`${JSON.stringify(response)}\n`);
      })
      .catch((error) => {
        agent.stdin.write(
          `${JSON.stringify({
            jsonrpc: '2.0',
            id: message.id,
            error: { code: -32000, message: error.message },
          })}\n`
        );
      });
    return;
  }

  // Default: pass through to the browser.
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}
