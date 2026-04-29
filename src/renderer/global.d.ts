import type { BrowserProfileInput, BrowserProfileState, BrowserProfileUpdateInput, CredentialVaultCopyResult, CredentialVaultRecord, CredentialVaultRevealResult, CredentialVaultSaveInput, CredentialVaultState, DevOpsCaptureSaveResult, DownloadState, ItServiceCardDiagnostics, MissionApiDeleteResult, MissionApiListResult, MissionApiLoadResult, MissionApiSaveResult, MissionApiState, OpsUrlDiagnostics, TahaiBrowserConfig, TahaiBrowserSettings } from '../preload/preload';

declare global {
  interface Window {
    tahaiBrowser: {
      getConfig: () => Promise<TahaiBrowserConfig>;
      getSettings: () => Promise<TahaiBrowserSettings>;
      updateSettings: (settings: TahaiBrowserSettings) => Promise<TahaiBrowserSettings>;
      resetSettings: () => Promise<TahaiBrowserSettings>;
      clearBrowsingData: () => Promise<boolean>;
      openUserData: () => Promise<boolean>;
      openExternal: (url: string) => Promise<boolean>;
      listMissions: () => Promise<MissionApiListResult>;
      loadMission: (missionId: string) => Promise<MissionApiLoadResult>;
      saveMission: (mission: MissionApiState) => Promise<MissionApiSaveResult>;
      deleteMission: (missionId: string) => Promise<MissionApiDeleteResult>;
      copyDevOpsCapture: (markdown: string) => Promise<boolean>;
      saveDevOpsCapture: (markdown: string, sourceUrl: string) => Promise<DevOpsCaptureSaveResult>;
      runUrlDiagnostics: (sourceUrl: string) => Promise<OpsUrlDiagnostics>;
      runItServiceCardDiagnostics: (sourceUrl: string) => Promise<ItServiceCardDiagnostics>;
      listCredentials: () => Promise<CredentialVaultState>;
      saveCredential: (input: CredentialVaultSaveInput) => Promise<CredentialVaultRecord>;
      deleteCredential: (id: string) => Promise<boolean>;
      revealCredentialPassword: (id: string) => Promise<CredentialVaultRevealResult>;
      copyCredentialValue: (id: string, field: 'username' | 'password') => Promise<CredentialVaultCopyResult>;
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
