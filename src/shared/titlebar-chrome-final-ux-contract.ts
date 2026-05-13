export const PASS192_TITLEBAR_CHROME_FINAL_UX_VERSION = 'PASS192-titlebar-chrome-final-ux-v1' as const;

export type Pass192TitlebarChromeCaseId =
  | 'empty-titlebar-track-remains-window-draggable'
  | 'tab-buttons-and-close-targets-are-no-drag-controls'
  | 'close-control-is-not-a-nested-button'
  | 'overflowing-tab-strip-preserves-visible-active-state'
  | 'compact-and-high-dpi-widths-preserve-hit-targets'
  | 'keyboard-roving-focus-does-not-break-active-tab';

export type Pass192TitlebarChromeCase = {
  id: Pass192TitlebarChromeCaseId;
  surface: 'drag' | 'hit-target' | 'overflow' | 'accessibility';
  requirement: string;
};

export const PASS192_TITLEBAR_CHROME_CASES: Pass192TitlebarChromeCase[] = [
  { id: 'empty-titlebar-track-remains-window-draggable', surface: 'drag', requirement: 'The titlebar and empty tab strip track keep -webkit-app-region: drag.' },
  { id: 'tab-buttons-and-close-targets-are-no-drag-controls', surface: 'hit-target', requirement: 'Actual tab, close, and new-tab controls opt out of window drag.' },
  { id: 'close-control-is-not-a-nested-button', surface: 'hit-target', requirement: 'The close hit target is not rendered as a button nested inside another button.' },
  { id: 'overflowing-tab-strip-preserves-visible-active-state', surface: 'overflow', requirement: 'Overflow uses horizontal tab scrolling and active state remains explicit.' },
  { id: 'compact-and-high-dpi-widths-preserve-hit-targets', surface: 'hit-target', requirement: 'Compact and high-DPI widths retain usable tab and close targets.' },
  { id: 'keyboard-roving-focus-does-not-break-active-tab', surface: 'accessibility', requirement: 'Arrow/Home/End keyboard movement updates the active browser tab deterministically.' }
];

export const PASS192_TITLEBAR_REQUIRED_DATASETS = [
  'pass192TitlebarChromeFinal',
  'pass192TitlebarChromeVersion',
  'pass192TitlebarOverflow',
  'pass192TitlebarHeight'
] as const;

export function pass192TitlebarChromeSummary(): string {
  return `${PASS192_TITLEBAR_CHROME_CASES.length} titlebar/tab-strip UX invariants active`;
}
