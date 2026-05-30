// rollups.ts — Agrega eventos crudos en stats para el popup (espejo de uso).
import type { DashboardStats, ScrollEvent } from './schema';
import { getEventsSince } from './eventLog';

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export async function computeStats(now = Date.now()): Promise<DashboardStats> {
  const weekStart = startOfDay(now) - 6 * DAY_MS;
  const events = await getEventsSince(weekStart);
  const todayStart = startOfDay(now);

  let todayMinutes = 0;
  let weekMinutes = 0;
  let todaySessions = 0;
  let bingeEpisodesToday = 0;
  let interventionsToday = 0;
  let respToday = 0;
  let acceptedToday = 0;

  // Heatmap: 7 días (0 = hace 6 días … 6 = hoy) x 24 horas, en minutos.
  const heatmap: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));

  // Para streak: set de días (epoch de inicio) con binge.
  const bingeDays = new Set<number>();

  for (const ev of events) {
    const isToday = ev.ts >= todayStart;
    if (ev.type === 'session_end') {
      const mins = ev.durationMs / 60_000;
      weekMinutes += mins;
      if (isToday) {
        todayMinutes += mins;
        todaySessions += 1;
        if (ev.kind === 'binge') bingeEpisodesToday += 1;
      }
      if (ev.kind === 'binge') bingeDays.add(startOfDay(ev.ts));
      const dayIdx = Math.floor((startOfDay(ev.ts) - weekStart) / DAY_MS);
      const hour = new Date(ev.ts).getHours();
      if (dayIdx >= 0 && dayIdx < 7) heatmap[dayIdx][hour] += mins;
    } else if (ev.type === 'intervention_shown' && isToday) {
      interventionsToday += 1;
    } else if (ev.type === 'intervention_response' && isToday) {
      respToday += 1;
      if (ev.response === 'accepted_break' || ev.response === 'closed_feed') acceptedToday += 1;
    }
  }

  // Streak: días consecutivos (terminando hoy) SIN binge.
  let currentStreakDays = 0;
  for (let i = 0; ; i++) {
    const day = startOfDay(now) - i * DAY_MS;
    if (bingeDays.has(day)) break;
    currentStreakDays += 1;
    if (i > 365) break;
  }

  return {
    todayMinutes: Math.round(todayMinutes),
    weekMinutes: Math.round(weekMinutes),
    todaySessions,
    bingeEpisodesToday,
    interventionsToday,
    acceptRate: respToday > 0 ? acceptedToday / respToday : 0,
    heatmap,
    currentStreakDays,
  };
}

/** Minutos de scroll de hoy (para el espejo de uso del overlay). */
export async function todayMinutes(now = Date.now()): Promise<number> {
  const stats = await computeStats(now);
  return stats.todayMinutes;
}

export function emptyEvents(): ScrollEvent[] {
  return [];
}
