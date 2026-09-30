# Copyright 2026 TAHAI Web Services
# SPDX-License-Identifier: Apache-2.0
# Mechanical resource conversion only. Never redraw or reinterpret the mark.
[CmdletBinding()]
param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$taskTheme = Join-Path $taskRoot 'chrome\app\theme'
$taskMasterPath = Join-Path $taskTheme 'tahai\brand\royal_mark_512.png'
$taskMasterHash = 'F48D5D500850FBD09B9C9226729E3ADFC0F9B965916DE4135859AED3AFC8A702'
if ((Get-FileHash -LiteralPath $taskMasterPath -Algorithm SHA256).Hash -ne $taskMasterHash) {
    throw 'The approved Royal master changed. Review its origin before generating resources.'
}
if ($Apply) {
    $taskBuildProcesses = Get-CimInstance Win32_Process | Where-Object {
        $_.Name -match '^(ninja|clang-cl|lld-link|gn)\.exe$' -and
        ($_.CommandLine -match [regex]::Escape($taskRoot) -or
         $_.CommandLine -match 'tahai_ga_release_x64')
    }
    if ($taskBuildProcesses) { throw 'Build-consumed artwork is locked while a release build is active.' }
}
Add-Type -AssemblyName System.Drawing
$taskMaster = [Drawing.Image]::FromFile($taskMasterPath)
$taskOutputs = [ordered]@{}
function Get-RoyalPng([int]$Size, [switch]$Mono) {
    $bitmap = New-Object Drawing.Bitmap($Size, $Size, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    $stream = New-Object IO.MemoryStream
    try {
        $graphics.Clear([Drawing.Color]::Transparent)
        $graphics.CompositingMode = [Drawing.Drawing2D.CompositingMode]::SourceCopy
        $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $attributes = New-Object Drawing.Imaging.ImageAttributes
        try {
            $attributes.SetWrapMode([Drawing.Drawing2D.WrapMode]::TileFlipXY)
            # Browser monochrome slots use the unchanged master alpha, not a
            # replacement silhouette. Color variants retain the Royal gradient.
            if ($Mono) {
                $matrix = New-Object Drawing.Imaging.ColorMatrix
                $matrix.Matrix00 = 0; $matrix.Matrix11 = 0; $matrix.Matrix22 = 0
                $matrix.Matrix40 = 1; $matrix.Matrix41 = 1; $matrix.Matrix42 = 1
                $attributes.SetColorMatrix($matrix)
            }
            $graphics.DrawImage($taskMaster, [Drawing.Rectangle]::new(0, 0, $Size, $Size),
                0, 0, $taskMaster.Width, $taskMaster.Height, [Drawing.GraphicsUnit]::Pixel, $attributes)
        } finally { $attributes.Dispose() }
        $bitmap.Save($stream, [Drawing.Imaging.ImageFormat]::Png)
        return ,$stream.ToArray()
    } finally { $stream.Dispose(); $graphics.Dispose(); $bitmap.Dispose() }
}
function Use-Resource([string]$Relative, [byte[]]$Bytes) {
    $target = [IO.Path]::GetFullPath((Join-Path $taskTheme $Relative))
    if (-not $target.StartsWith($taskTheme + '\', [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Resource path escapes the theme directory.'
    }
    if ($Apply) { [IO.File]::WriteAllBytes($target, $Bytes) }
    if (-not (Test-Path -LiteralPath $target -PathType Leaf)) { throw "Missing resource: $Relative" }
    $actual = [IO.File]::ReadAllBytes($target)
    if ([Convert]::ToBase64String($actual) -cne [Convert]::ToBase64String($Bytes)) {
        throw "Resource does not match the approved master conversion: $Relative"
    }
    $taskOutputs[$Relative.Replace('\', '/')] = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
}
try {
    foreach ($size in @(16, 24, 32, 64, 128, 256)) {
        Use-Resource "tahai\product_logo_$size.png" (Get-RoyalPng $size)
    }
    Use-Resource 'tahai\product_logo_22_mono.png' (Get-RoyalPng 22 -Mono)
    Use-Resource 'tahai\product_logo_name_22.png' (Get-RoyalPng 22)
    Use-Resource 'tahai\product_logo_name_22_white.png' (Get-RoyalPng 22 -Mono)
    Use-Resource 'tahai\favicon_password_manager.png' (Get-RoyalPng 16)
    foreach ($size in @(16, 64, 128, 256)) {
        Use-Resource "tahai\linux\product_logo_$size.png" (Get-RoyalPng $size)
    }
    foreach ($scale in @(100, 200)) {
        $factor = $scale / 100
        foreach ($size in @(16, 32)) {
            $png = Get-RoyalPng ($size * $factor)
            Use-Resource "default_${scale}_percent\tahai\product_logo_$size.png" $png
            Use-Resource "default_${scale}_percent\tahai\linux\product_logo_$size.png" $png
        }
        Use-Resource "default_${scale}_percent\tahai\product_logo_name_22.png" (Get-RoyalPng (22 * $factor))
        Use-Resource "default_${scale}_percent\tahai\product_logo_name_22_white.png" (Get-RoyalPng (22 * $factor) -Mono)
        Use-Resource "default_${scale}_percent\tahai\favicon_password_manager.png" (Get-RoyalPng (16 * $factor))
    }
    Use-Resource 'tahai\win\tiles\Logo.png' (Get-RoyalPng 150)
    Use-Resource 'tahai\win\tiles\SmallLogo.png' (Get-RoyalPng 44)
    $sizes = @(16, 24, 32, 48, 64, 128, 256)
    $pngs = @($sizes | ForEach-Object { ,(Get-RoyalPng $_) })
    $stream = New-Object IO.MemoryStream
    $writer = New-Object IO.BinaryWriter($stream)
    try {
        $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$sizes.Count)
        $offset = 6 + 16 * $sizes.Count
        for ($i = 0; $i -lt $sizes.Count; $i++) {
            $dimension = if ($sizes[$i] -eq 256) { 0 } else { $sizes[$i] }
            $writer.Write([byte]$dimension); $writer.Write([byte]$dimension)
            $writer.Write([byte]0); $writer.Write([byte]0)
            $writer.Write([uint16]1); $writer.Write([uint16]32)
            $writer.Write([uint32]$pngs[$i].Length); $writer.Write([uint32]$offset)
            $offset += $pngs[$i].Length
        }
        foreach ($png in $pngs) { $writer.Write([byte[]]$png) }
        $writer.Flush()
        Use-Resource 'tahai\win\tahai.ico' $stream.ToArray()
    } finally { $writer.Dispose(); $stream.Dispose() }
    $encoded = [Convert]::ToBase64String([IO.File]::ReadAllBytes($taskMasterPath))
    $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="TAHAI Browser Royal mark"><image width="512" height="512" href="data:image/png;base64,' + $encoded + '"/></svg>' + "`n"
    foreach ($relative in @('tahai\product_logo.svg', 'tahai\product_logo_animation.svg')) {
        Use-Resource $relative ([Text.Encoding]::UTF8.GetBytes($svg))
    }
    $manifest = [ordered]@{schemaVersion = 1; master = 'tahai/brand/royal_mark_512.png'; masterSha256 = $taskMasterHash.ToLowerInvariant(); resources = $taskOutputs}
    # Compact JSON is stable across Windows PowerShell 5.1 and PowerShell 7.
    $json = ($manifest | ConvertTo-Json -Depth 5 -Compress) + "`n"
    Use-Resource 'tahai\brand\royal-resources.json' ([Text.Encoding]::UTF8.GetBytes($json))
    Write-Output "Verified $($taskOutputs.Count - 1) Royal derivatives against the approved master; no build or package created."
} finally { $taskMaster.Dispose() }
