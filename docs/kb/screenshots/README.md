# KB screenshots

Canonical source folder for sanitized user-facing KB screenshots.

Rules:

- Use only the exact PNG file names listed in `docs/kb/screenshot-manifest.json`.
- Do not include customer data, secrets, tokens, cookies, account details, private URLs, local file paths, or runtime browser profile data.
- Run `npm run kb:screenshots:ingest -- --apply` after adding screenshots.
- Missing screenshots are allowed; the in-app KB keeps awaiting-screenshot placeholders until approved PNGs are supplied.
