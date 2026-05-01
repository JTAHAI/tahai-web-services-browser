#!/usr/bin/env node
import fs from 'node:fs';

const app = fs.readFileSync('src/renderer/app.ts', 'utf8');
const pkg = fs.readFileSync('package.json', 'utf8');

const required = [
  ['safety summary type exists', app.includes('type BookmarkMissionSafetySummary')],
  ['unsafe normalized urls blocked before mission launch', app.includes("if (!/^https?:\\/\\//i.test(normalized))") && app.includes('blockedCount += 1')],
  ['duplicates counted explicitly', app.includes('duplicateCount += 1')],
  ['summary notes include accepted duplicate blocked counts', app.includes('safe URL(s) accepted') && app.includes('duplicate(s) skipped') && app.includes('unsafe/invalid item(s) blocked')],
  ['evidence metadata carries safety counts', app.includes('requestedCount: String(safetySummary.requestedCount)') && app.includes('blockedCount: String(safetySummary.blockedCount)')],
  ['timeline records safety summary', app.includes('Bookmark Mission safety summary')],
  ['status reports blocked count', app.includes('evidence URL(s) · ${safetySummary.blockedCount} blocked')],
  ['pass 28 script wired', pkg.includes('verify:pass-28-bookmark-mission-safety-summary')]
];

const failed = required.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error('PASS28_BOOKMARK_MISSION_SAFETY_SUMMARY_FAILED=' + failed.join(', '));
  process.exit(1);
}
console.log('PASS28_BOOKMARK_MISSION_SAFETY_SUMMARY_OK=1');
