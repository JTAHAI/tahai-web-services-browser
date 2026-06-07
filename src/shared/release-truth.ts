export const TAHAI_RELEASE_VERSION = '2.0.14';
export const TAHAI_RELEASE_PASS = 'PASS341';
export const TAHAI_RELEASE_CHANNEL = 'public-rc';
export const TAHAI_RELEASE_PHASE = 'browser-runtime-clickability-recovery';
export const TAHAI_PRODUCT_NAME = 'TAHAI Web Services Browser';
export const TAHAI_BUNDLE_NAME = 'TAHAI—SENTINEL Browser';
export const TAHAI_DEFAULT_HOME_URL = 'https://tahaiportal.com';
export const TAHAI_PUBLIC_REPO_URL = 'https://github.com/JTAHAI/tahai-web-services-browser';
export const TAHAI_DOWNLOAD_ORIGIN = 'https://browser.tahai.net';
export const TAHAI_DOWNLOAD_ALIAS_ORIGIN = 'https://browser.tahaiportal.com';
export const TAHAI_UPDATE_CHANNEL = 'manual-release';
export const TAHAI_UPDATE_POLICY = 'Manual download/install only; no silent auto-update lane is enabled in this preview build.';
export const TAHAI_SIGNING_STATUS = 'Unsigned preview until the approved code-signing lane is active.';
export const TAHAI_RELEASE_TRUTH_LABEL = `${TAHAI_PRODUCT_NAME} ${TAHAI_RELEASE_VERSION} ${TAHAI_RELEASE_CHANNEL} ${TAHAI_RELEASE_PASS}`;

export type TahaiReleaseTruth = {
  productName: string;
  bundleName: string;
  version: string;
  releasePass: string;
  releaseChannel: string;
  releasePhase: string;
  updateChannel: string;
  updatePolicy: string;
  signingStatus: string;
  downloadOrigin: string;
  downloadAliasOrigin: string;
  publicRepoUrl: string;
};

export function releaseTruthForRenderer(): TahaiReleaseTruth {
  return {
    productName: TAHAI_PRODUCT_NAME,
    bundleName: TAHAI_BUNDLE_NAME,
    version: TAHAI_RELEASE_VERSION,
    releasePass: TAHAI_RELEASE_PASS,
    releaseChannel: TAHAI_RELEASE_CHANNEL,
    releasePhase: TAHAI_RELEASE_PHASE,
    updateChannel: TAHAI_UPDATE_CHANNEL,
    updatePolicy: TAHAI_UPDATE_POLICY,
    signingStatus: TAHAI_SIGNING_STATUS,
    downloadOrigin: TAHAI_DOWNLOAD_ORIGIN,
    downloadAliasOrigin: TAHAI_DOWNLOAD_ALIAS_ORIGIN,
    publicRepoUrl: TAHAI_PUBLIC_REPO_URL,
  };
}
