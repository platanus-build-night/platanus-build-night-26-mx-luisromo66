// stateMachine.ts — El core loop: WATCHING / INTERRUPT / COOLDOWN / RESET.
// Orquesta sensores + score + decisiones de trigger + cooldown + logging.
import type { InterventionResponse, SiteId, UserConfig } from '../data/schema';
import { computeDoomScore } from './doomScore';
import { ScrollSensor } from './scrollSensor';
import { FeedObserver } from './feedObserver';
import type { SiteAdapter } from './siteAdapters';
import * as bg from './bgClient';

export type MachineState = 'WATCHING' | 'INTERRUPT' | 'COOLDOWN';

export const MAX_LEVEL = 4;

export interface OverlayController {
  /** Muestra el screamer de un nivel; resuelve con la respuesta del usuario. */
  show(opts: { level: number; screens: number; budgetUsedMin?: number; budgetMin?: number; soundEnabled: boolean }): Promise<InterventionResponse>;
  hide(): void;
}

interface Deps {
  adapter: SiteAdapter;
  config: UserConfig;
  sensor: ScrollSensor;
  observer: FeedObserver;
  overlay: OverlayController;
  /** Devuelve true si el path actual sigue siendo un feed. */
  isFeedActive: () => boolean;
  /** Minutos consumidos hoy (para el espejo de uso en L4). 0 si no disponible. */
  getTodayMinutes?: () => number;
}

export class StateMachine {
  private d: Deps;
  state: MachineState = 'WATCHING';
  private sessionId = newId();
  private episodeStart = Date.now();
  private level = 0;
  private scrollsAtLastTrigger = 0;
  private interrupting = false;
  private tickHandle?: number;
  // Cooldown por INACTIVIDAD: el reset solo ocurre si dejas de scrollear 15-30 min.
  private lastActivityTs = Date.now();
  private lastScrollCount = 0;

  constructor(d: Deps) {
    this.d = d;
  }

  async start() {
    this.lastActivityTs = Date.now();

    bg.logEvent({
      type: 'session_start',
      ts: Date.now(),
      site: this.d.adapter.id,
      sessionId: this.sessionId,
      entrySource: document.referrer ? 'referral' : 'direct',
    });

    this.d.sensor.start();
    this.d.observer.start();
    this.tickHandle = window.setInterval(() => this.tick(), 1000);
  }

  stop() {
    if (this.tickHandle) clearInterval(this.tickHandle);
    this.d.sensor.stop();
    this.d.observer.stop();
    this.endSession('unload');
  }

  /** Llamado en cada cambio de ruta SPA. */
  onRouteChange(stillFeed: boolean) {
    if (!stillFeed && this.state !== 'COOLDOWN') {
      // Salir del feed cuenta como buen exit -> cooldown.
      this.goodExit('closed_feed');
    }
  }

  /** Tab oculto por un rato = buen exit. */
  onHidden() {
    if (this.state === 'INTERRUPT') return;
    if (this.state !== 'COOLDOWN') this.goodExit('closed_feed');
  }

  /** Reinicia el contador (scrolls, items, nivel) al instante. Útil para pruebas. */
  reset() {
    this.d.overlay.hide();
    this.resetEpisode();
    this.state = 'WATCHING';
    console.log('[Finite Scroll] contador reiniciado a mano (scrolls/items/nivel = 0)');
  }

  /** Dispara el screamer a mano (atajo de teclado / consola). Útil para demo. */
  async forceInterrupt() {
    if (this.interrupting) return;
    const { score, screens } = this.currentScore();
    console.log('[Finite Scroll] disparo manual del screamer');
    await this.fireInterrupt('first', Math.max(score, this.d.config.doomThreshold), screens);
  }

  private currentScore() {
    return computeDoomScore({
      activeFeedMs: Date.now() - this.episodeStart,
      scrollDistancePx: this.d.sensor.totalDistance,
      p95Velocity: this.d.sensor.p95Velocity(),
      itemsAppended: this.d.observer.itemsAppended,
      lowDwellRatio: this.d.observer.lowDwellRatio(),
    });
  }

  private async tick() {
    if (this.interrupting) return;
    if (!this.d.isFeedActive()) return;

    const { score, screens } = this.currentScore();
    const cfg = this.d.config;
    const scrolls = this.d.sensor.scrollCount;
    const now = Date.now();

    // Detecta actividad: si hubo scroll desde el último tick, marca actividad.
    if (scrolls > this.lastScrollCount) this.lastActivityTs = now;
    this.lastScrollCount = scrolls;

    // Cooldown POR INACTIVIDAD: si te detienes 15-30 min, se reinicia todo.
    const idleMs = now - this.lastActivityTs;
    const cooldownMs = cfg.cooldownMinutes * 60_000;
    if (this.level > 0 && idleMs >= cooldownMs) {
      console.log('[Finite Scroll] inactividad alcanzada -> reset (reinicia todo)');
      this.resetEpisode();
      this.state = 'COOLDOWN';
      return;
    }
    if (this.state === 'COOLDOWN' && idleMs < cooldownMs) this.state = 'WATCHING';

    if (score > 0.05 || scrolls > 0) {
      console.log(
        `[Finite Scroll] score=${score.toFixed(2)} items=${this.d.observer.itemsAppended} scrolls=${scrolls} idle=${Math.round(idleMs / 1000)}s state=${this.state} L=${this.level}`,
      );
    }

    // AND-gate principal: score alto + evidencia de feed infinito (items auto-cargados).
    // Fallback: si el conteo de items falla en un sitio (selectores que cambiaron),
    // un volumen alto de scroll también cuenta como evidencia, para no quedarnos mudos.
    const enoughEvidence =
      this.d.observer.itemsAppended >= cfg.minItemsForTrigger || scrolls >= cfg.minItemsForTrigger * 2;

    const firstTrigger = this.level === 0 && score >= cfg.doomThreshold && enoughEvidence;

    const reTrigger =
      this.level > 0 && scrolls - this.scrollsAtLastTrigger >= cfg.retriggerEveryNScrolls;

    if (firstTrigger || reTrigger) {
      this.scrollsAtLastTrigger = scrolls;
      await this.fireInterrupt(firstTrigger ? 'first' : 'retrigger', score, screens);
    }
  }

  private async fireInterrupt(rule: 'first' | 'retrigger', score: number, screens: number) {
    this.interrupting = true;
    this.state = 'INTERRUPT';
    this.level = Math.min(MAX_LEVEL, this.level + 1);

    bg.logEvent({
      type: 'intervention_shown',
      ts: Date.now(),
      site: this.d.adapter.id,
      sessionId: this.sessionId,
      rule,
      level: this.level,
      doomScore: Number(score.toFixed(3)),
    });

    const shownAt = Date.now();
    let response: InterventionResponse = 'ignored';
    try {
      response = await this.d.overlay.show({
        level: this.level,
        screens: Math.round(screens),
        budgetUsedMin: this.d.getTodayMinutes?.(),
        budgetMin: this.d.config.dailyBudgetMinutes || undefined,
        soundEnabled: this.d.config.soundEnabled,
      });
    } catch (e) {
      console.log('[Finite Scroll] error al mostrar el screamer:', e);
    } finally {
      // Siempre desbloquea, aunque el render falle, para no congelar la máquina.
      this.interrupting = false;
      this.state = 'WATCHING';
    }

    bg.logEvent({
      type: 'intervention_response',
      ts: Date.now(),
      site: this.d.adapter.id,
      sessionId: this.sessionId,
      response,
      level: this.level,
      latencyMs: Date.now() - shownAt,
    });

    // Sin inmunidad por botón: tanto "Ya terminé" como "Seguir" cierran el overlay
    // y volvemos a vigilar. Si sigues scrolleando, reaparece cada N scrolls.
    // Solo la INACTIVIDAD real (15-30 min) reinicia todo (ver tick()).
    if (response === 'accepted_break') {
      // Intención de parar: arranca el reloj de inactividad desde ahora.
      this.lastActivityTs = Date.now();
    }
  }

  /** Salida del feed (cambio de ruta / tab oculto): reinicia el episodio. */
  private goodExit(reason: InterventionResponse) {
    this.d.overlay.hide();
    this.endSession(reason === 'closed_feed' ? 'left_feed' : 'idle');
    this.resetEpisode();
    this.state = 'WATCHING';
  }

  private resetEpisode() {
    this.d.sensor.reset();
    this.d.observer.reset();
    this.episodeStart = Date.now();
    this.level = 0;
    this.scrollsAtLastTrigger = 0;
    this.lastScrollCount = 0;
    this.lastActivityTs = Date.now();
    this.sessionId = newId();
  }

  private endSession(endReason: 'tab_hidden' | 'left_feed' | 'idle' | 'unload') {
    const durationMs = Date.now() - this.episodeStart;
    const itemsSeen = this.d.observer.itemsAppended;
    const { score } = this.currentScore();
    const kind = score >= 0.6 ? 'binge' : score >= 0.2 ? 'passive_browse' : 'quick_check';
    bg.logEvent({
      type: 'session_end',
      ts: Date.now(),
      site: this.d.adapter.id,
      sessionId: this.sessionId,
      endReason,
      kind,
      durationMs,
      scrollPx: this.d.sensor.totalDistance,
      itemsSeen,
    });
  }
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function siteFromAdapter(id: SiteId): SiteId {
  return id;
}
