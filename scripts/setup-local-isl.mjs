import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const windows = process.platform === 'win32';
const explicit = process.env.SIGNBRIDGE_PYTHON;
const python = path.join(
  process.cwd(),
  '.local-isl/venv',
  windows ? 'Scripts/python.exe' : 'bin/python',
);
function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status}`);
}
console.log(
  'Installing a LOCAL RESEARCH decoder. Model/data commercial rights and linguistic accuracy are not established. Nothing is installed in public/.',
);
try {
  if (!existsSync(python))
    run(explicit || (windows ? 'py' : 'python3'), [
      ...(!explicit && windows ? ['-3.12'] : []),
      '-m',
      'venv',
      '.local-isl/venv',
    ]);
  run(python, [
    '-m',
    'pip',
    'install',
    'torch==2.8.0',
    '--index-url',
    'https://download.pytorch.org/whl/cpu',
  ]);
  run(python, ['-m', 'pip', 'install', 'numpy==2.2.6', 'stanza==1.10.1']);
  run(python, ['scripts/setup-isl.py']);
  run(python, [
    '-c',
    "import sys;sys.path.insert(0,'scripts/isl');from assets import verify_assets;verify_assets();from engine import PROCESSORS;import stanza;stanza.download('en',model_dir='.local-isl/stanza',processors=PROCESSORS,package=None)",
  ]);
  console.log('Setup complete. Run npm run isl:start alongside npm run dev.');
} catch (error) {
  console.error(error.message);
  console.error('Use Python 3.12; set SIGNBRIDGE_PYTHON to its executable if it is not on PATH.');
  process.exitCode = 1;
}
