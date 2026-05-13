export const PASS186_INSTALLED_MOUSE_NAVIGATION_PROOF_VERSION = 'pass186-installed-mouse-navigation-proof-v1';

export type Pass186NavigationSurface =
  | 'normal-active-tab'
  | 'focused-webview'
  | 'split-active-pane'
  | 'tri-view-active-pane'
  | 'quad-active-pane'
  | 'menu-command'
  | 'address-bar';

export type Pass186NavigationInput =
  | 'mouse-button-4-back'
  | 'mouse-button-5-forward'
  | 'toolbar-back'
  | 'toolbar-forward'
  | 'alt-left'
  | 'alt-right'
  | 'menu-back'
  | 'menu-forward'
  | 'address-submit';

export type Pass186ProofExpectation =
  | 'targets-active-tab'
  | 'targets-focused-webview-host-tab'
  | 'targets-active-mission-pane'
  | 'safe-noop-when-history-unavailable'
  | 'does-not-double-navigate'
  | 'does-not-target-hidden-pane'
  | 'does-not-break-address-routing';

export type Pass186ProofCase = {
  id: string;
  surface: Pass186NavigationSurface;
  input: Pass186NavigationInput;
  expectation: Pass186ProofExpectation;
  required: boolean;
  installedOnly: boolean;
  operatorPrompt: string;
};

export const PASS186_INSTALLED_MOUSE_NAVIGATION_PROOF_CASES: readonly Pass186ProofCase[] = [
  {
    id: 'pass186-normal-tab-mouse-back',
    surface: 'normal-active-tab',
    input: 'mouse-button-4-back',
    expectation: 'targets-active-tab',
    required: true,
    installedOnly: true,
    operatorPrompt: 'Normal browsing: navigate an active tab through two pages, click inside the page, press Mouse Button 4, and confirm only the active tab goes back.'
  },
  {
    id: 'pass186-normal-tab-mouse-forward',
    surface: 'normal-active-tab',
    input: 'mouse-button-5-forward',
    expectation: 'targets-active-tab',
    required: true,
    installedOnly: true,
    operatorPrompt: 'Normal browsing: after Mouse Button 4 succeeds, press Mouse Button 5 and confirm only the active tab goes forward.'
  },
  {
    id: 'pass186-focused-webview-mouse-back-dedupe',
    surface: 'focused-webview',
    input: 'mouse-button-4-back',
    expectation: 'does-not-double-navigate',
    required: true,
    installedOnly: true,
    operatorPrompt: 'Focused webview: click inside remote page content, press Mouse Button 4 once, and confirm one history step only; no double-back.'
  },
  {
    id: 'pass186-focused-webview-mouse-forward-host',
    surface: 'focused-webview',
    input: 'mouse-button-5-forward',
    expectation: 'targets-focused-webview-host-tab',
    required: true,
    installedOnly: true,
    operatorPrompt: 'Focused webview: press Mouse Button 5 and confirm the focused webview host tab is the target, not a background tab.'
  },
  {
    id: 'pass186-split-active-pane-mouse-back',
    surface: 'split-active-pane',
    input: 'mouse-button-4-back',
    expectation: 'targets-active-mission-pane',
    required: true,
    installedOnly: true,
    operatorPrompt: 'Split view: focus the non-default Mission pane, press Mouse Button 4, and confirm only the visible active pane goes back.'
  },
  {
    id: 'pass186-split-active-pane-mouse-forward',
    surface: 'split-active-pane',
    input: 'mouse-button-5-forward',
    expectation: 'targets-active-mission-pane',
    required: true,
    installedOnly: true,
    operatorPrompt: 'Split view: press Mouse Button 5 and confirm only the visible active pane goes forward.'
  },
  {
    id: 'pass186-triview-alt-left-parity',
    surface: 'tri-view-active-pane',
    input: 'alt-left',
    expectation: 'targets-active-mission-pane',
    required: true,
    installedOnly: true,
    operatorPrompt: 'Tri-view: focus a visible Mission pane, use Alt+Left, and confirm it matches Mouse Button 4 targeting.'
  },
  {
    id: 'pass186-triview-alt-right-parity',
    surface: 'tri-view-active-pane',
    input: 'alt-right',
    expectation: 'targets-active-mission-pane',
    required: true,
    installedOnly: true,
    operatorPrompt: 'Tri-view: use Alt+Right and confirm it matches Mouse Button 5 targeting.'
  },
  {
    id: 'pass186-quad-toolbar-back',
    surface: 'quad-active-pane',
    input: 'toolbar-back',
    expectation: 'targets-active-mission-pane',
    required: true,
    installedOnly: true,
    operatorPrompt: 'Quad View: focus pane 3 or 4, click toolbar Back, and confirm only that active pane goes back.'
  },
  {
    id: 'pass186-quad-toolbar-forward',
    surface: 'quad-active-pane',
    input: 'toolbar-forward',
    expectation: 'targets-active-mission-pane',
    required: true,
    installedOnly: true,
    operatorPrompt: 'Quad View: click toolbar Forward and confirm only the same active pane goes forward.'
  },
  {
    id: 'pass186-menu-back-forward-parity',
    surface: 'menu-command',
    input: 'menu-back',
    expectation: 'safe-noop-when-history-unavailable',
    required: true,
    installedOnly: true,
    operatorPrompt: 'Application menu: run Back/Forward from the menu with and without history and confirm it targets active context or cleanly no-ops.'
  },
  {
    id: 'pass186-address-bar-active-pane',
    surface: 'address-bar',
    input: 'address-submit',
    expectation: 'does-not-break-address-routing',
    required: true,
    installedOnly: true,
    operatorPrompt: 'Address bar: in Split/Tri/Quad, focus a pane, submit a URL, and confirm the address bar navigates the active pane only.'
  },
  {
    id: 'pass186-hidden-pane-guard',
    surface: 'quad-active-pane',
    input: 'mouse-button-4-back',
    expectation: 'does-not-target-hidden-pane',
    required: true,
    installedOnly: true,
    operatorPrompt: 'Layout recovery: switch between Quad/Tri/Focus, press Mouse Button 4, and confirm no hidden pane or stale runtime tab receives navigation.'
  }
] as const;

export const PASS186_REQUIRED_INSTALLED_PROOF_COUNT = PASS186_INSTALLED_MOUSE_NAVIGATION_PROOF_CASES.filter((proofCase) => proofCase.required).length;

export function pass186InstalledMouseNavigationProofIds(): string[] {
  return PASS186_INSTALLED_MOUSE_NAVIGATION_PROOF_CASES.map((proofCase) => proofCase.id);
}
