export const PASS97_LOCAL_PATH_BOUNDARY = 'PASS97 local filesystem path disclosure boundary';

export type LocalFilesystemHandoffKind = 'mission-store' | 'mission-export' | 'devops-capture' | 'profile-store' | 'browser-config';

const KIND_LABELS: Record<LocalFilesystemHandoffKind, string> = {
  'mission-store': 'Local mission store updated. Filesystem path hidden.',
  'mission-export': 'Redacted mission packet saved. Filesystem path hidden.',
  'devops-capture': 'Redacted evidence note saved. Filesystem path hidden.',
  'profile-store': 'Browser profile store updated. Filesystem path hidden.',
  'browser-config': 'Browser config loaded. Filesystem paths hidden.'
};

export function localFilesystemHandoffLabel(kind: LocalFilesystemHandoffKind): string {
  return KIND_LABELS[kind] || 'Local filesystem operation completed. Filesystem path hidden.';
}

export function scrubLocalPathText(value: unknown): string {
  return String(value ?? '')
    .replace(/\b[A-Za-z]:\\[^\r\n\t|<>"']+/g, '[LOCAL_PATH_HIDDEN]')
    .replace(/\/Users\/[^\r\n\t|<>"']+/g, '[LOCAL_PATH_HIDDEN]')
    .replace(/\/home\/[^\r\n\t|<>"']+/g, '[LOCAL_PATH_HIDDEN]')
    .replace(/\/mnt\/[a-zA-Z]\/[^\r\n\t|<>"']+/g, '[LOCAL_PATH_HIDDEN]')
    .replace(/\\\\[^\r\n\t|<>"']+/g, '[LOCAL_PATH_HIDDEN]')
    .trim();
}
