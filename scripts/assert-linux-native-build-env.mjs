#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const errors = [];
const warnings = [];
const cwd = process.cwd();
const execPath = process.execPath || '';
const npmExecPath = process.env.npm_execpath || '';
const pathParts = String(process.env.PATH || '').split(path.delimiter).filter(Boolean);

const normalize = (value) => String(value || '').replaceAll('\\\\', '/');
const lower = (value) => normalize(value).toLowerCase();
const fail = (message) => errors.push(message);
const warn = (message) => warnings.push(message);

const isWindowsBinary = (value) => {
  const text = lower(value);
  return (
    text.endsWith('.exe') ||
    text.endsWith('.cmd') ||
    text.endsWith('.bat') ||
    text.endsWith('.ps1') ||
    text.includes('/appdata/') ||
    text.includes('/program files/') ||
    text.includes('/windows/')
  );
};

const isMountedWindowsPath = (value) => {
  const text = lower(value);
  return text === '/mnt' || text.startsWith('/mnt/');
};

if (process.platform !== 'linux') {
  fail(`Linux installer packaging must run under Linux, found process.platform=${process.platform}`);
}

if (isMountedWindowsPath(cwd)) {
  fail(`Linux installer packaging must run from a Linux-native folder under $HOME, not ${cwd}`);
}

if (isWindowsBinary(execPath) || isMountedWindowsPath(execPath)) {
  fail(`node must be the Linux node binary, found ${execPath}`);
}

if (npmExecPath && (isWindowsBinary(npmExecPath) || isMountedWindowsPath(npmExecPath))) {
  fail(`npm must be the Linux npm CLI, found npm_execpath=${npmExecPath}`);
}

for (const part of pathParts) {
  if (isWindowsBinary(part) || lower(part).includes('/mnt/c/windows') || lower(part).includes('/mnt/c/program files')) {
    fail(`PATH contains a Windows/interop segment after sanitization: ${part}`);
  }
}

if (!fs.existsSync(path.join(cwd, 'package.json'))) {
  fail(`package.json not found in ${cwd}`);
}
if (!fs.existsSync(path.join(cwd, 'electron-builder.yml'))) {
  fail(`electron-builder.yml not found in ${cwd}`);
}
if (!fs.existsSync(path.join(cwd, 'package-lock.json'))) {
  fail(`package-lock.json not found in ${cwd}`);
}

let osRelease = '';
try {
  osRelease = fs.readFileSync('/etc/os-release', 'utf8');
} catch {
  warn('/etc/os-release was not readable; continuing with platform-level Linux checks only');
}

if (osRelease && !/ubuntu|fedora|debian|linux/i.test(osRelease)) {
  warn('Unrecognized Linux distribution in /etc/os-release; packaging may still work if electron-builder dependencies are installed');
}

if (errors.length) {
  for (const error of errors) console.error(`TAHAI_LINUX_NATIVE_BUILD_ENV_ERROR=${error}`);
  for (const warning of warnings) console.error(`TAHAI_LINUX_NATIVE_BUILD_ENV_WARNING=${warning}`);
  process.exit(1);
}

for (const warning of warnings) console.warn(`TAHAI_LINUX_NATIVE_BUILD_ENV_WARNING=${warning}`);
console.log(`TAHAI_LINUX_NATIVE_BUILD_ENV=OK cwd=${cwd} node=${execPath}`);
