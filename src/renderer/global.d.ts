import type { ItDocsMissionCapabilities } from '../shared/itdocs-contract';
import type { BrowserProfileInput, BrowserProfileState, BrowserProfileUpdateInput, ClearBrowsingDataOptions, ClearBrowsingDataResult, DevOpsCaptureSaveResult, DownloadState, ItServiceCardDiagnostics, MissionApiDeleteResult, MissionApiExportResult, MissionApiListResult, MissionApiLoadResult, MissionApiSaveResult, MissionApiState, OpsUrlDiagnostics, TahaiBrowserConfig, TahaiBrowserSettings } from '../preload/preload';

declare global {
  interface Window {
    tahaiBrowser: {
      getConfig: () => Promise<TahaiBrowserConfig>;
      getSettings: () => Promise<TahaiBrowserSettings>;
      updateSettings: (settings: TahaiBrowserSettings) => Promise<TahaiBrowserSettings>;
      resetSettings: () => Promise<TahaiBrowserSettings>;
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
    };
  }
}

export {};
