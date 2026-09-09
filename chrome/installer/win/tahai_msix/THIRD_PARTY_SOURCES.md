# Third-party source and notices

The browser's `chrome://credits` page and the packaged `ThirdPartyNotices/`
directory contain third-party attribution and license texts. TAHAI uses
Chromium 152.0.7977.83; Chromium source is available from
https://chromium.googlesource.com/chromium/src/+/152.0.7977.83/.

Guard uses unmodified adblock-rust 0.12.6 source, upstream commit
`ca7f9f4a24a439da99e052b4e4041c45d87687f5`, under MPL-2.0:
https://github.com/brave/adblock-rust/tree/ca7f9f4a24a439da99e052b4e4041c45d87687f5.
The original crates.io archive SHA-256 is
`4844c456026028b3a22f3bc0b0e0b2485809591673e2d70930a4ada7c4d3a90d`.
TAHAI's separate browser/service bridge is not an upstream engine modification.
The package includes the engine's README.chromium and full MPL-2.0 license.

EasyList and EasyPrivacy are filter data by The EasyList authors, obtained
from https://easylist.to/ and distributed under CC-BY-SA-3.0. The packaged
`ThirdPartyNotices/GuardLists/` directory includes the full license, exact
source URLs/revisions/hashes, original upstream lists, derived shipped lists,
exclusion manifest and transformation script. The transformation retains
supported network and declarative cosmetic candidates and removes unsupported
active-content options. Rust independently validates admitted rules.

Filter-list updates ship with browser releases. Neither a filter-list digest
nor a skin archive digest is a publisher signature or a security attestation.
