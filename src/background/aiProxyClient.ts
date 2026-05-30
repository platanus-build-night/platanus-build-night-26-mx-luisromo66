// aiProxyClient.ts — Envía el WeeklyProfile agregado al proxy serverless (que tiene
// la API key) y valida el JSON que devuelve Claude (schema + palabras prohibidas).
import type { AIDigest, WeeklyProfile } from '../data/schema';

const BANNED = ['adicción', 'adiccion', 'adicto', 'adicta', 'trastorno', 'fracaso', 'fracasaste', 'malo', 'mala'];

export class DigestError extends Error {}

export async function fetchDigest(proxyUrl: string, profile: WeeklyProfile): Promise<AIDigest> {
  if (!proxyUrl) throw new DigestError('No hay proxyUrl configurada (Opciones > Capa IA).');

  let resp: Response;
  try {
    resp = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profile }),
    });
  } catch (e) {
    throw new DigestError(`No se pudo contactar el proxy: ${(e as Error).message}`);
  }
  if (!resp.ok) throw new DigestError(`Proxy respondió ${resp.status}`);

  const data = (await resp.json()) as unknown;
  const digest = validateDigest(data);
  return digest;
}

function validateDigest(data: unknown): AIDigest {
  if (!data || typeof data !== 'object') throw new DigestError('Respuesta no es un objeto.');
  const d = data as Record<string, unknown>;
  if (typeof d.celebration !== 'string' || typeof d.insight !== 'string' || typeof d.tone_check !== 'string') {
    throw new DigestError('Faltan campos de texto en el digest.');
  }
  if (!Array.isArray(d.recommendations) || d.recommendations.length === 0) {
    throw new DigestError('El digest no trae recomendaciones.');
  }
  const recs = d.recommendations.map((r) => {
    const rr = r as Record<string, unknown>;
    if (typeof rr.title !== 'string' || typeof rr.action !== 'string' || typeof rr.why !== 'string') {
      throw new DigestError('Recomendación con formato inválido.');
    }
    return {
      title: rr.title,
      action: rr.action,
      why: rr.why,
      tied_to_pattern: typeof rr.tied_to_pattern === 'string' ? rr.tied_to_pattern : '',
    };
  });

  const digest: AIDigest = {
    celebration: d.celebration,
    insight: d.insight,
    recommendations: recs,
    tone_check: d.tone_check,
  };

  // Filtro de tono: nunca mostrar palabras que avergüencen/diagnostiquen.
  const blob = JSON.stringify(digest).toLowerCase();
  const hit = BANNED.find((w) => blob.includes(w));
  if (hit) throw new DigestError(`El digest usó una palabra prohibida ("${hit}"); se descartó.`);

  return digest;
}
