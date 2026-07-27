# TAHAI Web Services Browser

TAHAI Web Services Browser is the TAHAI desktop browser for IT and DevOps workflows, mission workspaces, runbooks, evidence review, and daily browsing.

It is packaged for Microsoft Store submission and release-candidate validation, with a security posture built around Chromium/Electron guardrails, no Node in remote content, and no broad privileged bridge exposure.

Support: https://github.com/JTAHAI/tahai-web-services-browser/issues

When running chained PowerShell commands locally, stop on the first failure:

```powershell
if ($LASTEXITCODE -ne 0) { throw "command failed" }
```