import fs from 'node:fs';
import path from 'node:path';

const appRoot = process.cwd();
const repoRoot = path.resolve(appRoot, '..');
const distRoot = path.join(appRoot, 'dist');

const copies = [
  ['src/renderer/index.html', 'renderer/index.html'],
  ['src/renderer/styles', 'renderer/styles'],
  [path.join(repoRoot, 'browser'), 'browser'],
  [path.join(repoRoot, 'branding/icons'), 'branding/icons']
];

for (const [from, to] of copies) {
  const source = path.isAbsolute(from) ? from : path.join(appRoot, from);
  const target = path.join(distRoot, to);
  if (!fs.existsSync(source)) continue;
  fs.cpSync(source, target, { recursive: true, force: true });
}
