[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$OutDir,
    # Store packages must be built from the non-component release output. A
    # component/debug output contains DLLs such as base.dll beside chrome.exe
    # and cannot be turned into a complete Store package by selecting files.
    [string]$BuildDir,
    [Parameter(Mandatory = $true)]
    [string]$Version,
    [Parameter(Mandatory = $true)]
    [string]$ValidationEvidence
)

$ErrorActionPreference = "Stop"
$scriptDirectory = Split-Path -Parent $PSCommandPath
if ([string]::IsNullOrWhiteSpace($scriptDirectory)) {
    throw "Could not resolve the TAHAI MSIX packager directory."
}
. (Join-Path $scriptDirectory 'release_evidence.ps1')
$nativeSourceRoot = (Resolve-Path -LiteralPath (Join-Path $scriptDirectory '..\..\..\..')).Path
if ([string]::IsNullOrWhiteSpace($BuildDir)) {
    $BuildDir = Join-Path $scriptDirectory "..\..\..\..\out\tahai_release_x64"
}

function Copy-RequiredFile {
    param([string]$Name)
    $source = Join-Path $BuildDir $Name
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
        throw "Required TAHAI runtime file is missing: $source"
    }
    Copy-Item -LiteralPath $source -Destination $stage -Force
}

function Copy-RequiredDirectory {
    param([string]$Name)
    $source = Join-Path $BuildDir $Name
    if (-not (Test-Path -LiteralPath $source -PathType Container)) {
        throw "Required TAHAI runtime directory is missing: $source"
    }
    Copy-Item -LiteralPath $source -Destination $stage -Recurse -Force
}

function Copy-TahaiThirdPartyNotices {
    $notices = Join-Path $stage 'ThirdPartyNotices'
    $lists = Join-Path $notices 'GuardLists'
    $engine = Join-Path $notices 'GuardEngine'
    New-Item -ItemType Directory -Path $notices, $lists, $engine | Out-Null
    Copy-Item -LiteralPath (Join-Path $nativeSourceRoot 'LICENSE') -Destination (Join-Path $notices 'CHROMIUM-LICENSE')
    Copy-Item -LiteralPath (Join-Path $scriptDirectory 'THIRD_PARTY_SOURCES.md') -Destination $notices
    Copy-Item -LiteralPath (Join-Path $BuildDir 'gen\components\resources\about_credits.html') -Destination $notices
    Copy-Item -LiteralPath (Join-Path $nativeSourceRoot 'third_party\rust\adblock\v0_12\README.chromium') -Destination $engine
    Copy-Item -LiteralPath (Join-Path $nativeSourceRoot 'third_party\rust\chromium_crates_io\vendor\adblock-v0_12\LICENSE') -Destination $engine
    foreach ($name in @('LICENSE', 'README.chromium', 'sources.json', 'rules_manifest.json',
                        'build_rules.py', 'easylist-network.txt', 'easyprivacy-network.txt')) {
        Copy-Item -LiteralPath (Join-Path $nativeSourceRoot ('third_party\tahai_guard_lists\' + $name)) -Destination $lists
    }
    Copy-Item -LiteralPath (Join-Path $nativeSourceRoot 'third_party\tahai_guard_lists\upstream') -Destination $lists -Recurse
}

function Grant-MsixSandboxReadAccess {
    # A Store-installed package is readable by the AppContainer token used by
    # Chromium's sandbox. Mirror that ACL in the staging directory so a local
    # smoke launch exercises the same security boundary before submission.
    & icacls.exe $stage /grant '*S-1-15-2-2:(OI)(CI)(RX)' /t /c | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Could not grant the MSIX AppContainer read/execute ACL to $stage"
    }
}

function Get-TahaiChromiumVersion {
    $parts = Get-Content -LiteralPath (Join-Path $nativeSourceRoot 'chrome\VERSION') -Raw | ConvertFrom-StringData
    foreach ($name in @('MAJOR', 'MINOR', 'BUILD', 'PATCH')) {
        if ($parts[$name] -cnotmatch '^\d{1,5}$' -or [int]$parts[$name] -gt 65535) {
            throw "Invalid Chromium source version component: $name"
        }
    }
    return [version]::new([int]$parts.MAJOR, [int]$parts.MINOR, [int]$parts.BUILD, [int]$parts.PATCH)
}

function Assert-TahaiExecutableIdentity {
    param([string]$Executable)
    $versionInfo = (Get-Item -LiteralPath $Executable).VersionInfo
    if ($versionInfo.ProductName -ne "TAHAI Browser") {
        throw "TAHAI Store packaging refused: chrome.exe ProductName must be 'TAHAI Browser'; found '$($versionInfo.ProductName)'. Rebuild the release output."
    }
    $expected = Get-TahaiChromiumVersion
    $actual = [version]::new($versionInfo.FileMajorPart, $versionInfo.FileMinorPart,
                            $versionInfo.FileBuildPart, $versionInfo.FilePrivatePart)
    if ($actual -ne $expected) {
        throw "TAHAI packaging refused: compiled engine $actual differs from source $expected. Rebuild the actual Chromium engine."
    }
}

function Assert-TahaiManifestContract {
    param(
        [string]$ManifestPath,
        [string]$ExpectedVersion
    )
    [xml]$manifest = Get-Content -LiteralPath $ManifestPath
    $manifestNs = New-Object System.Xml.XmlNamespaceManager($manifest.NameTable)
    $manifestNs.AddNamespace("m", "http://schemas.microsoft.com/appx/manifest/foundation/windows10")
    $manifestNs.AddNamespace("uap", "http://schemas.microsoft.com/appx/manifest/uap/windows10")
    $identity = $manifest.SelectSingleNode("/m:Package/m:Identity", $manifestNs)
    $application = $manifest.SelectSingleNode("/m:Package/m:Applications/m:Application", $manifestNs)
    $visualElements = $manifest.SelectSingleNode("/m:Package/m:Applications/m:Application/uap:VisualElements", $manifestNs)
    if (-not $identity -or
        $identity.GetAttribute("Name") -ne "TAHAIWebServices.TAHAIWebServicesBrowser" -or
        $identity.GetAttribute("Publisher") -ne "CN=D75EE668-B409-45ED-87E5-E37AA5FE3868" -or
        $identity.GetAttribute("ProcessorArchitecture") -ne "x64" -or
        $identity.GetAttribute("Version") -ne $ExpectedVersion) {
        throw "TAHAI Store packaging refused: AppxManifest identity does not match the TAHAI release contract."
    }
    if (-not $application -or $application.GetAttribute("Id") -ne "TAHAIBrowser" -or
        $application.GetAttribute("Executable") -ne "chrome.exe" -or
        $application.GetAttribute("EntryPoint") -ne "Windows.FullTrustApplication") {
        throw "TAHAI Store packaging refused: AppxManifest application contract is invalid."
    }
    if (-not $visualElements -or
        $visualElements.GetAttribute("DisplayName") -ne "TAHAI Browser" -or
        $visualElements.GetAttribute("Square150x150Logo") -ne "Assets\Logo.png" -or
        $visualElements.GetAttribute("Square44x44Logo") -ne "Assets\SmallLogo.png") {
        throw "TAHAI Store packaging refused: AppxManifest visual identity is invalid."
    }
}

function Copy-RequiredVersionManifest {
    $runtimeManifests = @(Get-ChildItem -LiteralPath $BuildDir -Filter "*.manifest" -File |
        Where-Object { $_.Name -match '^\d+\.\d+\.\d+\.\d+\.manifest$' })
    if ($runtimeManifests.Count -ne 1) {
        throw "Expected exactly one Chromium runtime version manifest in $BuildDir; found $($runtimeManifests.Count)."
    }
    if ($runtimeManifests[0].Name -cne ((Get-TahaiChromiumVersion).ToString() + '.manifest')) {
        throw 'Chromium runtime manifest version differs from the release source.'
    }
    Copy-Item -LiteralPath $runtimeManifests[0].FullName -Destination $stage -Force
}

function Assert-ReleaseBuildIsCurrent {
    # The MSIX manifest can safely be revised during packaging, but the
    # browser-facing brand, shell, and WebUI changes below must be compiled
    # into chrome.exe before a Store package is produced. Without this guard,
    # MakeAppx would successfully create a package whose tile metadata was new
    # while its executable still displayed older product surfaces.
    $chromeExecutable = Join-Path $BuildDir "chrome.exe"
    if (-not (Test-Path -LiteralPath $chromeExecutable -PathType Leaf)) {
        throw "Required TAHAI runtime file is missing: $chromeExecutable"
    }
    $chromeBuildTime = (Get-Item -LiteralPath $chromeExecutable).LastWriteTimeUtc
    $browserTestsExecutable = Join-Path $BuildDir "browser_tests.exe"
    $nativeTestsExecutable = Join-Path $BuildDir "tahai_mission_service_tests.exe"
    foreach ($testExecutable in @($browserTestsExecutable, $nativeTestsExecutable)) {
        if (-not (Test-Path -LiteralPath $testExecutable -PathType Leaf)) {
            throw "Required TAHAI test runtime is missing: $testExecutable"
        }
    }
    $browserTestsBuildTime = (Get-Item -LiteralPath $browserTestsExecutable).LastWriteTimeUtc
    $nativeTestsBuildTime = (Get-Item -LiteralPath $nativeTestsExecutable).LastWriteTimeUtc
    $sourceRoot = (Resolve-Path -LiteralPath (Join-Path $scriptDirectory "..\..\..\..")).Path
    $releaseSources = @(
        "chrome\VERSION",
        "DEPS",
        "chrome\app\chrome_exe.rc",
        "chrome\app\tahai_strings.grd",
        "chrome\app\generated_resources.grd",
        "components\resources\BUILD.gn",
        "chrome\app\theme\tahai\BRANDING",
        "chrome\browser\shell_integration_win.cc",
        "chrome\browser\shell_integration_win.h",
        "chrome\browser\ui\BUILD.gn",
        "chrome\browser\ui\tahai\tahai_window_mode_controller.cc",
        "chrome\browser\ui\tahai\tahai_window_mode_controller.h",
        "chrome\browser\ui\tahai\tahai_workspace_rail_view.cc",
        "chrome\browser\ui\tahai\tahai_workspace_rail_view.h",
        "chrome\browser\ui\toolbar\app_menu_model.cc",
        "chrome\browser\ui\views\frame\browser_window_property_manager_win.cc",
        "chrome\browser\ui\views\frame\browser_view.cc",
        "chrome\browser\ui\views\frame\browser_view.h",
        "chrome\browser\ui\browser_commands.cc",
        "chrome\browser\ui\browser_command_controller.cc",
        "chrome\utility\services.cc",
        "chrome\utility\BUILD.gn",
        "third_party\rust\chromium_crates_io\Cargo.lock",
        "chrome\browser\ui\tabs\tab_strip_model.cc",
        "chrome\browser\ui\tabs\tab_strip_model.h",
        "chrome\browser\ui\views\frame\multi_contents_view.cc",
        "chrome\browser\ui\views\frame\multi_contents_view.h",
        "chrome\browser\ui\views\frame\multi_contents_resize_area.cc",
        "chrome\browser\ui\views\frame\multi_contents_resize_area.h",
        "chrome\browser\ui\views\frame\multi_contents_view_delegate.cc",
        "chrome\browser\ui\views\frame\multi_contents_view_delegate.h",
        "chrome\browser\sessions\session_restore.cc",
        "components\split_tabs\split_tab_visual_data.cc",
        "components\split_tabs\split_tab_visual_data.h",
        "components\sessions\core\session_service_commands.cc",
        "components\sessions\core\session_service_commands.h",
        "components\sessions\core\tab_restore_service_impl.cc",
        "chrome\browser\ui\views\frame\layout\browser_view_layout.h",
        "chrome\browser\ui\views\frame\layout\browser_view_tabbed_layout_impl.cc",
        "chrome\browser\ui\views\profiles\profile_picker_view.cc",
        "chrome\browser\ui\views\toolbar\toolbar_view.cc",
        "chrome\browser\ui\views\toolbar\toolbar_view.h",
        "chrome\app\chrome_command_ids.h",
        "chrome\common\pref_names.h",
        "chrome\browser\prefs\browser_prefs.cc",
        "chrome\browser\policy\configuration_policy_handler_list_factory.cc",
        "chrome\browser\policy\policy_prefs_browsertest.cc",
        "components\policy\resources\templates\policies.yaml",
        "chrome\browser\ui\webui\tahai\tahai_mission_service.cc",
        "chrome\browser\ui\webui\tahai\tahai_mission_service.h",
        "chrome\browser\ui\webui\tahai\tahai_ui.cc"
    )
    # The command-center surface is intentionally split into small native
    # modules (Local OI, Recall, Sentinel, packs, and mission contracts).
    # Guard every runtime module here rather than relying only on tahai_ui.cc,
    # which prevents packaging a browser whose executable predates a newly
    # added service implementation.
    foreach ($runtimeRoot in @('chrome\browser\ui\webui\tahai',
                               'chrome\browser\ui\tahai',
                               'chrome\browser\tahai_guard',
                               'chrome\services\tahai_guard',
                               'chrome\browser\tahai_skins',
                               'chrome\common\tahai_skins',
                               'chrome\services\tahai_skins',
                               'third_party\rust',
                               'components\policy\resources\templates\policy_definitions\TahaiLocalOI',
                               'components\policy\resources\templates\policy_definitions\TahaiWorkspaces',
                               'components\policy\resources\templates\policy_definitions\TahaiGuard',
                               'components\policy\resources\templates\policy_definitions\TahaiSkins')) {
        $releaseSources += @(Get-ChildItem -LiteralPath (Join-Path $sourceRoot $runtimeRoot) -Recurse -File |
            Where-Object { $_.Extension -in @('.cc', '.h', '.rs', '.gn', '.gni', '.yaml', '.toml', '.mojom', '.patch') } |
            ForEach-Object {
                $_.FullName.Substring($sourceRoot.Length).TrimStart('\\')
            })
    }
    foreach ($relativeSource in $releaseSources) {
        $source = Join-Path $sourceRoot $relativeSource
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
            throw "Required TAHAI release source is missing: $source"
        }
        $referenceBuildTime = $chromeBuildTime
        $referenceTarget = 'chrome.exe'
        if ($relativeSource -cmatch '_browsertest\.cc$') {
            $referenceBuildTime = $browserTestsBuildTime
            $referenceTarget = 'browser_tests.exe'
        } elseif ($relativeSource -cmatch '_(?:unit)?test\.cc$' -or
                  $relativeSource -cmatch '_test_main\.cc$') {
            $referenceBuildTime = $nativeTestsBuildTime
            $referenceTarget = 'tahai_mission_service_tests.exe'
        }
        if ((Get-Item -LiteralPath $source).LastWriteTimeUtc -gt $referenceBuildTime) {
            throw "TAHAI Store packaging refused: $relativeSource is newer than $referenceTarget. Rebuild the affected out\\tahai_release_x64 target before packaging."
        }
    }
    Assert-TahaiExecutableIdentity $chromeExecutable
    Assert-TahaiExecutableIdentity (Join-Path $BuildDir 'chrome.dll')
}

function Assert-TahaiPackagePayload {
    param([string]$Root)

    # MakeAppx can create and unpack a syntactically valid package even when a
    # runtime payload is incomplete. Validate the unpacked package explicitly,
    # so a Store candidate contains the same executable, data, and visual
    # assets that were assembled into the staging directory.
    foreach ($file in @(
        "chrome.exe", "chrome.dll", "chrome_elf.dll", "chrome_100_percent.pak",
        "chrome_200_percent.pak", "d3dcompiler_47.dll", "dxcompiler.dll", "dxil.dll",
        "icudtl.dat", "libEGL.dll", "libGLESv2.dll", "resources.pak",
        "v8_context_snapshot.bin", "vk_swiftshader.dll", "vk_swiftshader_icd.json",
        "vulkan-1.dll", "notification_helper.exe", "msvcp140.dll",
        "vcruntime140.dll", "vcruntime140_1.dll",
        "Assets\\Logo.png", "Assets\\SmallLogo.png", "Assets\\StoreLogo.png",
        "Assets\\WideLogo.png", "Assets\\Square71Logo.png", "Assets\\Square310Logo.png")) {
        $path = Join-Path $Root $file
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
            throw "TAHAI Store package payload is missing: $file"
        }
        if ((Get-Item -LiteralPath $path).Length -le 0) {
            throw "TAHAI Store package payload is empty: $file"
        }
    }
    foreach ($notice in @('about_credits.html', 'CHROMIUM-LICENSE', 'THIRD_PARTY_SOURCES.md',
                           'GuardEngine\LICENSE', 'GuardEngine\README.chromium',
                           'GuardLists\LICENSE', 'GuardLists\sources.json',
                           'GuardLists\easylist-network.txt', 'GuardLists\easyprivacy-network.txt')) {
        $noticeFile = Get-Item -LiteralPath (Join-Path $Root ('ThirdPartyNotices\' + $notice)) -ErrorAction Stop
        if ($noticeFile.PSIsContainer -or $noticeFile.Length -le 0) {
            throw "TAHAI package notice is missing or empty: $notice"
        }
    }
    foreach ($directory in @("locales", "resources", "MEIPreload")) {
        if (-not (Test-Path -LiteralPath (Join-Path $Root $directory) -PathType Container)) {
            throw "TAHAI Store package payload is missing required directory: $directory"
        }
    }
}

function New-TahaiTileAsset {
    param(
        [string]$Source,
        [string]$Destination,
        [int]$Width,
        [int]$Height
    )
    Add-Type -AssemblyName System.Drawing
    $input = [System.Drawing.Image]::FromFile($Source)
    try {
        $output = New-Object System.Drawing.Bitmap($Width, $Height)
        try {
            $graphics = [System.Drawing.Graphics]::FromImage($output)
            try {
                $graphics.Clear([System.Drawing.Color]::Transparent)
                $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
                $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
                $scale = [Math]::Min($Width / $input.Width, $Height / $input.Height)
                $drawWidth = [int][Math]::Round($input.Width * $scale)
                $drawHeight = [int][Math]::Round($input.Height * $scale)
                $left = [int][Math]::Floor(($Width - $drawWidth) / 2)
                $top = [int][Math]::Floor(($Height - $drawHeight) / 2)
                $graphics.DrawImage($input, $left, $top, $drawWidth, $drawHeight)
            } finally {
                $graphics.Dispose()
            }
            $output.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png)
        } finally {
            $output.Dispose()
        }
    } finally {
        $input.Dispose()
    }
}

function Get-TahaiPayloadInventory {
    param([string]$Root)
    foreach ($file in (Get-ChildItem -LiteralPath $Root -Recurse -File | Sort-Object FullName)) {
        if (($file.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Refusing a linked payload file: $($file.FullName)"
        }
        [pscustomobject]@{
            path = $file.FullName.Substring($Root.Length).TrimStart('\').Replace('\', '/')
            bytes = $file.Length
            sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
        }
    }
}

$sdkRoot = "${env:ProgramFiles(x86)}\Windows Kits\10\bin"
$makeAppx = Get-ChildItem -LiteralPath $sdkRoot -Recurse -Filter MakeAppx.exe |
    Where-Object { $_.FullName -match "\\x64\\MakeAppx\.exe$" } |
    Sort-Object FullName -Descending |
    Select-Object -First 1 -ExpandProperty FullName
if (-not $makeAppx) {
    throw "MakeAppx.exe was not found under $sdkRoot. Install the Windows SDK packaging tools."
}

$resolvedBuildDir = (Resolve-Path -LiteralPath $BuildDir).Path
$resolvedOutDir = [System.IO.Path]::GetFullPath($OutDir)
$BuildDir = $resolvedBuildDir
$stage = Join-Path $resolvedOutDir "stage"
$package = Join-Path $resolvedOutDir "TAHAIWebServicesBrowser_$Version`_x64_unsigned.msix"
if ([string]::IsNullOrWhiteSpace($OutDir) -or (Test-Path -LiteralPath $resolvedOutDir)) {
    throw 'Use a new, uniquely named output directory. Existing outputs are never overwritten or deleted.'
}

# Fail before packaging if a caller accidentally points at a development
# component build. That was the source of the Store's missing base.dll error.
$argsPath = Join-Path $resolvedBuildDir "args.gn"
if (-not (Test-Path -LiteralPath $argsPath -PathType Leaf)) {
    throw "TAHAI Store package build arguments are missing: $argsPath"
}
$buildArgs = Get-Content -LiteralPath $argsPath -Raw
if ($buildArgs -notmatch '(?m)^is_debug\s*=\s*false\s*$' -or
    $buildArgs -notmatch '(?m)^is_component_build\s*=\s*false\s*$') {
    throw "TAHAI Store packages require is_debug = false and is_component_build = false. Refusing incomplete development output: $resolvedBuildDir"
}
Assert-ReleaseBuildIsCurrent
$validation = Assert-TahaiReleaseEvidence $ValidationEvidence $resolvedBuildDir
$python = (Get-Command python.exe -ErrorAction Stop).Source
& $python (Join-Path $scriptDirectory 'verify_release_resources.py') --build-dir $resolvedBuildDir
if ($LASTEXITCODE -ne 0) { throw 'TAHAI release resource/third-party notice verification failed.' }

$versionParts = $Version -split '\.'
if ($versionParts.Count -ne 4 -or @($versionParts | Where-Object {
        $_ -notmatch '^\d+$' -or [int64]$_ -gt 65535
    }).Count -ne 0) {
    throw "Version must contain four numeric components from 0 through 65535: $Version"
}

# This command must fail if another process created the directory after our
# preflight. There is no overwrite or recursive cleanup path in this packager.
New-Item -ItemType Directory -Path $resolvedOutDir -ErrorAction Stop | Out-Null
New-Item -ItemType Directory -Path $stage -ErrorAction Stop | Out-Null
New-Item -ItemType Directory -Path (Join-Path $stage "Assets") -Force | Out-Null

foreach ($file in @(
    "chrome.exe", "chrome.dll", "chrome_elf.dll", "chrome_100_percent.pak",
    "chrome_200_percent.pak", "d3dcompiler_47.dll", "dxcompiler.dll", "dxil.dll",
    "icudtl.dat", "libEGL.dll", "libGLESv2.dll", "resources.pak",
    "v8_context_snapshot.bin", "vk_swiftshader.dll", "vk_swiftshader_icd.json",
    "vulkan-1.dll", "notification_helper.exe", "msvcp140.dll",
    "vcruntime140.dll", "vcruntime140_1.dll")) {
    Copy-RequiredFile $file
}
Copy-RequiredVersionManifest
foreach ($directory in @("locales", "resources", "MEIPreload")) {
    Copy-RequiredDirectory $directory
}
Copy-TahaiThirdPartyNotices

Copy-Item -LiteralPath (Join-Path $scriptDirectory "AppxManifest.xml") -Destination (Join-Path $stage "AppxManifest.xml") -Force
$manifestPath = Join-Path $stage "AppxManifest.xml"
[xml]$manifest = Get-Content -LiteralPath $manifestPath
$manifestNs = New-Object System.Xml.XmlNamespaceManager($manifest.NameTable)
$manifestNs.AddNamespace("m", "http://schemas.microsoft.com/appx/manifest/foundation/windows10")
$manifestIdentity = $manifest.SelectSingleNode("/m:Package/m:Identity", $manifestNs)
$manifestIdentity.SetAttribute("Version", $Version)
$manifest.Save($manifestPath)
Assert-TahaiManifestContract $manifestPath $Version
$tiles = Join-Path $scriptDirectory "..\..\..\app\theme\tahai\win\tiles"
New-TahaiTileAsset (Join-Path $tiles "Logo.png") (Join-Path $stage "Assets\Logo.png") 150 150
New-TahaiTileAsset (Join-Path $tiles "SmallLogo.png") (Join-Path $stage "Assets\SmallLogo.png") 44 44
New-TahaiTileAsset (Join-Path $tiles "Logo.png") (Join-Path $stage "Assets\StoreLogo.png") 50 50
New-TahaiTileAsset (Join-Path $tiles "Logo.png") (Join-Path $stage "Assets\WideLogo.png") 310 150
New-TahaiTileAsset (Join-Path $tiles "Logo.png") (Join-Path $stage "Assets\Square71Logo.png") 71 71
New-TahaiTileAsset (Join-Path $tiles "Logo.png") (Join-Path $stage "Assets\Square310Logo.png") 310 310

Grant-MsixSandboxReadAccess
Assert-TahaiPackagePayload $stage
$stagedPayload = @(Get-TahaiPayloadInventory $stage)

& $makeAppx pack /d $stage /p $package
if ($LASTEXITCODE -ne 0) {
    throw "MakeAppx packaging failed with exit code $LASTEXITCODE."
}
& $makeAppx unpack /p $package /d (Join-Path $resolvedOutDir "validation")
if ($LASTEXITCODE -ne 0) {
    throw "MakeAppx validation unpack failed with exit code $LASTEXITCODE."
}
$validationDir = Join-Path $resolvedOutDir "validation"
Assert-TahaiManifestContract (Join-Path $validationDir "AppxManifest.xml") $Version
Assert-TahaiExecutableIdentity (Join-Path $validationDir "chrome.exe")
Assert-TahaiPackagePayload $validationDir
$unpackedPayload = @(Get-TahaiPayloadInventory $validationDir)
foreach ($expected in $stagedPayload) {
    $actual = @($unpackedPayload | Where-Object { $_.path -ceq $expected.path })
    if ($actual.Count -ne 1 -or $actual[0].bytes -ne $expected.bytes -or
        $actual[0].sha256 -ne $expected.sha256) {
        throw "Unpacked payload differs from the staged, validated file: $($expected.path)"
    }
}
foreach ($actual in $unpackedPayload) {
    if ($stagedPayload.path -cnotcontains $actual.path -and
        $actual.path -cnotin @('AppxBlockMap.xml', '[Content_Types].xml',
                              'AppxMetadata/CodeIntegrity.cat')) {
        throw "Unexpected file in unsigned package: $($actual.path)"
    }
}
# Detect a concurrent rebuild or edited validation report before issuing any
# success receipt. Compare the actual packaged core binaries with that evidence.
$finalValidation = Assert-TahaiReleaseEvidence $ValidationEvidence $resolvedBuildDir
Assert-ReleaseBuildIsCurrent
if ($finalValidation.EvidenceSha256 -ne $validation.EvidenceSha256) {
    throw 'Release evidence changed while packaging.'
}
foreach ($name in @('chrome.exe', 'chrome.dll')) {
    $entry = @($stagedPayload | Where-Object { $_.path -ceq $name })[0]
    if ($entry.sha256 -ne (Get-FileHash -LiteralPath (Join-Path $resolvedBuildDir $name) -Algorithm SHA256).Hash) {
        throw "Packaged browser binary does not match validated output: $name"
    }
}
$packageHash = (Get-FileHash -LiteralPath $package -Algorithm SHA256).Hash
$receipt = [ordered]@{
    schemaVersion = 1
    version = $Version
    chromiumVersion = (Get-TahaiChromiumVersion).ToString()
    sourceVersionSha256 = (Get-FileHash -LiteralPath (Join-Path $nativeSourceRoot 'chrome\VERSION') -Algorithm SHA256).Hash
    sourceDepsSha256 = (Get-FileHash -LiteralPath (Join-Path $nativeSourceRoot 'DEPS') -Algorithm SHA256).Hash
    buildArgsSha256 = (Get-FileHash -LiteralPath (Join-Path $resolvedBuildDir 'args.gn') -Algorithm SHA256).Hash
    package = [IO.Path]::GetFileName($package)
    packageSha256 = $packageHash
    unsigned = $true
    storeCertified = $false
    validationEvidenceSha256 = $validation.EvidenceSha256
    nativeTestAttempts = $validation.NativeTestAttempts
    browserTestAttempts = $validation.BrowserTestAttempts
    payload = $stagedPayload
}
$receipt | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $resolvedOutDir 'release-receipt.json') -Encoding UTF8
"$packageHash  $([IO.Path]::GetFileName($package))" | Set-Content -LiteralPath "$package.sha256" -Encoding ASCII
Get-Item -LiteralPath $package | Select-Object FullName, Length, LastWriteTime
