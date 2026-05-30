// patternDetector.ts — Convierte eventos crudos en un WeeklyProfile compacto.
// Este JSON agregado es lo ÚNICO que sale del dispositivo (hacia Claude).
import type { ScrollEvent, UserConfig, WeeklyPattern, WeeklyProfile } from './schema';
import { SITE_LABELS } from './schema';

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
const isLateNight = (h: number) => h >= 23 || h < 5;

function weekLabel(ts: number): string {
  const d = new Date(startOfDay(ts) - 6 * DAY_MS);
  return d.toISOString().slice(0, 10);
}

/** events = últimos ~14 días. Divide en semana actual vs anterior. */
export function buildWeeklyProfile(events: ScrollEvent[], config: UserConfig, now = Date.now()): WeeklyProfile {
  const thisWeekStart = startOfDay(now) - 6 * DAY_MS;
  const lastWeekStart = thisWeekStart - 7 * DAY_MS;

  const thisWeek = events.filter((e) => e.ts >= thisWeekStart);
  const lastWeek = events.filter((e) => e.ts >= lastWeekStart && e.ts < thisWeekStart);

  const sessions = thisWeek.filter((e): e is Extract<ScrollEvent, { type: 'session_end' }> => e.type === 'session_end');
  const lastSessions = lastWeek.filter((e): e is Extract<ScrollEvent, { type: 'session_end' }> => e.type === 'session_end');

  const totalMin = sumMinutes(sessions);
  const lastMin = sumMinutes(lastSessions);
  const vsLastWeekPct = lastMin > 0 ? Math.round(((totalMin - lastMin) / lastMin) * 100) : 0;

  const bingeSessions = sessions.filter((s) => s.kind === 'binge');
  const bingeMin = sumMinutes(bingeSessions);
  const longestBingeMin = Math.round(Math.max(0, ...bingeSessions.map((s) => s.durationMs / 60_000)));

  // Hotspot: (sitio, ventana horaria) con más minutos de binge.
  const hotspot = topHotspot(bingeSessions);

  // Trend: carga nocturna esta semana vs anterior.
  const lateThis = lateNightMinutes(sessions);
  const lateLast = lateNightMinutes(lastSessions);
  const lateDelta = lateLast > 0 ? Math.round(((lateThis - lateLast) / lateLast) * 100) : lateThis > 0 ? 100 : 0;

  // Intervention efficacy.
  const responses = thisWeek.filter((e): e is Extract<ScrollEvent, { type: 'intervention_response' }> => e.type === 'intervention_response');
  const accepted = responses.filter((r) => r.response === 'accepted_break' || r.response === 'closed_feed');
  const acceptRate = responses.length > 0 ? round2(accepted.length / responses.length) : 0;

  // Adherencia a meta diaria.
  const adherence = goalAdherence(sessions, config.dailyBudgetMinutes, now);

  const patterns: WeeklyPattern[] = [];
  if (hotspot) patterns.push(hotspot);
  if (Math.abs(lateDelta) >= 10) patterns.push({ type: 'trend', metric: 'late_night_load', deltaPct: lateDelta });

  return {
    weekOf: weekLabel(now),
    goals: config.dailyBudgetMinutes
      ? [{ metric: 'daily_scroll_minutes', target: config.dailyBudgetMinutes, adherence }]
      : [],
    totals: { scrollMinutes: Math.round(totalMin), sessions: sessions.length, vsLastWeekPct },
    streaks: {
      currentDays: currentStreak(sessions, now),
      longestDays: currentStreak(sessions, now), // aproximación para MVP
      relapsesThisWeek: thisWeek.filter((e) => e.type === 'relapse').length,
    },
    stateMix: {
      bingePct: totalMin > 0 ? round2(bingeMin / totalMin) : 0,
      bingeEpisodes: bingeSessions.length,
      longestBingeMin,
    },
    patterns,
    interventionEfficacy: { best: 'pausa_respiración', acceptRate },
    circadian: {
      interdailyStability: round2(interdailyStability(sessions)),
      lateNightLoadPct: totalMin > 0 ? round2(lateThis / totalMin) : 0,
    },
  };
}

function sumMinutes(s: Extract<ScrollEvent, { type: 'session_end' }>[]): number {
  return s.reduce((a, e) => a + e.durationMs / 60_000, 0);
}
function lateNightMinutes(s: Extract<ScrollEvent, { type: 'session_end' }>[]): number {
  return s.filter((e) => isLateNight(new Date(e.ts).getHours())).reduce((a, e) => a + e.durationMs / 60_000, 0);
}
function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function topHotspot(binge: Extract<ScrollEvent, { type: 'session_end' }>[]): WeeklyPattern | null {
  if (binge.length === 0) return null;
  const buckets = new Map<string, { app: string; window: string; min: number; count: number }>();
  for (const s of binge) {
    const h = new Date(s.ts).getHours();
    const window = `${pad(h)}:00-${pad((h + 2) % 24)}:00`;
    const k = `${s.site}|${window}`;
    const b = buckets.get(k) ?? { app: SITE_LABELS[s.site], window, min: 0, count: 0 };
    b.min += s.durationMs / 60_000;
    b.count += 1;
    buckets.set(k, b);
  }
  const top = [...buckets.values()].sort((a, b) => b.min - a.min)[0];
  const totalBinge = sumMinutes(binge);
  return {
    type: 'hotspot',
    app: top.app,
    window: top.window,
    share: round2(top.min / totalBinge),
    bingeRate: round2(top.count / binge.length),
  };
}

function goalAdherence(sessions: Extract<ScrollEvent, { type: 'session_end' }>[], budget: number, now: number): number {
  if (!budget) return 1;
  const byDay = new Map<number, number>();
  for (const s of sessions) {
    const day = startOfDay(s.ts);
    byDay.set(day, (byDay.get(day) ?? 0) + s.durationMs / 60_000);
  }
  let ok = 0;
  for (let i = 0; i < 7; i++) {
    const day = startOfDay(now) - i * DAY_MS;
    if ((byDay.get(day) ?? 0) <= budget) ok += 1;
  }
  return round2(ok / 7);
}

function currentStreak(sessions: Extract<ScrollEvent, { type: 'session_end' }>[], now: number): number {
  const bingeDays = new Set(sessions.filter((s) => s.kind === 'binge').map((s) => startOfDay(s.ts)));
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const day = startOfDay(now) - i * DAY_MS;
    if (bingeDays.has(day)) break;
    streak += 1;
  }
  return streak;
}

function interdailyStability(sessions: Extract<ScrollEvent, { type: 'session_end' }>[]): number {
  // Proxy simple: fracción de días activos en la semana.
  const days = new Set(sessions.map((s) => startOfDay(s.ts)));
  return Math.min(1, days.size / 7);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Perfil sembrado para que la tarjeta de IA siempre demuestre. */
export function seededProfile(): WeeklyProfile {
  return {
    weekOf: '2026-05-25',
    goals: [{ metric: 'daily_scroll_minutes', target: 60, adherence: 0.57 }],
    totals: { scrollMinutes: 612, sessions: 143, vsLastWeekPct: -8 },
    streaks: { currentDays: 3, longestDays: 11, relapsesThisWeek: 2 },
    stateMix: { bingePct: 0.31, bingeEpisodes: 9, longestBingeMin: 74 },
    patterns: [
      { type: 'hotspot', app: 'TikTok', window: '23:00-01:00', share: 0.42, bingeRate: 0.7 },
      { type: 'entry_trigger', source: 'notificación push', bingeShare: 0.61 },
      { type: 'trend', metric: 'late_night_load', deltaPct: 15 },
    ],
    interventionEfficacy: { best: 'pausa_respiración', acceptRate: 0.48 },
    circadian: { interdailyStability: 0.4, lateNightLoadPct: 0.34 },
  };
}
