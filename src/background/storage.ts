// storage.ts — Config del usuario en chrome.storage.local (con defaults).
import { DEFAULT_CONFIG, STORAGE_KEYS, clampCooldown } from '../data/schema';
import type { UserConfig } from '../data/schema';

export async function getConfig(): Promise<UserConfig> {
  const raw = await chrome.storage.local.get(STORAGE_KEYS.config);
  const stored = (raw[STORAGE_KEYS.config] ?? {}) as Partial<UserConfig>;
  return {
    ...DEFAULT_CONFIG,
    ...stored,
    perSiteEnabled: { ...DEFAULT_CONFIG.perSiteEnabled, ...(stored.perSiteEnabled ?? {}) },
    cooldownMinutes: clampCooldown(stored.cooldownMinutes ?? DEFAULT_CONFIG.cooldownMinutes),
  };
}

export async function setConfig(patch: Partial<UserConfig>): Promise<UserConfig> {
  const current = await getConfig();
  const next: UserConfig = {
    ...current,
    ...patch,
    perSiteEnabled: { ...current.perSiteEnabled, ...(patch.perSiteEnabled ?? {}) },
    cooldownMinutes: clampCooldown(patch.cooldownMinutes ?? current.cooldownMinutes),
  };
  await chrome.storage.local.set({ [STORAGE_KEYS.config]: next });
  return next;
}
