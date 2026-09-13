TAHAI Web Services Browser 1.8.30 artifact hosting note

The EXE, MSI, AppImage, DEB, and RPM packages are intentionally NOT embedded in the Cloudflare Pages ZIP because every installer/package is larger than Cloudflare Pages' single-asset limit.

Keep these public URLs on the website:
/downloads/releases/1.8.30/TAHAI-Web-Services-Browser-1.8.30-x64.exe
/downloads/releases/1.8.30/TAHAI-Web-Services-Browser-1.8.30-x64.msi
/downloads/releases/1.8.30/TAHAI-Web-Services-Browser-1.8.30-x64.AppImage
/downloads/releases/1.8.30/TAHAI-Web-Services-Browser-1.8.30-x64.deb
/downloads/releases/1.8.30/TAHAI-Web-Services-Browser-1.8.30-x64.rpm

Publish the large binaries through R2/GitHub Releases/another artifact host or a Pages Function/proxy later. The visible site already contains versioned labels, sizes, SHA-256 values, and checksum files.
