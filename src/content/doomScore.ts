// doomScore.ts — Combina las señales en un score explicable [0,1].
// Cada término se normaliza con clamp((x-soft)/(hard-soft)) y se pondera.

export interface DoomSignals {
  /** Tiempo activo en el feed durante el episodio (ms). */
  activeFeedMs: number;
  /** Distancia total scrolleada (px). */
  scrollDistancePx: number;
  /** Velocidad p95 (px/s). */
  p95Velocity: number;
  /** Items cargados por auto-append en el episodio. */
  itemsAppended: number;
  /** Fracción de impresiones de baja permanencia [0,1]. */
  lowDwellRatio: number;
}

interface Term {
  soft: number;
  hard: number;
  weight: number;
}

// Umbrales (live-tunables para el demo). soft = empieza a contar; hard = satura.
export const DOOM_TERMS = {
  activeFeedSec: { soft: 20, hard: 180, weight: 0.3 } as Term, // 20s..3min
  screens: { soft: 3, hard: 25, weight: 0.25 } as Term, // pantallas scrolleadas
  p95Velocity: { soft: 800, hard: 6000, weight: 0.2 } as Term, // px/s
  items: { soft: 5, hard: 40, weight: 0.15 } as Term,
  lowDwell: { soft: 0.2, hard: 0.8, weight: 0.1 } as Term,
};

function norm(x: number, t: Term): number {
  if (t.hard === t.soft) return x >= t.hard ? 1 : 0;
  return Math.max(0, Math.min(1, (x - t.soft) / (t.hard - t.soft)));
}

export interface DoomResult {
  score: number;
  /** Desglose por término (para debug/tuning en vivo). */
  breakdown: Record<string, number>;
  /** Pantallas scrolleadas (útil para el copy del overlay). */
  screens: number;
}

export function computeDoomScore(s: DoomSignals): DoomResult {
  const screens = s.scrollDistancePx / Math.max(1, window.innerHeight);
  const terms = {
    activeFeed: norm(s.activeFeedMs / 1000, DOOM_TERMS.activeFeedSec) * DOOM_TERMS.activeFeedSec.weight,
    screens: norm(screens, DOOM_TERMS.screens) * DOOM_TERMS.screens.weight,
    velocity: norm(s.p95Velocity, DOOM_TERMS.p95Velocity) * DOOM_TERMS.p95Velocity.weight,
    items: norm(s.itemsAppended, DOOM_TERMS.items) * DOOM_TERMS.items.weight,
    lowDwell: norm(s.lowDwellRatio, DOOM_TERMS.lowDwell) * DOOM_TERMS.lowDwell.weight,
  };
  const score = Object.values(terms).reduce((a, b) => a + b, 0);
  return { score: Math.min(1, score), breakdown: terms, screens };
}
