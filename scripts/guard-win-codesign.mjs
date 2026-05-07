const allow = process.env.TAHAI_ALLOW_ELECTRON_BUILDER_SIGNED_WINDOWS === '1';

if (process.platform === 'win32' && !allow) {
  console.error('TAHAI_WINDOWS_SIGNED_PACKAGE_BLOCKED=1');
  console.error('Portable/NSIS Windows package targets can trigger electron-builder winCodeSign symlink extraction failures on normal Windows shells.');
  console.error('Use the supported dev/test lane instead: npm run package:win:unpacked-zip');
  console.error('To intentionally test signed portable/installer lanes, use an elevated/developer-mode environment and set TAHAI_ALLOW_ELECTRON_BUILDER_SIGNED_WINDOWS=1.');
  process.exit(1);
}

console.log('TAHAI_WINDOWS_SIGNED_PACKAGE_GUARD=OK');
