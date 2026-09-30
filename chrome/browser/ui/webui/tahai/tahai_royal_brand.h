// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_ROYAL_BRAND_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_ROYAL_BRAND_H_

namespace tahai {

// Browser-owned surfaces only. Website content and security prompts never use
// this stylesheet. Work-mode layouts remain distinct; explicit Studio accents,
// surface choices, light palettes and forced colors keep precedence.
// Source: browser.tahai.net, Royal identity release 20260913.
inline constexpr char kRoyalBrandCss[] = R"TAHAI(
body{font-family:"Segoe UI Variable","Segoe UI",Inter,system-ui,sans-serif}
.brand .mark,.hero-art img{object-fit:contain;border:0;border-radius:0;background:transparent;box-shadow:none}
body.theme-dark.accent-mode{--cyan:#c8b3ff;--blue:#8050ee;--mint:#c8b3ff;--violet:#8953ee;--coral:#ff795f;--muted:#b1a8c3;--line:#ae90e033;--mode-accent:#9348ed;--mode-accent-strong:#c4a5ff;--mode-surface:#100a1bf2;--mode-surface-2:#171026ed;--mode-border:#ae90e033;--mode-shadow:#00000075;color:#f6f8ff}
body.theme-dark.accent-mode.surface-mode{background:radial-gradient(ellipse at 80% 3%,#6a2cc129,transparent 36%),radial-gradient(ellipse at 91% 83%,#50217d30,transparent 37%),#07050e;background-attachment:fixed}
body.theme-dark.accent-mode header{border-color:var(--mode-border);background:#090612e8}
body.theme-dark.accent-mode :is(.hero,.panel,.card,.mode-dialog,.command-palette){border-color:var(--mode-border);background:linear-gradient(145deg,#100a1bf2,#0b0713f2 62%,#1b0c2bf2);color:#f6f8ff}
body.theme-dark.accent-mode :is(.button,.chip){border-color:var(--mode-border);background:#120d1bea;color:#f6f8ff}
body.theme-dark.accent-mode :is(.button.primary,.chip.selected){border-color:#c4a5ff;background:linear-gradient(115deg,#c4a5ff,#a378f2);color:#1b092e;box-shadow:0 8px 28px #6a2cc133}
body.theme-dark.accent-mode :is(.button,.chip):hover{border-color:#c4a5ff;box-shadow:0 8px 24px #0006}
body.theme-dark.accent-mode :is(.search input,.command-input,textarea,select,input:not([type=checkbox]):not([type=radio]):not([type=color])){border-color:#ae90e066;background:#0b0713;color:#f6f8ff}
body.theme-dark.accent-mode :is(.eyebrow,.scope,.mode-card-title,.product-lane,.oi-memory-kind){color:#c8b3ff;text-shadow:none}
body.theme-dark.accent-mode .hero::before,body.theme-dark.accent-mode .card::after,body.theme-dark.accent-mode .oi-metric::after{background:radial-gradient(circle,#9348ed33,transparent 70%)}
body.theme-dark.accent-mode .hero-art::before{animation:none;border-color:#ae90e033;box-shadow:0 0 48px #9348ed22}
body.theme-dark.accent-mode .hero-art img{filter:drop-shadow(0 0 35px #7f3ced2e);transform:none}
body.theme-dark.accent-mode :is(.hero-badge,.status,.mission-step,.command,.list li,.oi-state-card,.oi-metric,.oi-mission,.oi-action,.oi-control-card,.oi-capability,.oi-search-row,.oi-search-result,.oi-edge,.oi-finding,.oi-score,.oi-entity-detail,.oi-empty){border-color:var(--mode-border);background:#140d20e8;color:#f6f8ff;box-shadow:none}
body.theme-dark.accent-mode :is(.oi-state-card strong,.oi-state-card em,.oi-score,.oi-entity-detail strong,.oi-finding .recommendation,.oi-action .action-next,.oi-edge em){color:#d9e0f2;text-shadow:none}
body.theme-dark.accent-mode .oi-state-card::before{border-color:#ae90e022}
body.theme-dark.accent-mode :is(.oi-boundary,.oi-promotion){border-color:var(--mode-border);background:linear-gradient(145deg,#100a1b,#1b0d2d)}
body.theme-dark.accent-mode .oi-progress{background:#251937}
body.theme-dark.accent-mode .oi-progress>span{box-shadow:none}
body.theme-dark.accent-mode .oi-evidence-anchor{border-color:#ae90e066}
body.theme-dark.accent-mode .oi-memory-row{border-color:#ae90e033}
body.theme-dark.accent-mode .oi-memory-row time{color:var(--muted)}
/* Severity remains distinct from decoration; never make a danger button look
   like the primary CTA or erase blocked/attention readiness indicators. */
body.theme-dark.accent-mode :is(.button.danger,[data-oi-severity=blocked]){border-color:#ff795f99;background:#311321;color:#ffe7e2}
body.theme-dark.accent-mode [data-oi-severity=attention]{border-color:#ffd77d99}
body.theme-dark.accent-mode :focus-visible{outline:3px solid #d2bdff;outline-offset:3px}
.launch-hero .brand-tagline{display:block;color:#c8b3ff}
body.theme-light .launch-hero .brand-tagline{color:#6e4aaf}
@media(forced-colors:active){
 body.theme-dark.accent-mode,body.mode-daily:not(.theme-light){background:Canvas;color:CanvasText;--muted:CanvasText;--mode-border:CanvasText;--mint:LinkText;--cyan:LinkText}
 body.theme-dark.accent-mode :is(header,.hero,.panel,.card,.mode-dialog,.command-palette,.hero-badge,.status,.mission-step,.command,.list li,.oi-state-card,.oi-metric,.oi-mission,.oi-action,.oi-control-card,.oi-capability,.oi-search-row,.oi-search-result,.oi-edge,.oi-finding,.oi-score,.oi-entity-detail,.oi-empty,.oi-boundary,.oi-promotion){background:Canvas;color:CanvasText;border-color:CanvasText;box-shadow:none}
 body.theme-dark.accent-mode :is(.button,.chip,.button.primary,.chip.selected,.button.danger){background:ButtonFace;color:ButtonText;border-color:ButtonText;box-shadow:none}
 body.theme-dark.accent-mode :is(.search input,.command-input,textarea,select,input:not([type=checkbox]):not([type=radio]):not([type=color])){background:Field;color:FieldText;border-color:FieldText}
 body.theme-dark.accent-mode :is(.eyebrow,.scope,.mode-card-title,.product-lane,.oi-memory-kind,.oi-state-card strong,.oi-state-card em,.oi-score,.oi-entity-detail strong,.oi-finding .recommendation,.oi-action .action-next,.oi-edge em),.launch-hero .brand-tagline{color:CanvasText;text-shadow:none}
 body.theme-dark.accent-mode .hero::before,body.theme-dark.accent-mode .card::after,body.theme-dark.accent-mode .oi-metric::after,body.theme-dark.accent-mode .hero-art::before{display:none}
 body.theme-light .launch-hero .brand-tagline{color:CanvasText}
 body.theme-dark.accent-mode :focus-visible{outline-color:Highlight}
}
)TAHAI";

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_ROYAL_BRAND_H_
