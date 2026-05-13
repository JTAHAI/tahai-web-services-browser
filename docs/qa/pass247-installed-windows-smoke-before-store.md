# PASS247 QA — installed Windows smoke before Store submission

Store submission is blocked until this installed Windows smoke checklist is run against an installed package on Windows.

## installed Windows smoke

- [ ] Install package on a clean or representative Windows user profile.
- [ ] Launch from Start menu and taskbar shortcut.
- [ ] Confirm app name, icon, and version show TAHAI Web Services Browser 2.0.0.
- [ ] Confirm normal browsing loads `https://tahaiportal.com` or the configured default URL.
- [ ] Confirm Ctrl+K opens and closes cleanly at restored, maximized, and small window sizes.
- [ ] Confirm Mission Control cards do not overlap or cut off at restored, maximized, and small window sizes.
- [ ] Confirm DevOps tool dialog closes via button, ESC, and click outside.
- [ ] Confirm mouse back/forward and toolbar navigation target the active tab or active Mission pane.
- [ ] Confirm settings persistence writes only under the user profile, not the source repo.
- [ ] Confirm downloads and support bundle do not expose local paths or secrets in UI text.
- [ ] Confirm uninstall leaves user data according to documented policy.

Attach screenshots, package filename, SHA256, Windows version, install scope, and tester initials/date outside source.
