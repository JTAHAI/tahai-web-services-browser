import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const patchRoot = path.join(root, 'patches/pass241-modal-spacing-responsive-closeout');

function copyRel(rel) {
  const from = path.join(patchRoot, rel);
  const to = path.join(root, rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

for (const rel of [
  'package.json',
  'PASS_241_MODAL_SPACING_RESPONSIVE_CLOSEOUT_SUMMARY.md',
  'docs/pass241-modal-spacing-responsive-closeout.md',
  'scripts/verify-pass-241-modal-spacing-responsive-closeout.mjs',
  'src/renderer/styles/browser.css',
  'src/renderer/styles/mission-control.css'
]) copyRel(rel);

console.log('PASS241_APPLY=PASS');
