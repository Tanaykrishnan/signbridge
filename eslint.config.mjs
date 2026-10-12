import { defineConfig, globalIgnores } from 'eslint/config';
import next from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';
export default defineConfig([
  ...next,
  ...typescript,
  { rules: { 'react-hooks/set-state-in-effect': 'off', 'react-hooks/refs': 'off' } },
  globalIgnores([
    '.next/**',
    'node_modules/**',
    '.local-isl/**',
    '.local-ai/**',
    '.pnpm-store/**',
    '.pnpm-cache/**',
    'work/**',
    'outputs/**',
    'test-results/**',
    'playwright-report/**',
  ]),
]);
