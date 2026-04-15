import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

function makeError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function makeResult(id, result) {
  return { jsonrpc: '2.0', id, result };
}

/**
 * Resolve a path from the agent and refuse anything that escapes cwd.
 * Keeps the blast radius of a misbehaving agent scoped to the project.
 */
function resolveWithinCwd(cwd, target) {
  const absolute = path.isAbsolute(target) ? target : path.resolve(cwd, target);
  const normalized = path.resolve(absolute);
  const rootWithSep = cwd.endsWith(path.sep) ? cwd : `${cwd}${path.sep}`;
  if (normalized !== cwd && !normalized.startsWith(rootWithSep)) {
    throw new Error(`path ${target} is outside the project root`);
  }
  return normalized;
}

export async function handleFsRequest(message, cwd) {
  const { id, method, params = {} } = message;

  try {
    if (method === 'fs/read_text_file') {
      const target = resolveWithinCwd(cwd, params.path);
      const content = await readFile(target, 'utf8');
      let out = content;
      if (typeof params.line === 'number' || typeof params.limit === 'number') {
        const lines = content.split('\n');
        const start = Math.max(0, (params.line ?? 1) - 1);
        const end =
          typeof params.limit === 'number'
            ? Math.min(lines.length, start + params.limit)
            : lines.length;
        out = lines.slice(start, end).join('\n');
      }
      return makeResult(id, { content: out });
    }

    if (method === 'fs/write_text_file') {
      const target = resolveWithinCwd(cwd, params.path);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, params.content ?? '', 'utf8');
      return makeResult(id, null);
    }

    return makeError(id, -32601, `unsupported fs method: ${method}`);
  } catch (error) {
    return makeError(id, -32000, error.message);
  }
}
