# PASS271-R6 — Popup-As-Tabs Operator Toggle

- Popups remain denied as unmanaged Electron windows.
- Safe popup URLs are routed through the main process into normal TAHAI tabs when the local setting is enabled.
- The renderer setting is **Open popups as new TAHAI tabs**.
- Unsafe popup URLs remain blocked by the existing navigation boundary.
- No allowpopups attribute is added to webviews.
- No Store, GA, signing, IT Docs backend, PSA connector, or provider-secret claim is introduced.
