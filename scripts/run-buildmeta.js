#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const env = { ...process.env };

delete env.GOOS;
delete env.GOARCH;
delete env.CGO_ENABLED;

const result = spawnSync('go', ['run', './cmd/buildmeta', ...process.argv.slice(2)], {
  cwd: repoRoot,
  env,
  stdio: 'inherit',
});

if (typeof result.status === 'number') {
  process.exit(result.status);
}

if (result.error) {
  console.error(result.error.message);
}

process.exit(1);