import { spawnSync } from 'node:child_process';

console.log('PASS271_R7_SUPERSEDED_BY_PASS271_R8=TRUE');
const result = spawnSync(process.execPath, ['scripts/apply-pass271-r8-r7-script-repair-webview-src-hard-close.mjs'], { stdio: 'inherit', shell: false });
process.exit(result.status ?? 1);
