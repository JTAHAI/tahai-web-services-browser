# Microsoft Store listing packet — TAHAI Web Services Browser 2.0.14

Submission status: **blocked** until installed smoke, Partner Center identity, package evidence, and live privacy/support links are verified.

## Short description

An enterprise DevOps and IT Admin command browser for mission workspaces, multi-pane operations, local tools, and sanitized handoff evidence.

## Description draft

TAHAI Web Services Browser is built for technical operators who live across cloud consoles, admin portals, logs, runbooks, documentation, tickets, and release evidence.

Mission Control turns tabs into operational workspaces with split view, tri-view, quad view, focus pane, runbook rail, mission timeline, local tools, and evidence/export surfaces.

The browser is local-first and designed around an open-source security posture. It does not store PSA/API/provider secrets in browser mission files. IT Docs and PSA features are browser-side references/contracts unless connected through authorized server-side services later.

## Suggested screenshots

1. Normal browser mode.
2. Mission Control Quad View.
3. Operator Command Center / Ctrl+K.
4. DevOps tools modal.
5. Runbook Rail / Evidence Pack.
6. Settings/About showing privacy, support, and version truth.

## Links to verify before submission

- Website: `https://browser.tahai.net`
- Privacy: `https://browser.tahai.net/privacy`
- Support: `https://browser.tahai.net/support`
- Source: `https://github.com/JTAHAI/tahai-web-services-browser`
- Security policy: repository `SECURITY.md`
- Known issues: repository `docs/known-issues.md`

## Store-vs-direct-download signing language

The Microsoft Store package follows the Store submission flow. Direct-download MSI, EXE, or MSIX files remain unsigned-preview unless SignPath, Azure Trusted Signing/Azure Artifact Signing, or another trusted certificate path is separately completed and verified.

## Store submission checklist

- [ ] Partner Center app name reserved.
- [ ] Final package identity and publisher values copied from Partner Center into the MSIX manifest build input outside source.
- [ ] Installed Windows smoke evidence attached.
- [ ] MSIX package built locally with no repo-stored certificate.
- [ ] `.msixupload` or Store-accepted upload artifact generated outside committed source.
- [ ] Screenshots captured with sanitized demo data only.
- [ ] Privacy/support/security links verified live.
- [ ] Release notes and known issues reviewed.
- [ ] Age/content declarations completed honestly in Partner Center.
