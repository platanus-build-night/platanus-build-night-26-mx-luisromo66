// overlayHost.ts — El screamer absurdo en Shadow DOM. Implementa OverlayController.
// inset:0, z-index máximo, salida SIEMPRE visible. Sin terror, sin flashes >3/seg.
import type { InterventionResponse } from '../../data/schema';
import type { OverlayController } from '../stateMachine';
import { getLevelSpec, pickSubtitle } from './levels';
import { prefersReducedMotion } from './a11y';
import { initScreamerAudio, playScreamerSound, stopScreamerSound } from './audioUnlock';
import type { UserConfig } from '../../data/schema';

const HOST_ID = 'finite-scroll-overlay-host';

export class ScreamerOverlay implements OverlayController {
  private host?: HTMLElement;
  private resolveCurrent?: (r: InterventionResponse) => void;
  private cfg: UserConfig;
  private timers: number[] = [];
  private pausedMedia: HTMLMediaElement[] = [];

  constructor(cfg: UserConfig) {
    this.cfg = cfg;
    // Prepara el audio persistente y engancha el cebado al primer gesto del usuario.
    try {
      initScreamerAudio(chrome.runtime.getURL('assets/screamer.mp4'));
    } catch {
      /* fuera de contexto de extensión */
    }
  }

  show(opts: { level: number; screens: number; budgetUsedMin?: number; budgetMin?: number; soundEnabled: boolean }): Promise<InterventionResponse> {
    this.hide(); // limpia cualquier overlay previo
    this.pausePageMedia(); // silencia el Short/feed para que el screamer tome el control
    return new Promise<InterventionResponse>((resolve) => {
      this.resolveCurrent = resolve;
      this.render(opts);
    });
  }

  hide() {
    this.clearTimers();
    stopScreamerSound();
    this.host?.remove();
    this.host = undefined;
    this.resolveCurrent = undefined;
    this.resumePageMedia();
  }

  /** Pausa todo video/audio que esté sonando en la página (el Short de fondo). */
  private pausePageMedia() {
    this.pausedMedia = [];
    document.querySelectorAll<HTMLMediaElement>('video, audio').forEach((m) => {
      if (!m.paused && !m.ended) {
        try {
          m.pause();
          this.pausedMedia.push(m);
        } catch {
          /* algunos players bloquean pause() */
        }
      }
    });
  }

  /** Reanuda lo que pausamos cuando se cierra el screamer. */
  private resumePageMedia() {
    this.pausedMedia.forEach((m) => void m.play().catch(() => {}));
    this.pausedMedia = [];
  }

  private finish(r: InterventionResponse) {
    const resolve = this.resolveCurrent;
    this.hide();
    resolve?.(r);
  }

  private clearTimers() {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
  }

  private render(opts: { level: number; screens: number; budgetUsedMin?: number; budgetMin?: number; soundEnabled?: boolean }) {
    const reduced = prefersReducedMotion();
    const spec = getLevelSpec(opts.level, this.cfg.escalationIntensity);
    const subtitle = pickSubtitle(spec, opts.screens);

    const host = document.createElement('div');
    host.id = HOST_ID;
    host.style.cssText = 'all: initial; position: fixed; inset: 0; z-index: 2147483647;';
    const root = host.attachShadow({ mode: 'open' });
    this.host = host;

    // Video del screamer (empaquetado en assets/). Se reproduce siempre.
    const videoUrl = chrome.runtime.getURL('assets/screamer.mp4');

    const mirror =
      spec.showUsageMirror && opts.budgetMin
        ? `<div class="mirror">Hoy: <b>${opts.budgetUsedMin ?? 0} min</b> / meta ${opts.budgetMin} min</div>`
        : spec.showUsageMirror && opts.budgetUsedMin
          ? `<div class="mirror">Hoy llevas <b>${opts.budgetUsedMin} min</b> de scroll</div>`
          : '';

    // El modal SIEMPRE se ve como nivel 4 (tamaño, oscurecimiento y blur fijos):
    // todos los niveles lucen idénticos. La escalada solo se nota en fricción y copy.
    const VISUAL_LEVEL = 4;
    const videoMax = 220 + VISUAL_LEVEL * 60;
    const backdropAlpha = 0.55 + VISUAL_LEVEL * 0.1;
    const backdropBlur = 2 + VISUAL_LEVEL * 2;

    const template = `
      <style>
        :host { all: initial; }
        .backdrop {
          position: fixed; inset: 0;
          display: flex; align-items: center; justify-content: center;
          background: rgba(8, 10, 20, ${backdropAlpha});
          backdrop-filter: blur(${backdropBlur}px);
          font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
          color: #fff; text-align: center; padding: 24px;
          ${reduced ? '' : 'animation: si-fade 0.25s ease-out;'}
        }
        .card {
          max-width: 520px; width: 100%;
          background: linear-gradient(160deg, #1b2240, #2a1f4d);
          border: 2px solid #6c5ce7; border-radius: 22px;
          padding: 28px 26px 22px; box-shadow: 0 20px 60px rgba(0,0,0,.5);
        }
        .video-wrap { position: relative; display:flex; justify-content:center; }
        video.screamer {
          width: 100%; max-width: ${videoMax}px; border-radius: 16px;
          background: #000; box-shadow: 0 10px 30px rgba(0,0,0,.5);
        }
        .sound-btn {
          position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%);
          background: #e17055; color: #fff; font-weight: 700; font-size: .9rem;
          border: 0; border-radius: 999px; padding: 8px 16px; cursor: pointer;
          box-shadow: 0 4px 14px rgba(0,0,0,.4); animation: si-pulse 1.2s ease-in-out infinite;
        }
        @keyframes si-pulse { 0%,100% { transform: translateX(-50%) scale(1) } 50% { transform: translateX(-50%) scale(1.07) } }
        h1 { font-size: 1.55rem; margin: 14px 0 6px; }
        p.sub { font-size: 1.05rem; opacity: .9; margin: 0 0 14px; }
        .mirror { font-size: .95rem; background: rgba(255,255,255,.08); border-radius: 10px; padding: 8px 12px; margin: 0 0 16px; }
        .btns { display: flex; flex-direction: column; gap: 10px; }
        button { font: inherit; font-size: 1rem; padding: 13px 16px; border-radius: 12px; border: 0; cursor: pointer; }
        .primary { background: #00b894; color: #04241c; font-weight: 700; }
        .primary:hover { filter: brightness(1.08); }
        .secondary { background: rgba(255,255,255,.1); color: #fff; }
        .secondary[disabled] { opacity: .45; cursor: not-allowed; }
        .hold { background: rgba(255,255,255,.1); color:#fff; position:relative; overflow:hidden; }
        .hold .fill { position:absolute; inset:0; background:#e17055; width:0%; }
        .hold span { position: relative; z-index: 1; }
        .foot { margin-top: 12px; font-size: .8rem; opacity: .6; }
        @keyframes si-bounce { from { transform: translateY(0) } to { transform: translateY(-18px) } }
        @keyframes si-spin { to { transform: rotate(360deg) } }
        @keyframes si-fade { from { opacity: 0 } to { opacity: 1 } }
      </style>
      <div class="backdrop" role="dialog" aria-modal="true" aria-label="Pausa de scroll">
        <div class="card">
          <div class="video-wrap">
            <video class="screamer" src="${videoUrl}" loop playsinline></video>
            <button class="sound-btn" data-act="unmute" style="display:none">🔊 toca para sonido</button>
          </div>
          <h1>${spec.title}</h1>
          <p class="sub">${escapeHtml(subtitle)}</p>
          ${mirror}
          <div class="btns">
            <button class="primary" data-act="break">✋ Ya terminé / tomar pausa</button>
            ${spec.holdToContinue
              ? `<button class="hold" data-act="hold"><span class="lbl">Mantén presionado para seguir…</span><div class="fill"></div></button>`
              : `<button class="secondary" data-act="continue" ${spec.frictionSec > 0 ? 'disabled' : ''}>Seguir scrolleando${spec.frictionSec > 0 ? ` (${spec.frictionSec})` : ''}</button>`}
          </div>
          <div class="foot">Finite Scroll · nivel ${opts.level}</div>
        </div>
      </div>
    `;

    // Instagram/Facebook fuerzan Trusted Types y bloquean innerHTML directo.
    setShadowHTML(root, template);
    document.documentElement.appendChild(host);
    this.wire(root, spec);
  }

  private wire(root: ShadowRoot, spec: ReturnType<typeof getLevelSpec>) {
    // El video va SIEMPRE mudo (solo visual, autoplay garantizado). El sonido sale
    // del elemento de audio persistente que ya fue "bendecido" por un gesto previo.
    const video = root.querySelector<HTMLVideoElement>('video.screamer');
    const soundBtn = root.querySelector<HTMLButtonElement>('[data-act="unmute"]');
    if (video) {
      video.muted = true;
      void video.play().catch(() => {});
    }

    // Siempre intenta sonar; si el audio no fue desbloqueado por un gesto, ofrece el botón.
    playScreamerSound().catch(() => {
      if (soundBtn) soundBtn.style.display = 'block';
    });
    soundBtn?.addEventListener('click', () => {
      void playScreamerSound();
      soundBtn.style.display = 'none';
    });

    const breakBtn = root.querySelector<HTMLButtonElement>('[data-act="break"]');
    breakBtn?.addEventListener('click', () => this.finish('accepted_break'));

    // Botón "Seguir" con fricción/countdown.
    const cont = root.querySelector<HTMLButtonElement>('[data-act="continue"]');
    if (cont) {
      let remaining = spec.frictionSec;
      if (remaining > 0) {
        const tick = () => {
          remaining -= 1;
          if (remaining <= 0) {
            cont.disabled = false;
            cont.textContent = 'Seguir scrolleando';
          } else {
            cont.textContent = `Seguir scrolleando (${remaining})`;
            this.timers.push(window.setTimeout(tick, 1000));
          }
        };
        this.timers.push(window.setTimeout(tick, 1000));
      }
      cont.addEventListener('click', () => {
        if (!cont.disabled) this.finish('dismissed');
      });
    }

    // Hold-para-continuar (L4).
    const hold = root.querySelector<HTMLButtonElement>('[data-act="hold"]');
    if (hold) {
      const fill = hold.querySelector<HTMLElement>('.fill');
      const lbl = hold.querySelector<HTMLElement>('.lbl');
      const HOLD_MS = 1800;
      let startT = 0;
      let raf = 0;
      const step = () => {
        const pct = Math.min(100, ((performance.now() - startT) / HOLD_MS) * 100);
        if (fill) fill.style.width = `${pct}%`;
        if (pct >= 100) {
          this.finish('dismissed');
          return;
        }
        raf = requestAnimationFrame(step);
      };
      const startHold = (e: Event) => {
        e.preventDefault();
        startT = performance.now();
        raf = requestAnimationFrame(step);
      };
      const cancelHold = () => {
        cancelAnimationFrame(raf);
        if (fill) fill.style.width = '0%';
        if (lbl) lbl.textContent = 'Mantén presionado para seguir…';
      };
      hold.addEventListener('pointerdown', startHold);
      hold.addEventListener('pointerup', cancelHold);
      hold.addEventListener('pointerleave', cancelHold);
    }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
}

// Política de Trusted Types reutilizable (Instagram/Facebook la exigen).
let ttPolicy: { createHTML: (s: string) => unknown } | null | undefined;
function getTTPolicy() {
  if (ttPolicy !== undefined) return ttPolicy;
  const tt = (window as unknown as { trustedTypes?: { createPolicy: (n: string, r: object) => { createHTML: (s: string) => unknown } } }).trustedTypes;
  try {
    ttPolicy = tt ? tt.createPolicy('finite-scroll', { createHTML: (s: string) => s }) : null;
  } catch {
    ttPolicy = null; // el sitio bloquea crear políticas con allowlist
  }
  return ttPolicy;
}

/** Asigna HTML al shadow root sorteando Trusted Types; si todo falla, construye por DOM. */
function setShadowHTML(root: ShadowRoot, html: string) {
  const policy = getTTPolicy();
  try {
    (root as unknown as { innerHTML: unknown }).innerHTML = policy ? policy.createHTML(html) : html;
    return;
  } catch {
    // Trusted Types bloqueó incluso la política con nombre: parsea fuera y clona.
  }
  try {
    const parsed = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
    const wrapper = parsed.body.firstElementChild;
    if (wrapper) {
      while (wrapper.firstChild) root.appendChild(wrapper.firstChild);
    }
  } catch (e) {
    console.log('[Finite Scroll] no se pudo renderizar el overlay:', e);
  }
}
