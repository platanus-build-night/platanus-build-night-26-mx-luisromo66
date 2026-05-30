// schema.ts — Tipos compartidos (config, eventos, mensajes, estado).
// PAQUETE COMPARTIDO: reusable por futuros hermanos Android/iOS.

// ---------------------------------------------------------------------------
// Sitios soportados
// ---------------------------------------------------------------------------
export type SiteId =
  | 'instagram'
  | 'tiktok'
  | 'twitter'
  | 'reddit'
  | 'youtube'
  | 'facebook';

export const SITE_LABELS: Record<SiteId, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  twitter: 'X / Twitter',
  reddit: 'Reddit',
  youtube: 'YouTube Shorts',
  facebook: 'Facebook',
};

// ---------------------------------------------------------------------------
// Configuración del usuario (metas + tuning)
// ---------------------------------------------------------------------------
export type EscalationIntensity = 'suave' | 'normal' | 'intenso';

export interface UserConfig {
  /** Minutos de pausa que reinician todo (15-30). */
  cooldownMinutes: number;
  /** Cada cuántos scrolls re-aparece el screamer dentro de un episodio. */
  retriggerEveryNScrolls: number;
  /** Umbral de doomScore para el primer trigger [0,1]. */
  doomThreshold: number;
  /** Items mínimos cargados (AND-gate) para el primer trigger. */
  minItemsForTrigger: number;
  /** Qué tan agresiva escala la fricción. */
  escalationIntensity: EscalationIntensity;
  /** Budget de minutos por día (espejo de uso). 0 = sin meta. */
  dailyBudgetMinutes: number;
  /** Budget de minutos por semana. 0 = sin meta. */
  weeklyBudgetMinutes: number;
  /** Sitios activos. */
  perSiteEnabled: Record<SiteId, boolean>;
  /** Plan if-then opcional (implementation intention). */
  ifThenPlan: string;
  /** Permitir sonido en el overlay. */
  soundEnabled: boolean;
  /** Capa IA: enviar agregados al proxy de Claude (opt-in). */
  aiEnabled: boolean;
  /** URL del proxy serverless que guarda la API key. */
  proxyUrl: string;
}

export const DEFAULT_CONFIG: UserConfig = {
  cooldownMinutes: 20,
  retriggerEveryNScrolls: 30,
  doomThreshold: 0.6,
  minItemsForTrigger: 15,
  escalationIntensity: 'normal',
  dailyBudgetMinutes: 60,
  weeklyBudgetMinutes: 0,
  perSiteEnabled: {
    instagram: true,
    tiktok: true,
    twitter: true,
    reddit: true,
    youtube: true,
    facebook: true,
  },
  ifThenPlan: '',
  soundEnabled: true,
  aiEnabled: false,
  proxyUrl: '',
};

export function clampCooldown(min: number): number {
  return Math.max(15, Math.min(30, Math.round(min)));
}

// ---------------------------------------------------------------------------
// Eventos (log append-only en IndexedDB)
// ---------------------------------------------------------------------------
export type SessionKind = 'quick_check' | 'passive_browse' | 'binge';
export type SessionEndReason = 'tab_hidden' | 'left_feed' | 'idle' | 'unload';
export type InterventionResponse =
  | 'dismissed'
  | 'accepted_break'
  | 'closed_feed'
  | 'ignored';

export interface BaseEvent {
  ts: number;
  site: SiteId;
}

export type ScrollEvent =
  | (BaseEvent & { type: 'session_start'; sessionId: string; entrySource: string })
  | (BaseEvent & {
      type: 'session_end';
      sessionId: string;
      endReason: SessionEndReason;
      kind: SessionKind;
      durationMs: number;
      scrollPx: number;
      itemsSeen: number;
    })
  | (BaseEvent & {
      type: 'scroll_tick';
      sessionId: string;
      dy: number;
      velocity: number;
      contentIndex: number;
    })
  | (BaseEvent & { type: 'content_impression'; sessionId: string; dwellMs: number })
  | (BaseEvent & {
      type: 'intervention_shown';
      sessionId: string;
      rule: 'first' | 'retrigger';
      level: number;
      doomScore: number;
    })
  | (BaseEvent & {
      type: 'intervention_response';
      sessionId: string;
      response: InterventionResponse;
      level: number;
      latencyMs: number;
    })
  | (BaseEvent & { type: 'goal_checkin'; metric: string; value: number; target: number })
  | (BaseEvent & { type: 'relapse'; sessionId: string; overPersonalP80By: number });

export type ScrollEventType = ScrollEvent['type'];

// ---------------------------------------------------------------------------
// Perfil semanal agregado (lo ÚNICO que sale del dispositivo)
// ---------------------------------------------------------------------------
export interface WeeklyProfile {
  weekOf: string;
  goals: { metric: string; target: number; adherence: number }[];
  totals: { scrollMinutes: number; sessions: number; vsLastWeekPct: number };
  streaks: { currentDays: number; longestDays: number; relapsesThisWeek: number };
  stateMix: { bingePct: number; bingeEpisodes: number; longestBingeMin: number };
  patterns: WeeklyPattern[];
  interventionEfficacy: { best: string; acceptRate: number };
  circadian: { interdailyStability: number; lateNightLoadPct: number };
}

export type WeeklyPattern =
  | { type: 'hotspot'; app: string; window: string; share: number; bingeRate: number }
  | { type: 'entry_trigger'; source: string; bingeShare: number }
  | { type: 'trend'; metric: string; deltaPct: number };

// Respuesta del LLM (tool-use JSON estricto)
export interface AIRecommendation {
  title: string;
  action: string;
  why: string;
  tied_to_pattern: string;
}
export interface AIDigest {
  celebration: string;
  insight: string;
  recommendations: AIRecommendation[];
  tone_check: string;
}

// ---------------------------------------------------------------------------
// Estado de cooldown (global-por-sitio, en chrome.storage)
// ---------------------------------------------------------------------------
export interface CooldownState {
  site: SiteId;
  /** Epoch ms en que termina el cooldown. 0/ausente = no en cooldown. */
  until: number;
}

// ---------------------------------------------------------------------------
// Protocolo de mensajes content <-> background
// ---------------------------------------------------------------------------
export type Msg =
  | { kind: 'GET_CONFIG' }
  | { kind: 'LOG_EVENT'; event: ScrollEvent }
  | { kind: 'START_COOLDOWN'; site: SiteId }
  | { kind: 'GET_COOLDOWN'; site: SiteId }
  | { kind: 'GET_DIGEST' }
  | { kind: 'GET_STATS' };

export type MsgResponse =
  | { kind: 'CONFIG'; config: UserConfig }
  | { kind: 'COOLDOWN'; until: number }
  | { kind: 'OK' }
  | { kind: 'DIGEST'; digest: AIDigest | null; error?: string }
  | { kind: 'STATS'; stats: DashboardStats };

// ---------------------------------------------------------------------------
// Stats para el popup
// ---------------------------------------------------------------------------
export interface DashboardStats {
  todayMinutes: number;
  weekMinutes: number;
  todaySessions: number;
  bingeEpisodesToday: number;
  interventionsToday: number;
  acceptRate: number;
  /** Heatmap 7 días x 24 horas, en minutos. heatmap[day][hour]. */
  heatmap: number[][];
  currentStreakDays: number;
}

export const STORAGE_KEYS = {
  config: 'si_config',
  cooldownPrefix: 'si_cooldown_',
  digestCache: 'si_digest_cache',
} as const;
