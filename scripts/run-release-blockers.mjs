#!/usr/bin/env node
import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packageJsonPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const scriptName = process.argv[2] || 'verify:release-blockers:legacy';
const scriptBody = String(pkg.scripts?.[scriptName] || '').trim();

if (!scriptBody) {
  console.error(`[release-blockers] Missing npm script "${scriptName}" in package.json.`);
  process.exit(1);
}

const commands = scriptBody
  .split('&&')
  .map((entry) => entry.trim())
  .filter(Boolean);

for (let index = 0; index < commands.length; index += 1) {
  const command = commands[index];
  const label = `[release-blockers ${index + 1}/${commands.length}]`;
  console.log(`${label} ${command}`);

  const result = childProcess.spawnSync(command, {
    cwd: root,
    shell: true,
    stdio: 'inherit',
    env: process.env,
  });

  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status);
  }

  if (result.error) {
    console.error(`${label} failed to launch: ${result.error.message}`);
    process.exit(1);
  }
}

console.log(`[release-blockers] Completed ${commands.length} commands from ${scriptName}.`);
