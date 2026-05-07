import { shell } from 'electron';
import { isAllowedExternalNavigationUrl, sanitizeExternalNavigationUrl } from '../shared/navigation-boundary';

export function isSafeExternalUrl(value: string): boolean {
  return isAllowedExternalNavigationUrl(value);
}

export function safeExternalUrl(value: string): string {
  return sanitizeExternalNavigationUrl(value);
}

export async function safeOpenExternal(value: string): Promise<boolean> {
  const safeUrl = safeExternalUrl(value);
  if (!safeUrl) return false;
  await shell.openExternal(safeUrl);
  return true;
}
