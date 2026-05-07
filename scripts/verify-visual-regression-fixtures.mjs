import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const failures = [];
const checklist = read('docs/visual-regression-checklist.md');
const html = read('src/renderer/index.html');
const css = read('src/renderer/styles/browser.css');
const aboutHtml = read('browser/about/index.html');
const aboutCss = read('browser/about/styles.css');

for (const token of ['Ops Panel', 'About', 'Mission Control', 'Settings', '1440', 'ultrawide', 'DevOps menu', 'IT Tools menu']) {
  if (!checklist.includes(token)) failures.push(`visual checklist missing: ${token}`);
}
for (const token of ['id="ops-hub"', 'id="mission-dialog"', 'id="secret-boundary"', 'id="about"']) {
  if (!html.includes(token)) failures.push(`renderer fixture missing: ${token}`);
}
for (const token of ['.ops-hub-recipe-title', '.ops-hub-recipe-meta', '.recipe-chip', 'white-space:normal', 'overflow-wrap:anywhere']) {
  if (!css.includes(token)) failures.push(`CSS visual guard missing: ${token}`);
}
if (!aboutHtml.includes('./styles.css')) failures.push('About page must use external CSS, not inline styles.');
for (const token of ['.sentinel-logo-frame', 'object-fit: contain', 'overflow: hidden', 'max-height']) {
  if (!aboutCss.includes(token)) failures.push(`About logo containment missing: ${token}`);
}

if (failures.length) {
  console.error('TAHAI_BROWSER_VISUAL_REGRESSION_FIXTURES_OK=0');
  for (const failure of failures) console.error('- ' + failure);
  process.exit(1);
}
console.log('TAHAI_BROWSER_VISUAL_REGRESSION_FIXTURES_OK=1');
