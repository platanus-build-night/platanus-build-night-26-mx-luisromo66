// bgClient.ts — Wrapper tipado sobre chrome.runtime.sendMessage (content -> background).
import type { Msg, MsgResponse, ScrollEvent, SiteId, UserConfig } from '../data/schema';

function send<T extends MsgResponse>(msg: Msg): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (resp) => {
      const err = chrome.runtime.lastError;
      if (err) return reject(new Error(err.message));
      resolve(resp as T);
    });
  });
}

export async function getConfig(): Promise<UserConfig> {
  const r = await send<Extract<MsgResponse, { kind: 'CONFIG' }>>({ kind: 'GET_CONFIG' });
  return r.config;
}

export function logEvent(event: ScrollEvent): void {
  // Fire-and-forget; el background persiste en IndexedDB.
  try {
    chrome.runtime.sendMessage({ kind: 'LOG_EVENT', event } satisfies Msg, () => void chrome.runtime.lastError);
  } catch {
    /* el SW puede estar dormido; se reintenta en el siguiente evento */
  }
}

export async function startCooldown(site: SiteId): Promise<number> {
  const r = await send<Extract<MsgResponse, { kind: 'COOLDOWN' }>>({ kind: 'START_COOLDOWN', site });
  return r.until;
}

export async function getCooldown(site: SiteId): Promise<number> {
  const r = await send<Extract<MsgResponse, { kind: 'COOLDOWN' }>>({ kind: 'GET_COOLDOWN', site });
  return r.until;
}

export async function getTodayMinutes(): Promise<number> {
  const r = await send<Extract<MsgResponse, { kind: 'STATS' }>>({ kind: 'GET_STATS' });
  return r.stats.todayMinutes;
}
