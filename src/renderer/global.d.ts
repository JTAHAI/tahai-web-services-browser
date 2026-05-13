import type { ItDocsMissionCapabilities } from '../shared/itdocs-contract';
import type { EnterpriseAdminPolicyState } from '../shared/enterprise-admin-policy-contract';
import type { EnterpriseSupportBundleResult } from '../shared/enterprise-support-bundle-contract';
import type { BrowserProfileInput, BrowserProfileState, BrowserProfileUpdateInput, ClearBrowsingDataOptions, ClearBrowsingDataResult, DevOpsCaptureSaveResult, DownloadArtifactRevealResult, DownloadState, ItServiceCardDiagnostics, MissionApiDeleteResult, MissionApiExportResult, MissionApiListResult, MissionApiLoadResult, MissionApiSaveResult, MissionApiState, OpsUrlDiagnostics, TahaiBrowserConfig, TahaiBrowserSettings } from '../preload/preload';
import type { Pass188InputBoundaryPayload } from '../shared/webview-focus-input-boundary-contract';

declare global {
  interface Window {

    __TAHAI_RUNTIME_E2E__?: {
      run: () => Promise<{ ok: boolean; pass: 'PASS158'; contractId: string; scenarioCount: number; results: Array<{ id: string; ok: boolean; detail: string }> }>;
    };
    tahaiBrowser: {
      getConfig: () => Promise<TahaiBrowserConfig>;
      getSettings: () => Promise<TahaiBrowserSettings>;
      getAdminPolicy: () => Promise<EnterpriseAdminPolicyState>;
      previewEnterpriseSupportBundle: () => Promise<EnterpriseSupportBundleResult>;
      copyEnterpriseSupportBundle: () => Promise<EnterpriseSupportBundleResult>;
      saveEnterpriseSupportBundle: () => Promise<EnterpriseSupportBundleResult>;
      updateSettings: (settings: TahaiBrowserSettings) => Promise<TahaiBrowserSettings>;
      resetSettings: () => Promise<TahaiBrowserSettings>;
      revealDownloadArtifact: (artifactId: string) => Promise<DownloadArtifactRevealResult>;
      clearBrowsingData: (options?: ClearBrowsingDataOptions) => Promise<ClearBrowsingDataResult>;
      openUserData: () => Promise<boolean>;
      openExternal: (url: string) => Promise<boolean>;
      openItDocs: () => Promise<boolean>;
      getItDocsCapabilities: () => Promise<ItDocsMissionCapabilities>;
      copyItDocsCapabilities: () => Promise<boolean>;
      copyPsaReferenceContract: () => Promise<boolean>;
      listMissions: () => Promise<MissionApiListResult>;
      loadMission: (missionId: string) => Promise<MissionApiLoadResult>;
      saveMission: (mission: MissionApiState) => Promise<MissionApiSaveResult>;
      deleteMission: (missionId: string) => Promise<MissionApiDeleteResult>;
      previewMissionExport: (mission: MissionApiState) => Promise<MissionApiExportResult>;
      copyMissionExport: (mission: MissionApiState) => Promise<MissionApiExportResult>;
      saveMissionExport: (mission: MissionApiState) => Promise<MissionApiExportResult>;
      copyDevOpsCapture: (markdown: string) => Promise<boolean>;
      saveDevOpsCapture: (markdown: string, sourceUrl: string) => Promise<DevOpsCaptureSaveResult>;
      runUrlDiagnostics: (sourceUrl: string) => Promise<OpsUrlDiagnostics>;
      runItServiceCardDiagnostics: (sourceUrl: string) => Promise<ItServiceCardDiagnostics>;
      listProfiles: () => Promise<BrowserProfileState>;
      createProfile: (input: BrowserProfileInput) => Promise<BrowserProfileState>;
      updateProfile: (input: BrowserProfileUpdateInput) => Promise<BrowserProfileState>;
      setActiveProfile: (id: string) => Promise<BrowserProfileState>;
      deleteProfile: (id: string) => Promise<BrowserProfileState>;
      openProfileData: (id: string) => Promise<boolean>;
      onOpenInTab: (callback: (url: string) => void) => () => void;
      onMenuCommand: (callback: (command: string) => void) => () => void;
      onToggleDevTools: (callback: () => void) => () => void;
      onDownloadState: (callback: (state: DownloadState) => void) => () => void;
      onPass188InputBoundary: (callback: (payload: Pass188InputBoundaryPayload) => void) => () => void;
    };
  }
}

export {};
