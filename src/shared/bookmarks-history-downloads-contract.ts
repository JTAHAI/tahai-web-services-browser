/**
 * PASS340 — Bookmarks / History / Downloads Runtime UX
 *
 * Contract for bookmarks, history, and downloads UX.
 * All are free features. No secrets in exports or diagnostics.
 */

export const PASS340_BOOKMARKS_HISTORY_PASS = 'PASS340';
export const BOOKMARKS_HISTORY_CONTRACT_ID = 'bookmarks-history-downloads-runtime-ux-v1';

export type BookmarkEntry = {
  id: string;
  profileId: string;
  url: string;
  title: string;
  addedAt: string;
  folder?: string;
};

export type HistoryEntry = {
  id: string;
  profileId: string;
  url: string;
  title: string;
  visitedAt: string;
  source: 'address-bar' | 'link' | 'bookmark' | 'session-restore' | 'recipe';
};

export type DownloadEntry = {
  id: string;
  profileId: string;
  filename: string;
  /** Sanitized label — no local filesystem path revealed to renderer */
  localPathLabel: string;
  url: string;
  /** Displayed origin for provenance — never include auth headers or cookies */
  sourceOrigin: string;
  startedAt: string;
  completedAt?: string;
  sizeBytes: number;
  status: 'in-progress' | 'completed' | 'cancelled' | 'failed';
  /** Risk messaging based on download origin */
  riskLevel: 'safe' | 'warn-http' | 'warn-unknown-origin';
  riskMessage: string;
};

export function downloadRiskLevel(url: string): { level: DownloadEntry['riskLevel']; message: string } {
  if (!url) return { level: 'warn-unknown-origin', message: 'Origin unknown. Verify source before opening.' };
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:') return { level: 'safe', message: 'Downloaded over HTTPS.' };
    if (parsed.protocol === 'http:') return { level: 'warn-http', message: 'Warning: Downloaded over HTTP. Content integrity cannot be verified.' };
  } catch { /* fall through */ }
  return { level: 'warn-unknown-origin', message: 'Origin could not be verified. Use caution.' };
}

export function bookmarksHistoryDownloadsSummary(): string {
  return `${PASS340_BOOKMARKS_HISTORY_PASS} ${BOOKMARKS_HISTORY_CONTRACT_ID}: bookmarks=free; history=free; downloads=free; noSecretsInExports=true; riskMessagingEnabled=true`;
}
