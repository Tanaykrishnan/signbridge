import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const executable = path.join(root, '.local-ai/runtime/llama-server.exe');
const model = path.join(root, '.local-ai/qwen2.5-1.5b-instruct-q4_k_m.gguf');
if (!existsSync(executable) || !existsSync(model)) {
  console.error('Local model is not installed. Run pnpm ai:setup first.');
  process.exit(1);
}
const keyFile = path.join(root, '.local-ai/server.key');
if (!existsSync(keyFile)) writeFileSync(keyFile, randomBytes(32).toString('hex'), { mode: 0o600 });
const key = readFileSync(keyFile, 'utf8').trim();
const child = spawn(
  executable,
  [
    '-m',
    model,
    '--host',
    '127.0.0.1',
    '--port',
    '8081',
    '--api-key',
    key,
    '--alias',
    'signbridge-qwen2.5-1.5b',
    '-c',
    '8192',
    '-np',
    '1',
    '-t',
    String(Math.max(2, Math.min(8, os.availableParallelism() - 2))),
    '--no-ui',
  ],
  { cwd: root, stdio: 'inherit', windowsHide: true },
);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill());
child.on('error', (error) => {
  console.error(error.message);
  process.exit(1);
});
child.on('exit', (code) => process.exit(code ?? 1));
