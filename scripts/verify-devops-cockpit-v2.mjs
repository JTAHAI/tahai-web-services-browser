import { readFileSync } from 'node:fs';

const app = readFileSync('src/renderer/app.ts', 'utf8');
const css = readFileSync('src/renderer/styles/browser.css', 'utf8');
const required = [
  "id: 'aws-release-cockpit'",
  "id: 'cloudflare-change'",
  "id: 'github-actions-monitor'",
  "id: 'vercel-firebase-release'",
  "id: 'aws-cloudfront-lambda-cockpit'",
  "id: 'cloudflare-pages-dns-cockpit'",
  "id: 'github-release-cockpit'",
  "id: 'vercel-production-cockpit'",
  'pinRecipeEvidenceBlueprint',
  'recipeBlueprintMarkdown',
  "'Ctrl+Alt+W'",
  "'Ctrl+Alt+C'",
  "'Ctrl+Alt+J'",
  "'Ctrl+Alt+V'",
];
const missing = required.filter((needle) => !app.includes(needle));
if (missing.length) {
  console.error('DevOps Cockpit v2 verifier failed. Missing app markers:', missing.join(', '));
  process.exit(1);
}
for (const provider of ['provider-aws', 'provider-cloudflare', 'provider-github', 'provider-vercel']) {
  if (!css.includes(provider)) {
    console.error('DevOps Cockpit v2 verifier failed. Missing CSS provider marker:', provider);
    process.exit(1);
  }
}
if (/fetch\(['"]https?:\/\/(api\.)?(connectwise|autotask|halo|syncro)/i.test(app)) {
  console.error('DevOps Cockpit v2 verifier failed. Browser-side PSA API call pattern found.');
  process.exit(1);
}
console.log('DevOps Cockpit v2 verifier OK');
