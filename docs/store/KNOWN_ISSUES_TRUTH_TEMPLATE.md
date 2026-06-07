# Store Known-Issues Truth Template

STATUS: KNOWN_ISSUES_REVIEW_PENDING

## Store submission blocker review

- Are there known crashers? PENDING
- Are there known installed-app launch failures? PENDING
- Are there known package identity mismatches? PENDING
- Are there known privacy/support URL gaps? PENDING
- Are there known screenshot/listing asset gaps? PENDING
- Are there known direct-installer signing gaps? YES — direct MSI/EXE remains unsigned preview unless a trusted signing path is added.
- Are there known MSIX sideload trust gaps? YES — local unsigned/sideload MSIX may fail on devices that do not trust the package certificate/namespace.

## Required release-truth statement

Use this language until signing/submission evidence changes:

> TAHAI Web Services Browser 2.0.14 direct MSI/EXE downloads are unsigned preview builds unless a trusted signing path is added. Microsoft Store package submission is not claimed until Partner Center identity, package evidence, installed smoke, listing assets, privacy/support URLs, and known-issues truth are complete.

## Hidden blocker attestation

Do not mark `noHiddenBlockers` true in the real Store evidence file unless the installed-app smoke, package identity, privacy/support URLs, listing assets, and package artifact evidence are all complete.
