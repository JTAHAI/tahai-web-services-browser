import fs from 'node:fs';

const checks = [
  ['src/renderer/responsive-toolbar.ts', 'More Tools'],
  ['src/renderer/responsive-toolbar.ts', 'toolbar-overflow-items'],
  ['src/renderer/responsive-toolbar.ts', 'if (width < 1280) return 2;'],
  ['src/renderer/styles/responsive-toolbar.css', 'PASS 13 responsive toolbar cleanup'],
  ['src/renderer/styles/responsive-toolbar.css', '.toolbar-overflow-header'],
  ['src/renderer/styles/responsive-toolbar.css', '.toolbar-overflow-items'],
  ['src/main/main.ts', 'path.join(process.resourcesPath, iconFile)'],
  ['src/main/main.ts', 'return getTahaiBrowserIconPath();'],
  ['src/main/main.ts', 'app.setAppUserModelId(TAHAI_WINDOWS_APP_ID);']
];

const failures = [];
for (const [file, needle] of checks) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes(needle)) failures.push(`${file} missing ${needle}`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Pass 13 toolbar/icon verifier OK');
