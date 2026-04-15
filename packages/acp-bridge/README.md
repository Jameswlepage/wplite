# @wplite/acp-bridge

Local-only bridge that lets the admin-app assistant sidebar talk to any [Agent
Client Protocol](https://agentclientprotocol.com) agent — by default
`@zed-industries/claude-code-acp`.

## What it does

1. Spawns an ACP agent as a child process (stdio JSON-RPC).
2. Accepts a WebSocket connection from the browser and forwards ACP messages
   in both directions.
3. Handles filesystem requests (`fs/read_text_file`, `fs/write_text_file`)
   locally on behalf of the browser, scoped to the project's `cwd`.

## Running standalone

```bash
node packages/acp-bridge/bin/server.mjs \
  --cwd /path/to/your/wp-install \
  --port 7842
```

Override the agent command via `WPLITE_ACP_AGENT_CMD` (default:
`npx -y @zed-industries/claude-code-acp`).

## Auth

The bridge doesn't touch credentials. `claude-code-acp` picks up
`ANTHROPIC_API_KEY` from the environment, or uses an existing `claude` CLI
login.

## Browser protocol

The WebSocket speaks raw ACP JSON-RPC (newline-free; one JSON object per
message). The browser acts as a standard ACP client: send `initialize`, then
`session/new`, then `session/prompt`, and listen for `session/update`
notifications and `session/request_permission` requests.
