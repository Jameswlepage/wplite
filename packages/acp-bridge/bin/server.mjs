#!/usr/bin/env node
import { startBridge } from '../src/bridge.mjs';

const args = process.argv.slice(2);
const opts = { port: 7842, host: '127.0.0.1', cwd: process.cwd() };

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--port') opts.port = Number(args[++i]);
  else if (arg === '--host') opts.host = args[++i];
  else if (arg === '--cwd') opts.cwd = args[++i];
  else if (arg === '--help' || arg === '-h') {
    process.stdout.write(
      'Usage: wplite-acp-bridge [--port 7842] [--host 127.0.0.1] [--cwd .]\n'
    );
    process.exit(0);
  }
}

const bridge = await startBridge(opts);

const shutdown = () => {
  bridge.close().finally(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
