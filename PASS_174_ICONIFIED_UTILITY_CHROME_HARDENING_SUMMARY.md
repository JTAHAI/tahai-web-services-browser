# PASS174 Iconified Utility Chrome Hardening Summary

PASS174 closes the accessibility and compact-window gaps left after PASS173 iconification.

- Fixed-position tooltip controller added for hover and focus.
- Keyboard focus now gets tooltip text through `aria-describedby` while active.
- More Tools iconified controls receive menuitem role while inside the menu.
- Arrow/Home/End keyboard navigation added inside More Tools.
- Runtime body data-state flags are aligned on boot.
- Mission Control keeps readable text and now includes an explicit aria label.
- Version remains `1.8.30`.
