#!/usr/bin/env node
import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function fail(message) { console.error(`[PASS194][FAIL] ${message}`); process.exit(1); }
function need(condition, message) { if (!condition) fail(message); }
function includesAll(path, tokens) {
  const text = read(path);
  for (const token of tokens) need(text.includes(token), `${path}-missing:${token}`);
  return text;
}

const pkg = JSON.parse(read('package.json'));
const boundary = includesAll('src/shared/download-boundary.ts', [
  'PASS194_DOWNLOAD_ARTIFACT_SHELF_TAG',
  "BrowserDownloadArtifactRiskLevel = 'low' | 'elevated' | 'high'",
  'artifactId: string',
  'displayLabel: string',
  'riskLevel: BrowserDownloadArtifactRiskLevel',
  'riskLabel: string',
  'checksumSha256?: string',
  'canRevealInFolder: boolean',
  'handoffRelation: string',
  'createDownloadArtifactId',
  'sanitizeDownloadArtifactId',
  'sanitizeDownloadChecksum',
  'classifyDownloadArtifactRisk',
  'downloadArtifactHandoffRelation',
  'sensitivePathHidden: true'
]);

const runtime = includesAll('src/main/runtime-security.ts', [
  "import crypto from 'node:crypto'",
  'DOWNLOAD_ARTIFACT_SHELF_LIMIT',
  'completedDownloadArtifacts',
  'checksumDownloadFile',
  'registerCompletedDownloadArtifact',
  'revealDownloadArtifact',
  'shell.showItemInFolder(artifact.filePath)',
  'createDownloadArtifactId({ filename, sourceUrl, startedAt })',
  'checksumSha256',
  'canRevealInFolder: state === \'completed\'',
  'Local path hidden from renderer'
]);
need(!/path:\s*item\.getSavePath\(\)/.test(runtime), 'download-state-must-not-expose-item-save-path');
need(!/filePath:\s*completedPath/.test(runtime), 'download-state-must-not-send-completed-path');

includesAll('src/shared/electron-security-contract.ts', [
  "'tahai-browser:reveal-download-artifact'",
  "'tahai-browser:download-state'"
]);

includesAll('src/main/main.ts', [
  "import { hardenSession, revealDownloadArtifact } from './runtime-security'",
  "assertTrustedIpcChannel('tahai-browser:reveal-download-artifact')",
  "ipcMain.handle('tahai-browser:reveal-download-artifact'",
  'assertTrustedBrowserShellIpc(event); return revealDownloadArtifact(artifactId)'
]);

includesAll('src/preload/preload.ts', [
  'DownloadArtifactRevealResult',
  "revealDownloadArtifact: (artifactId: string): Promise<DownloadArtifactRevealResult> => ipcRenderer.invoke('tahai-browser:reveal-download-artifact', artifactId)",
  "onDownloadState: (callback: (state: DownloadState) => void)"
]);

includesAll('src/renderer/global.d.ts', [
  'DownloadArtifactRevealResult',
  'revealDownloadArtifact: (artifactId: string) => Promise<DownloadArtifactRevealResult>'
]);

const html = includesAll('src/renderer/index.html', [
  'id="artifact-shelf"',
  'data-pass194-download-artifact-shelf="true"',
  'Download artifact shelf'
]);
need(!/PASS194/.test(html.replace('data-pass194-download-artifact-shelf', 'data-download-artifact-shelf')), 'visible-html-should-not-contain-pass194-copy');

includesAll('src/renderer/styles/browser.css', [
  'PASS194 download artifact shelf UX',
  '.artifact-shelf',
  '.artifact-card',
  '.artifact-checksum',
  '.artifact-relation',
  'data-risk="high"'
]);

const app = includesAll('src/renderer/app.ts', [
  'PASS194_DOWNLOAD_ARTIFACT_SHELF_TAG',
  'RendererDownloadState',
  'PASS194_DOWNLOAD_ARTIFACT_SHELF_LIMIT',
  'pass194InitializeDownloadArtifactShelf',
  'pass194RecordDownloadArtifact',
  'pass194RenderDownloadArtifactShelf',
  'pass194RevealDownloadArtifact',
  'data-download-artifact-reveal',
  'state.checksumSha256',
  'state.handoffRelation',
  'window.tahaiBrowser.revealDownloadArtifact',
  'pass194RecordDownloadArtifact(state)',
  'pass194InitializeDownloadArtifactShelf()'
]);
need((app.match(/artifactShelf\.addEventListener\('click'/g) || []).length === 1, 'artifact-shelf-click-listener-must-be-mounted-once');

includesAll('docs/pass-194-download-artifact-shelf-ux.md', [
  'PASS194',
  'artifact identifier',
  'SHA-256',
  'renderer still never receives local download paths',
  'Folder'
]);
includesAll('PASS_194_DOWNLOAD_ARTIFACT_SHELF_UX_SUMMARY.md', [
  'PASS194',
  'Artifact Shelf',
  'release-blocker'
]);

need(pkg.version === '1.8.30', 'version-must-not-change-without-explicit-approval');
need(pkg.scripts?.['verify:pass-194-download-artifact-shelf-ux'] === 'node scripts/verify-pass-194-download-artifact-shelf-ux.mjs', 'package-script-missing');
need(pkg.scripts?.['verify:release-blockers']?.includes('verify:pass-194-download-artifact-shelf-ux'), 'release-blockers-missing-pass194');
need(pkg.scripts?.['verify:release-blockers']?.indexOf('verify:pass-194-download-artifact-shelf-ux') > pkg.scripts?.['verify:release-blockers']?.indexOf('verify:pass-193-bookmarks-admin-launch-reliability'), 'pass194-must-run-after-pass193');

console.log('[PASS194][OK] Download and Artifact Shelf UX verified.');
