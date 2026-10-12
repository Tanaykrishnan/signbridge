import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, stat, rename, writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, '.local-ai');
const revision = '91cad51170dc346986eccefdc2dd33a9da36ead9';
const model = 'qwen2.5-1.5b-instruct-q4_k_m.gguf';
const modelHash = '6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e';
const release = 'b11445';
const archive = `llama-${release}-bin-win-cpu-x64.zip`;
async function digest(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
async function download(url, name, expectedHash) {
  const target = path.join(dir, name);
  if (await stat(target).catch(() => null)) {
    if (!expectedHash || (await digest(target)) === expectedHash) return target;
    throw new Error(`Checksum mismatch in existing ${name}. Remove it and run setup again.`);
  }
  console.log(`Downloading ${name}`);
  const response = await fetch(url, { signal: AbortSignal.timeout(1800000) });
  if (!response.ok || !response.body) throw new Error(`Download failed: HTTP ${response.status}`);
  let bytes = 0;
  let last = 0;
  const progress = setInterval(() => {
    if (bytes !== last) console.log(`${name}: ${Math.round(bytes / 1048576)} MiB received`);
    last = bytes;
  }, 10000);
  const stream = Readable.fromWeb(response.body);
  stream.on('data', (chunk) => {
    bytes += chunk.length;
  });
  try {
    await pipeline(stream, createWriteStream(target + '.partial'));
    if (expectedHash && (await digest(target + '.partial')) !== expectedHash)
      throw new Error(`SHA-256 verification failed for ${name}`);
    await rename(target + '.partial', target);
  } finally {
    clearInterval(progress);
  }
  console.log(`Verified ${name}`);
  return target;
}
if (process.platform !== 'win32' || process.arch !== 'x64')
  throw new Error(
    'This portable installer targets Windows x64. See docs/genai.md for other systems.',
  );
await mkdir(dir, { recursive: true });
const metadata = await fetch(
  `https://api.github.com/repos/ggml-org/llama.cpp/releases/tags/${release}`,
).then((r) => r.json());
const asset = metadata.assets?.find((a) => a.name === archive);
if (!asset) throw new Error('The pinned official runtime release is unavailable.');
const runtimeZip = await download(
  asset.browser_download_url,
  archive,
  asset.digest?.replace('sha256:', ''),
);
const runtimeDir = path.join(dir, 'runtime');
if (!(await stat(path.join(runtimeDir, 'llama-server.exe')).catch(() => null))) {
  await mkdir(runtimeDir, { recursive: true });
  const result = spawnSync('tar.exe', ['-xf', runtimeZip, '-C', runtimeDir], {
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.status !== 0) throw new Error('Runtime extraction failed.');
}
await download(
  `https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/${revision}/${model}`,
  model,
  modelHash,
);
await writeFile(
  path.join(dir, 'provenance.json'),
  JSON.stringify(
    {
      installedAt: new Date().toISOString(),
      model: 'Qwen2.5-1.5B-Instruct',
      modelRevision: revision,
      quantization: 'Q4_K_M',
      license: 'Apache-2.0',
      modelSha256: modelHash,
      modelSource: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF',
      runtimeRelease: release,
      runtimeSource: asset.browser_download_url,
      runtimeLicense: 'MIT',
    },
    null,
    2,
  ),
);
console.log('Local model installed. Run pnpm ai:start in a separate terminal.');
