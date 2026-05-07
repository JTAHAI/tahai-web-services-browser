# OpsTools Pack 1

Local-first helper contracts for TAHAI Web Services Browser.

Included browser-side utilities:

- JSON formatter
- YAML cleaner
- JWT inspector with no signature-verification claim
- IPv4 CIDR summary
- curl builder

Guardrails:

- Do not collect cookies, authorization headers, browser storage, form values, local files, or clipboard values.
- Do not paste production bearer tokens, API keys, cloud keys, cookies, or private key material into generated handoffs.
- Tool output is local Markdown until the user explicitly copies or saves it.
- IT Docs sync and PSA writeback remain server-authorized contracts only.
