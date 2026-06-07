# PASS329 Cursor Review Prompt - Runtime Lifecycle Geometry Sentry

Repo: `D:\dev\browser\app`

Review these first:

1. `release-candidate/generated/pass329-runtime-lifecycle-geometry-sentry-report.json`
2. `release-candidate/bug-hunt/pass329-runtime-lifecycle-geometry-sentry.md`
3. `src/renderer/pass329-viewport-lifecycle-sentry.ts`
4. PASS327/PASS328 generated reports

Primary question:

What active lifecycle owner still runs after webview attach/load/resize and can leave the shell/webview trapped as a small upper-left island with black unused space?

Do not add another viewport fixer. Use the PASS329 sentry as evidence and remove the owner.

Runtime probe:

```js
window.__TAHAI_PASS329_VIEWPORT_LIFECYCLE__.assert('manual-after-load')
window.__TAHAI_PASS329_VIEWPORT_LIFECYCLE__.lastCritical
document.documentElement.dataset.pass329ViewportHealth
```

Review priority:

- ResizeObserver / MutationObserver paths near webview/stage/pane geometry
- requestAnimationFrame / setInterval / resize listeners near viewport recompute logic
- any owner with PASS271_R9/R10 or PASS317-PASS328 tags
- webview/stage inline geometry at runtime
- CSS transforms or zoom on webview/stage/root
- Electron security guardrails must remain intact

Target outcome: source-owned layout + diagnostic sentry, no late runtime geometry writers.
