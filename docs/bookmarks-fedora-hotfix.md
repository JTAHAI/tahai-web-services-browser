# TAHAI Browser Bookmarks + Fedora Hotfix

Fixes two issues from the Fedora build pass:

1. `verify:chromium-bookmarks` expected the CSS token `chromium-bookmarks-bar-visible`.
2. Fedora RPM packaging requires `libcrypt.so.1`, provided by `libxcrypt-compat`.
3. Fedora Electron runtime needs `nss` for `libnss3.so`.

The AppImage already built successfully; this hotfix targets the verifier and Fedora dependency lane.
