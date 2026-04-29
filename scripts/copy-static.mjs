import fs from 'node:fs';
import path from 'node:path';

const appRoot = process.cwd();
const repoRoot = path.resolve(appRoot, '..');
const distRoot = path.join(appRoot, 'dist');

function firstExisting(...candidates) {
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function copyResolved(source, to) {
  if (!source || !fs.existsSync(source)) return;
  const target = path.join(distRoot, to);
  fs.cpSync(source, target, { recursive: true, force: true });
}

const copies = [
  [path.join(appRoot, 'src/renderer/index.html'), 'renderer/index.html'],
  [path.join(appRoot, 'src/renderer/styles'), 'renderer/styles'],
  [firstExisting(path.join(appRoot, 'browser'), path.join(repoRoot, 'browser')), 'browser'],
  [firstExisting(path.join(appRoot, 'assets'), path.join(repoRoot, 'assets')), 'assets'],
  [firstExisting(path.join(appRoot, 'build'), path.join(repoRoot, 'build')), 'build'],
  [firstExisting(path.join(appRoot, 'branding/icons'), path.join(repoRoot, 'branding/icons')), 'branding/icons']
];

for (const [from, to] of copies) copyResolved(from, to);
