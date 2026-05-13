export const PASS191_ADDRESS_BAR_ENTERPRISE_RELIABILITY_VERSION = 'PASS191' as const;

export type Pass191AddressBarCaseId =
  | 'https-url-navigates'
  | 'host-shorthand-normalizes-to-https'
  | 'localhost-shorthand-normalizes-to-http'
  | 'plain-text-routes-to-search-provider'
  | 'dangerous-explicit-protocol-blocks'
  | 'embedded-credentials-block'
  | 'oversized-input-blocks'
  | 'control-characters-stripped'
  | 'active-pane-target-is-recorded'
  | 'loading-state-is-reflected';

export const PASS191_ADDRESS_BAR_CASES: readonly Pass191AddressBarCaseId[] = [
  'https-url-navigates',
  'host-shorthand-normalizes-to-https',
  'localhost-shorthand-normalizes-to-http',
  'plain-text-routes-to-search-provider',
  'dangerous-explicit-protocol-blocks',
  'embedded-credentials-block',
  'oversized-input-blocks',
  'control-characters-stripped',
  'active-pane-target-is-recorded',
  'loading-state-is-reflected'
];

export const PASS191_ADDRESS_BAR_INVARIANTS = [
  'address-submit-resolves-before-loadURL',
  'plain-text-search-is-deliberate-not-fallback-garbage',
  'explicit-unsafe-schemes-block-instead-of-silent-launchpad-navigation',
  'address-target-tab-and-pane-are-recorded',
  'control-characters-are-stripped-from-paste-and-input',
  'oversized-address-input-does-not-navigate',
  'loading-and-idle-state-are-reflected-on-the-address-input',
  'programmatic-normalize-target-remains-compatible-with-existing-launchpad/home/menu-actions'
] as const;

export function pass191AddressBarReliabilitySummary(): string {
  return `${PASS191_ADDRESS_BAR_ENTERPRISE_RELIABILITY_VERSION}: ${PASS191_ADDRESS_BAR_CASES.length} address-bar reliability cases; invariants=${PASS191_ADDRESS_BAR_INVARIANTS.join(',')}`;
}
