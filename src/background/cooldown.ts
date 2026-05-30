// cooldown.ts — Estado de cooldown GLOBAL-POR-SITIO (anti-evasión multi-tab).
// Se guarda en chrome.storage para que una segunda pestaña no lo esquive,
// y se respaldan con chrome.alarms para re-armar tras reiniciar el navegador.
import { STORAGE_KEYS } from '../data/schema';
import type { SiteId } from '../data/schema';
import { getConfig } from './storage';

const key = (site: SiteId) => `${STORAGE_KEYS.cooldownPrefix}${site}`;
const alarmName = (site: SiteId) => `cooldown:${site}`;

export async function getCooldownUntil(site: SiteId): Promise<number> {
  const raw = await chrome.storage.local.get(key(site));
  const until = (raw[key(site)] as number) ?? 0;
  return until > Date.now() ? until : 0;
}

export async function startCooldown(site: SiteId): Promise<number> {
  const cfg = await getConfig();
  const until = Date.now() + cfg.cooldownMinutes * 60_000;
  await chrome.storage.local.set({ [key(site)]: until });
  await chrome.alarms.create(alarmName(site), { when: until });
  return until;
}

/** Limpia el estado cuando expira el alarm. */
export async function clearCooldown(site: SiteId): Promise<void> {
  await chrome.storage.local.remove(key(site));
}

export function siteFromAlarm(name: string): SiteId | null {
  if (!name.startsWith('cooldown:')) return null;
  return name.slice('cooldown:'.length) as SiteId;
}

/** Re-arma alarms vigentes al iniciar el SW (tras reinicio del navegador). */
export async function rearmAlarms(): Promise<void> {
  const all = await chrome.storage.local.get(null);
  for (const [k, v] of Object.entries(all)) {
    if (!k.startsWith(STORAGE_KEYS.cooldownPrefix)) continue;
    const site = k.slice(STORAGE_KEYS.cooldownPrefix.length) as SiteId;
    const until = v as number;
    if (until > Date.now()) {
      await chrome.alarms.create(alarmName(site), { when: until });
    } else {
      await chrome.storage.local.remove(k);
    }
  }
}
