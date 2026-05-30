// serviceWorker.ts — Router de mensajes + alarms (cooldown/limpieza) + orquestación IA.
import type { Msg, MsgResponse } from '../data/schema';
import { getConfig } from './storage';
import { getCooldownUntil, startCooldown, clearCooldown, siteFromAlarm, rearmAlarms } from './cooldown';
import { appendEvent, getEventsSince, pruneOld } from '../data/eventLog';
import { computeStats } from '../data/rollups';
import { buildWeeklyProfile, seededProfile } from '../data/patternDetector';
import { fetchDigest, DigestError } from './aiProxyClient';

const PRUNE_ALARM = 'prune:daily';
const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;

chrome.runtime.onInstalled.addListener(() => {
  void rearmAlarms();
  void chrome.alarms.create(PRUNE_ALARM, { periodInMinutes: 24 * 60 });
});
chrome.runtime.onStartup.addListener(() => {
  void rearmAlarms();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === PRUNE_ALARM) {
    void pruneOld();
    return;
  }
  const site = siteFromAlarm(alarm.name);
  if (site) void clearCooldown(site);
});

chrome.runtime.onMessage.addListener((msg: Msg, _sender, sendResponse: (r: MsgResponse) => void) => {
  handle(msg)
    .then(sendResponse)
    .catch((e) => {
      console.debug('[Finite Scroll][bg] error', e);
      sendResponse({ kind: 'OK' });
    });
  return true; // respuesta asíncrona
});

async function handle(msg: Msg): Promise<MsgResponse> {
  switch (msg.kind) {
    case 'GET_CONFIG':
      return { kind: 'CONFIG', config: await getConfig() };

    case 'LOG_EVENT':
      await appendEvent(msg.event);
      return { kind: 'OK' };

    case 'START_COOLDOWN':
      return { kind: 'COOLDOWN', until: await startCooldown(msg.site) };

    case 'GET_COOLDOWN':
      return { kind: 'COOLDOWN', until: await getCooldownUntil(msg.site) };

    case 'GET_STATS':
      return { kind: 'STATS', stats: await computeStats() };

    case 'GET_DIGEST':
      return getDigest();
  }
}

async function getDigest(): Promise<MsgResponse> {
  const config = await getConfig();
  try {
    const events = await getEventsSince(Date.now() - FOURTEEN_DAYS);
    const real = buildWeeklyProfile(events, config);
    // Si hay pocos datos, usa el perfil sembrado para que la demo siempre funcione.
    const profile = real.totals.sessions >= 5 ? real : seededProfile();
    const digest = await fetchDigest(config.proxyUrl, profile);
    return { kind: 'DIGEST', digest };
  } catch (e) {
    const msg = e instanceof DigestError ? e.message : (e as Error).message;
    return { kind: 'DIGEST', digest: null, error: msg };
  }
}
