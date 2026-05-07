#!/usr/bin/env node
import fs from 'node:fs';
function read(path){return fs.readFileSync(path,'utf8');}
function fail(message){console.error(`PASS93 verification failed: ${message}`);process.exit(1);}
function need(condition,message){if(!condition)fail(message);}
function includes(path,needles){const text=read(path);for(const needle of needles)need(text.includes(needle),`${path} missing ${needle}`);return text;}
const main=includes('src/main/main.ts',["import { sanitizeEvidenceMarkdown } from '../shared/evidence-safety'",'MAX_MAIN_PROCESS_CAPTURE_CHARS','function mainProcessExportMarkdownSafe','sanitizeEvidenceMarkdown(normalized, \'operational-handoff\').markdown','const clean = mainProcessExportMarkdownSafe(markdown);','clipboard.writeText(clean)',"buttonLabel: 'Save Redacted Markdown'","fs.writeFileSync(result.filePath, `${clean.trim()}\\n`, 'utf8')"]);
need(!/const clean = markdownSafe\(markdown\)\.slice\(0,\s*120000\)/.test(main),'copy/save DevOps capture IPC must not use raw markdownSafe slice');
need((main.match(/mainProcessExportMarkdownSafe\(markdown\)/g)||[]).length >= 2,'copy and save DevOps capture handlers must both use mainProcessExportMarkdownSafe');
includes('src/renderer/index.html',['PASS93 copy/save actions run through a second main-process redaction boundary','PASS93 carries forward redaction safety, sanitizes URLs, titles, notes, pinned evidence bodies, and copy/save output before handoff','PASS93 keeps the same redaction gate in the privileged copy/save IPC path']);
includes('src/renderer/styles/browser.css',['PASS93 main-process export boundary','main-process redaction boundary','.capture-dialog .capture-actions::after','.bundle-dialog .capture-actions::after','.guard-dialog .capture-actions::after']);
includes('src/shared/evidence-safety.ts',['sanitizeEvidenceMarkdown','operational-handoff','scanAndRedact(normalized)']);
const pkg=JSON.parse(read('package.json'));
need(pkg.scripts['verify:pass-93-main-process-export-boundary']==='node scripts/verify-pass-93-main-process-export-boundary.mjs','package.json missing PASS93 verifier script');
need(pkg.scripts['verify:release-blockers']?.includes('verify:pass-93-main-process-export-boundary'),'release blockers missing PASS93 verifier');
console.log('PASS93 main-process export boundary verification passed.');
