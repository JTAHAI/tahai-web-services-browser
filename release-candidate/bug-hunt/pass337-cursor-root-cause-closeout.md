# PASS337 Cursor Root-Cause Closeout

This pass implements the source-level remediation from the Cursor white-screen/dead-chrome report.

Primary root-cause class:
- successful webview navigation followed by white compositor/layer ownership failure
- default GPU teardown from PASS271_R9
- PASS271_R4 white webview repair loop reasserting geometry after first paint
- previous CSS fixes landing in the wrong stylesheet path

No IT Docs backend, PSA connector, direct PSA API, secrets, Store, GA, or signing claim is introduced.
