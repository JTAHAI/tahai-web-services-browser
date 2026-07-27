# Partner Center Final Submission Checklist — PASS261

This checklist is the human-facing Store packet review. It is intentionally fail-closed.

## 1. Installed-app evidence

- [ ] PASS260 evidence file exists at `release-candidate/store-submission/pass260-installed-recipe-quad-smoke-evidence.json`.
- [ ] `npm run gate:pass-260-installed-recipe-quad-store-smoke` passes.
- [ ] No blank panes.
- [ ] No bottom-only webview rendering.
- [ ] No orphaned webviews.
- [ ] No hidden active pane.
- [ ] Focus pane restores exactly.
- [ ] Active-pane routing works in Recipe, Split, Tri, Quad, Focus, and restored 1-Up.

## 2. Identity and package truth

- [ ] Partner Center app/package identity is reserved.
- [ ] Package identity placeholders are removed from the actual submission package.
- [ ] Package version matches `2.0.18` or the current final submission target.
- [ ] Package hash is recorded.
- [ ] Generated Store artifacts are not committed to source.

## 3. Listing copy

- [ ] Listing title is accurate.
- [ ] Short description is accurate.
- [ ] Description does not claim Store approval before approval exists.
- [ ] Description does not claim direct-download signing unless trusted signing evidence exists.
- [ ] Description accurately explains Mission Control, recipes, evidence, and local/browser-side scope.

## 4. Screenshots

- [ ] Screenshots are from the installed app, not a dev-only mock.
- [ ] Screenshots contain no secrets, tenant IDs, private customer data, private tickets, or private emails.
- [ ] Screenshots show useful panes, not blank/bottom-only panes.
- [ ] Screenshots match the package/version being submitted.

## 5. Privacy/support

- [ ] Privacy policy URL is public.
- [ ] Support URL is public.
- [ ] Website/download URL is public.
- [ ] Known issues are accurate.
- [ ] Support boundaries are truthful.

## 6. Go / no-go

- [ ] PASS261 packet JSON is filled with real values.
- [ ] `npm run gate:pass-261-store-submission-packet` passes.
- [ ] Operator explicitly approves upload.
- [ ] Store status remains `not-submitted` until upload is actually completed.
- [ ] Store approval remains `not-approved` until Microsoft approval exists.
