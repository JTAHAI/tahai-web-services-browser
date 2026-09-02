# TAHAI Browser 2.0.32.0 — native Windows source handoff

Recorded September 2, 2026. This is an unsigned release checkpoint, not a GA,
signed-production, or Microsoft Store certification claim.

## Source

- Native source commit: `b9fb226e9f8d68c8d76a7ba4d338b8750e402325`.
- Export: `0030-TAHAI-snapshot-native-Windows-2.0.32-release-source.patch`.
- Scope: 648 changed source paths, including Windows native workspace rails,
  adjustable layouts, named workspaces, Local OI, Guard, Skin package
  management, policy definitions, pinned dependencies, focused regressions,
  and fail-closed release packaging checks.
- Android, iOS, the older Electron worktree, build outputs, profiles, local
  test logs, and the MSIX binary are excluded from this source delivery.

The patch preserves the exact committed source snapshot. It does not turn
historical audits or unfinished acceptance work into passing evidence.

## Package record

- File: `TAHAIWebServicesBrowser_2.0.32.0_x64_unsigned.msix`.
- Size: 254,138,904 bytes.
- SHA-256: `4A66CFE629EC9B3EC99E4D708CA17EC1316F950A20C5FFAC3147022ED1B131C3`.
- Identity: `TAHAIWebServices.TAHAIWebServicesBrowser`.
- Publisher: `CN=D75EE668-B409-45ED-87E5-E37AA5FE3868`.
- Version: `2.0.32.0`; architecture: `x64`; executable: `chrome.exe`.
- Signature status: unsigned; receipt reports `storeCertified: false`.
- Validation-record SHA-256:
  `E5AC49CF0C908D45650CB5F328A0E5D6F05BF8F9DAEDCB4693011A7B1DD01F13`.

The package and local evidence remain outside Git. A new build must generate
its own evidence and package receipt; these hashes must not be reused to
validate different binaries.

## Recorded validation

- 140 focused native test attempts passed.
- The successful browser run reported 119 actions: 117 summary-result entries
  plus two PRE setup actions omitted from the launcher summary. The receipt
  records 117 browser test attempts from that summary.
- An isolated-profile smoke inspected all ten evidence-bound surfaces and
  recorded normal browser exit. This is surface inspection, not exhaustive
  interaction or accessibility acceptance.
- Release-static checks passed. The 24 synthetic packaging-guard checks also
  passed; synthetic checks are not substitutes for real browser tests.
- MakeAppx packaging/unpacking, manifest identity/version, package hash,
  receipt, and the 491 staged payload files were cross-checked.

The accepted browser test run followed removal of a UI-automation sidecar
that interfered with COM leak checks; browser source checks were not disabled
to suppress that interference. Packaging corrections handle PRE summary
entries and compare test-source freshness against the appropriate test
executable. The native-test-only relink did not change the browser binaries.

## Acceptance boundaries

Focused tests and surface inspections do not establish full installed-package
QA, real managed-environment deployment, every workflow, or complete
DPI/keyboard/Narrator coverage. Skin package management does not claim live
appearance application. Studio, recovery, cloud sync, watchers, and mobile
completeness are not established by this handoff. Signing and Store
certification remain separate.
