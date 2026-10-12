import { spawnSync } from 'node:child_process';
import path from 'node:path';

const python = path.join(
  process.cwd(),
  '.local-isl/venv',
  process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
);
const result = spawnSync(python, ['scripts/isl/test_engine.py'], {
  stdio: 'inherit',
  windowsHide: true,
});
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
