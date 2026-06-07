param(
  [string]$EvidenceDir = ".\artifacts\pass186-installed-mouse-navigation-proof",
  [string]$InstalledExe = "$env:LOCALAPPDATA\Programs\TAHAI Web Services Browser\TAHAI Web Services Browser.exe"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$contractPath = Join-Path $repoRoot "src\shared\installed-mouse-navigation-proof-contract.ts"
if (-not (Test-Path $contractPath)) {
  throw "PASS186 contract not found: $contractPath"
}

New-Item -ItemType Directory -Force -Path $EvidenceDir | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$jsonPath = Join-Path $EvidenceDir "pass186-installed-mouse-navigation-proof-$timestamp.json"
$mdPath = Join-Path $EvidenceDir "pass186-installed-mouse-navigation-proof-$timestamp.md"

$caseIds = Select-String -Path $contractPath -Pattern "id: '([^']+)'" | ForEach-Object { $_.Matches[0].Groups[1].Value }
$prompts = Select-String -Path $contractPath -Pattern "operatorPrompt: '([^']+)'" | ForEach-Object { $_.Matches[0].Groups[1].Value }

if ($caseIds.Count -lt 12) {
  throw "PASS186 proof harness expected at least 12 installed navigation cases; found $($caseIds.Count)."
}

$installed = Test-Path $InstalledExe
$proofCases = @()
for ($i = 0; $i -lt $caseIds.Count; $i++) {
  $proofCases += [ordered]@{
    id = $caseIds[$i]
    prompt = $prompts[$i]
    result = "UNTESTED"
    observedTarget = ""
    operatorInitials = ""
    notes = ""
  }
}

$payload = [ordered]@{
  pass = "PASS186"
  title = "Installed Mouse Navigation Proof Harness"
  versionExpectation = "2.0.14"
  generatedAt = (Get-Date).ToString("o")
  installedExe = $InstalledExe
  installedExePresent = $installed
  rule = "Do not claim PASS186 installed behavior complete until every proof case is marked PASS with operator initials and any failures are fixed or explicitly carried as blockers."
  proofCases = $proofCases
}

$payload | ConvertTo-Json -Depth 8 | Set-Content -Path $jsonPath -Encoding UTF8

$lines = @()
$lines += "# PASS186 Installed Mouse Navigation Proof"
$lines += ""
$lines += "Generated: $($payload.generatedAt)"
$lines += "Installed EXE: $InstalledExe"
$lines += "Installed EXE present: $installed"
$lines += ""
$lines += "## Hard rule"
$lines += ""
$lines += $payload.rule
$lines += ""
$lines += "## Proof cases"
$lines += ""
foreach ($case in $proofCases) {
  $lines += "- [ ] $($case.id) - $($case.prompt)"
}
$lines += ""
$lines += "## Operator closeout"
$lines += ""
$lines += "- All cases PASS: ______"
$lines += "- Operator initials/date: ______"
$lines += "- Blocking defects found: ______"
$lines += "- Package/build tested: ______"
$lines | Set-Content -Path $mdPath -Encoding UTF8

Write-Host "PASS186_INSTALLED_MOUSE_NAVIGATION_PROOF_JSON=$jsonPath"
Write-Host "PASS186_INSTALLED_MOUSE_NAVIGATION_PROOF_MD=$mdPath"
if (-not $installed) {
  Write-Warning "Installed EXE was not found. Generate package/install first or pass -InstalledExe to the installed app path before using this as final proof."
}
