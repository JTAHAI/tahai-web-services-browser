import {
  PASS220_ALLOWED_SUPPORT_BUNDLE_FIELDS,
  PASS220_PRIVACY_LOCAL_DATA_INVENTORY_ID,
  PASS220_PRIVACY_LOCAL_DATA_INVENTORY_VERSION,
  PASS220_PRIVACY_LOCAL_DATA_SURFACES,
  PASS220_PROHIBITED_LOCAL_DATA_FIELDS,
  type Pass220DataSurfaceId,
  type Pass220DataSurfaceInventoryItem
} from './privacy-local-data-inventory-contract';

export interface Pass220InventoryFinding {
  readonly code: string;
  readonly severity: 'info' | 'warning' | 'blocker';
  readonly surfaceId?: Pass220DataSurfaceId;
  readonly message: string;
}

export interface Pass220InventorySummary {
  readonly id: typeof PASS220_PRIVACY_LOCAL_DATA_INVENTORY_ID;
  readonly version: typeof PASS220_PRIVACY_LOCAL_DATA_INVENTORY_VERSION;
  readonly surfaceCount: number;
  readonly releaseBlockerCount: number;
  readonly supportBundleAllowedFieldCount: number;
  readonly exportableSurfaceIds: readonly Pass220DataSurfaceId[];
  readonly supportBundleSurfaceIds: readonly Pass220DataSurfaceId[];
  readonly clearableSurfaceIds: readonly Pass220DataSurfaceId[];
  readonly blockerFindings: readonly Pass220InventoryFinding[];
}

export function pass220GetPrivacyInventory(): readonly Pass220DataSurfaceInventoryItem[] {
  return PASS220_PRIVACY_LOCAL_DATA_SURFACES;
}

export function pass220FindPrivacySurface(surfaceId: Pass220DataSurfaceId): Pass220DataSurfaceInventoryItem | undefined {
  return PASS220_PRIVACY_LOCAL_DATA_SURFACES.find((surface) => surface.id === surfaceId);
}

export function pass220IsFieldProhibited(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return PASS220_PROHIBITED_LOCAL_DATA_FIELDS.some((field) => field.toLowerCase() === normalized);
}

export function pass220IsSupportBundleFieldAllowed(fieldName: string): boolean {
  const normalized = fieldName.trim();
  return PASS220_ALLOWED_SUPPORT_BUNDLE_FIELDS.some((field) => field === normalized);
}

export function pass220CollectPrivacyInventoryFindings(
  inventory: readonly Pass220DataSurfaceInventoryItem[] = PASS220_PRIVACY_LOCAL_DATA_SURFACES
): readonly Pass220InventoryFinding[] {
  const findings: Pass220InventoryFinding[] = [];
  const seen = new Set<string>();

  for (const surface of inventory) {
    if (seen.has(surface.id)) {
      findings.push({ code: 'privacy-inventory-duplicate-surface', severity: 'blocker', surfaceId: surface.id, message: `Duplicate surface id: ${surface.id}` });
    }
    seen.add(surface.id);

    if (!surface.releaseBlocker) {
      findings.push({ code: 'privacy-inventory-surface-not-release-blocking', severity: 'blocker', surfaceId: surface.id, message: `${surface.id} must remain release-blocking until runtime proof closes it.` });
    }
    if (!surface.storageClass) {
      findings.push({ code: 'privacy-inventory-storage-class-missing', severity: 'blocker', surfaceId: surface.id, message: `${surface.id} is missing storage class.` });
    }
    if (surface.supportBundleAllowed && surface.containsUserContent && surface.sensitivity !== 'local-operational') {
      findings.push({ code: 'privacy-inventory-support-bundle-user-content', severity: 'blocker', surfaceId: surface.id, message: `${surface.id} cannot enter support bundle with sensitive user content.` });
    }
    if (surface.exportable && surface.redaction === 'none' && surface.containsUserContent) {
      findings.push({ code: 'privacy-inventory-exportable-without-redaction', severity: 'blocker', surfaceId: surface.id, message: `${surface.id} is exportable user content without redaction.` });
    }
    for (const prohibited of PASS220_PROHIBITED_LOCAL_DATA_FIELDS) {
      if (!surface.prohibitedFields.includes(prohibited)) {
        findings.push({ code: 'privacy-inventory-prohibited-field-gap', severity: 'blocker', surfaceId: surface.id, message: `${surface.id} does not explicitly prohibit ${prohibited}.` });
      }
    }
    if (surface.id.includes('psa') && !surface.prohibitedFields.some((field) => field.toLowerCase().includes('token') || field.toLowerCase().includes('secret'))) {
      findings.push({ code: 'privacy-inventory-psa-secret-gap', severity: 'blocker', surfaceId: surface.id, message: `${surface.id} must explicitly prohibit PSA tokens/secrets.` });
    }
    if (surface.id.includes('itdocs') && !surface.prohibitedFields.some((field) => field.toLowerCase().includes('token'))) {
      findings.push({ code: 'privacy-inventory-itdocs-token-gap', severity: 'blocker', surfaceId: surface.id, message: `${surface.id} must explicitly prohibit IT Docs/Cognito/OAuth tokens.` });
    }
  }

  for (const required of ['mission-json', 'mission-evidence-files', 'mission-export-artifacts', 'support-bundle', 'runtime-logs', 'webview-remote-content-storage'] as const) {
    if (!seen.has(required)) {
      findings.push({ code: 'privacy-inventory-required-surface-missing', severity: 'blocker', surfaceId: required, message: `Missing required privacy surface: ${required}` });
    }
  }

  return findings;
}

export function pass220BuildPrivacyInventorySummary(
  inventory: readonly Pass220DataSurfaceInventoryItem[] = PASS220_PRIVACY_LOCAL_DATA_SURFACES
): Pass220InventorySummary {
  const findings = pass220CollectPrivacyInventoryFindings(inventory).filter((finding) => finding.severity === 'blocker');
  return {
    id: PASS220_PRIVACY_LOCAL_DATA_INVENTORY_ID,
    version: PASS220_PRIVACY_LOCAL_DATA_INVENTORY_VERSION,
    surfaceCount: inventory.length,
    releaseBlockerCount: inventory.filter((surface) => surface.releaseBlocker).length,
    supportBundleAllowedFieldCount: PASS220_ALLOWED_SUPPORT_BUNDLE_FIELDS.length,
    exportableSurfaceIds: inventory.filter((surface) => surface.exportable).map((surface) => surface.id),
    supportBundleSurfaceIds: inventory.filter((surface) => surface.supportBundleAllowed).map((surface) => surface.id),
    clearableSurfaceIds: inventory.filter((surface) => surface.clearableByUser).map((surface) => surface.id),
    blockerFindings: findings
  };
}

export function pass220AssertPrivacyInventoryClean(): Pass220InventorySummary {
  const summary = pass220BuildPrivacyInventorySummary();
  if (summary.blockerFindings.length > 0) {
    const messages = summary.blockerFindings.map((finding) => `${finding.code}: ${finding.message}`).join('\n');
    throw new Error(`PASS220 privacy/local data inventory has release blockers:\n${messages}`);
  }
  return summary;
}
