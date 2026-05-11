import { app } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ENTERPRISE_ADMIN_POLICY_CONTRACT_ID,
  ENTERPRISE_ADMIN_POLICY_MANAGED_PATHS,
  ENTERPRISE_ADMIN_POLICY_PASS,
  ENTERPRISE_ADMIN_POLICY_SCHEMA_VERSION,
  defaultEnterpriseAdminPolicy,
  enterpriseAdminPolicyForRenderer,
  enterpriseAdminPolicySummary,
  sanitizeEnterpriseAdminPolicy,
  shouldRejectEnterpriseAdminPolicyFile,
  type EnterpriseAdminPolicyState,
  type EnterprisePolicySourceKind
} from '../shared/enterprise-admin-policy-contract';

let cachedPolicyState: EnterpriseAdminPolicyState | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function safeSourceLabel(label: string): string {
  return label.replace(os.homedir(), '~').replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '').slice(0, 260);
}

function baseState(patch?: Partial<EnterpriseAdminPolicyState>): EnterpriseAdminPolicyState {
  return {
    pass: ENTERPRISE_ADMIN_POLICY_PASS,
    contractId: ENTERPRISE_ADMIN_POLICY_CONTRACT_ID,
    schemaVersion: ENTERPRISE_ADMIN_POLICY_SCHEMA_VERSION,
    managed: false,
    sourceKind: 'none',
    sourceLabel: 'local-default',
    loadedAt: nowIso(),
    errors: [],
    warnings: [],
    policy: defaultEnterpriseAdminPolicy(),
    ...patch
  };
}

function candidatePolicyFiles(): Array<{ sourceKind: EnterprisePolicySourceKind; file: string }> {
  const candidates: Array<{ sourceKind: EnterprisePolicySourceKind; file: string }> = [];
  const envFile = process.env[ENTERPRISE_ADMIN_POLICY_MANAGED_PATHS.environmentOverride];
  if (envFile) candidates.push({ sourceKind: 'environment-file', file: envFile });
  if (process.platform === 'win32') {
    const programData = process.env.ProgramData || 'C:\\ProgramData';
    candidates.push({ sourceKind: 'windows-programdata', file: path.join(programData, 'TAHAI', 'Web Services Browser', 'managed-policy.json') });
  } else if (process.platform === 'linux') {
    candidates.push({ sourceKind: 'linux-etc', file: '/etc/opt/tahai-browser/managed-policy.json' });
  } else if (process.platform === 'darwin') {
    candidates.push({ sourceKind: 'macos-library', file: '/Library/Application Support/TAHAI Web Services Browser/managed-policy.json' });
  }
  if (app.isPackaged) candidates.push({ sourceKind: 'app-bundled-default', file: path.join(process.resourcesPath, 'managed-policy.json') });
  return candidates;
}

function readPolicyFile(candidate: { sourceKind: EnterprisePolicySourceKind; file: string }): EnterpriseAdminPolicyState | null {
  const file = path.resolve(candidate.file);
  if (!fs.existsSync(file)) return null;
  try {
    const stat = fs.statSync(file);
    if (shouldRejectEnterpriseAdminPolicyFile(stat.size)) {
      return baseState({
        managed: false,
        sourceKind: candidate.sourceKind,
        sourceLabel: safeSourceLabel(file),
        errors: [`Managed policy file rejected by size boundary: ${stat.size} bytes.`]
      });
    }
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    const policy = sanitizeEnterpriseAdminPolicy(parsed);
    return baseState({
      managed: true,
      sourceKind: candidate.sourceKind,
      sourceLabel: safeSourceLabel(file),
      policy,
      warnings: policy.update.allowSilentAutoUpdate ? ['Silent auto-update was requested but is forced off by PASS154.'] : []
    });
  } catch (error) {
    return baseState({
      managed: false,
      sourceKind: candidate.sourceKind,
      sourceLabel: safeSourceLabel(file),
      errors: [error instanceof Error ? error.message : 'Managed policy file could not be parsed.']
    });
  }
}

export function readEnterpriseAdminPolicy(): EnterpriseAdminPolicyState {
  if (cachedPolicyState) return cachedPolicyState;
  for (const candidate of candidatePolicyFiles()) {
    const state = readPolicyFile(candidate);
    if (state) {
      cachedPolicyState = state;
      return state;
    }
  }
  cachedPolicyState = baseState();
  return cachedPolicyState;
}

export function refreshEnterpriseAdminPolicy(): EnterpriseAdminPolicyState {
  cachedPolicyState = null;
  return readEnterpriseAdminPolicy();
}

export function getEnterpriseAdminPolicyForRenderer(): EnterpriseAdminPolicyState {
  return enterpriseAdminPolicyForRenderer(readEnterpriseAdminPolicy());
}

export function getEnterpriseAdminPolicySummary(): string {
  return enterpriseAdminPolicySummary(readEnterpriseAdminPolicy());
}
