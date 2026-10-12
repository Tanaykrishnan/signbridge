import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createConnection } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const owned = [];
let stopping = false;
function occupied(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const finish = (answer) => {
      socket.destroy();
      resolve(answer);
    };
    socket.setTimeout(1500);
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.once('timeout', () => finish(false));
  });
}
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of owned) {
    if (child.exitCode !== null || !child.pid) continue;
    if (process.platform === 'win32') {
      // Terminate only process trees started by this launcher, never reused services.
      spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
      });
    } else child.kill('SIGTERM');
  }
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop());
const services = [
  {
    name: 'English paraphrasing',
    port: 8081,
    script: 'scripts/start-local-ai.mjs',
    files: ['.local-ai/runtime/llama-server.exe', '.local-ai/qwen2.5-1.5b-instruct-q4_k_m.gguf'],
    external:
      process.env.PARAPHRASE_MODEL_URL &&
      process.env.PARAPHRASE_MODEL_URL !== 'http://127.0.0.1:8081/v1',
  },
  {
    name: 'Experimental ISL',
    port: 8082,
    script: 'scripts/start-local-isl.mjs',
    files: [
      `.local-isl/venv/${process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'}`,
      '.local-isl/model_best_loss.pt',
    ],
    external: process.env.ISL_MODEL_URL || process.env.ISL_LOCAL_RESEARCH === '0',
  },
  {
    name: 'SignBridge web',
    port: 3000,
    script: 'node_modules/next/dist/bin/next',
    files: ['node_modules/next/dist/bin/next'],
    args: ['dev', '--hostname', '127.0.0.1'],
  },
];
for (const service of services) {
  if (stopping) break;
  if (service.external) {
    console.log(
      `${service.name}: local startup skipped (external provider or disabled research mode).`,
    );
    continue;
  }
  if (await occupied(service.port)) {
    console.log(
      `${service.name}: port ${service.port} is already occupied; leaving that process untouched. Check model status in the studio.`,
    );
    continue;
  }
  if (!service.files.every((file) => existsSync(path.join(root, file)))) {
    console.warn(
      `${service.name}: files missing. See README for setup. This feature will remain unavailable, not simulated.`,
    );
    continue;
  }
  const child = spawn(process.execPath, [service.script, ...(service.args ?? [])], {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
  });
  owned.push(child);
  console.log(`${service.name}: starting on loopback port ${service.port}.`);
  child.on('error', (error) => {
    console.error(`${service.name}: ${error.message}`);
    stop(1);
  });
  child.on('exit', (code) => {
    if (!stopping) {
      console.error(`${service.name} exited (${code}). Check its startup log.`);
      if (service.port === 3000) stop(code ?? 1);
    }
  });
}
console.log(
  'Open http://127.0.0.1:3000/studio after startup. Signing waits for the English model. Ctrl+C stops only services started here.',
);
