// uiClient.ts — Helper de mensajería para las páginas de extensión (popup/options).
import type { Msg, MsgResponse, DashboardStats, AIDigest } from '../data/schema';

function send<T extends MsgResponse>(msg: Msg): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (resp) => {
      const err = chrome.runtime.lastError;
      if (err) return reject(new Error(err.message));
      resolve(resp as T);
    });
  });
}

export async function getStats(): Promise<DashboardStats> {
  const r = await send<Extract<MsgResponse, { kind: 'STATS' }>>({ kind: 'GET_STATS' });
  return r.stats;
}

export async function getDigest(): Promise<{ digest: AIDigest | null; error?: string }> {
  const r = await send<Extract<MsgResponse, { kind: 'DIGEST' }>>({ kind: 'GET_DIGEST' });
  return { digest: r.digest, error: r.error };
}
