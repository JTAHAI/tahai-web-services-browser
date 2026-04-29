import { shell } from 'electron';

const SAFE_EXTERNAL_PROTOCOLS = new Set(['https:', 'http:']);

export function isSafeExternalUrl(value: string): boolean {
  try {
    const parsed = new URL(String(value || '').trim());
    return SAFE_EXTERNAL_PROTOCOLS.has(parsed.protocol) && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

export async function safeOpenExternal(value: string): Promise<boolean> {
  if (!isSafeExternalUrl(value)) return false;
  await shell.openExternal(value);
  return true;
}
