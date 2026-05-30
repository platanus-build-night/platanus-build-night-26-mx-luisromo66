// index.ts — Bootstrap del content script.
// Detecta el sitio, hookea el SPA routing y arranca la máquina de estados.
import { getAdapterForHost } from './siteAdapters';
import { ScrollSensor } from './scrollSensor';
import { FeedObserver } from './feedObserver';
import { StateMachine } from './stateMachine';
import { ScreamerOverlay } from './overlay/overlayHost';
import { showSoundPrompt } from './soundPrompt';
import * as bg from './bgClient';

// Log inmediato al inyectarse (antes de cualquier bail-out), siempre visible.
console.log('%c[SCROLL_INFINITO]', 'color:#6c5ce7;font-weight:bold', 'content script inyectado en', location.host, location.pathname);

async function main() {
  const adapter = getAdapterForHost(location.host);
  if (!adapter) {
    console.log('[SCROLL_INFINITO] host no soportado:', location.host);
    return;
  }

  const config = await bg.getConfig().catch((e) => {
    console.log('[SCROLL_INFINITO] no se pudo leer la config (¿service worker caído?):', e);
    return null;
  });
  if (!config) return;
  if (!config.perSiteEnabled[adapter.id]) {
    console.log('[SCROLL_INFINITO] sitio desactivado en Opciones:', adapter.id);
    return;
  }

  console.log('[SCROLL_INFINITO] activo en', adapter.id, '· feed actual:', adapter.isFeedPath(location.pathname));

  // Pide activar el sonido con un clic (desbloquea el audio del screamer para la sesión).
  // Siempre se ofrece; el usuario puede cerrarlo con la ✕.
  showSoundPrompt();

  const sensor = new ScrollSensor(200);
  const observer = new FeedObserver(adapter);
  const overlay = new ScreamerOverlay(config);

  const isFeedActive = () => adapter.isFeedPath(location.pathname);

  // Espejo de uso: cacheamos los minutos de hoy (refresco cada 60s) para mostrarlos
  // en el overlay L3/L4 sin pedirlos en caliente al disparar.
  let todayMinutes = 0;
  const refreshMinutes = () => bg.getTodayMinutes().then((m) => (todayMinutes = m)).catch(() => {});
  void refreshMinutes();
  window.setInterval(refreshMinutes, 60_000);

  const machine = new StateMachine({
    adapter,
    config,
    sensor,
    observer,
    overlay,
    isFeedActive,
    getTodayMinutes: () => todayMinutes,
  });

  await machine.start();

  // --- SPA routing: los feeds nunca hacen full-reload. Hookeamos history. ---
  let lastPath = location.pathname;
  const notifyRoute = () => {
    if (location.pathname === lastPath) return;
    lastPath = location.pathname;
    const stillFeed = isFeedActive();
    // En Shorts/Reels cada avance cambia la URL: cuéntalo como consumo (scroll + item),
    // porque no siempre se disparan eventos de scroll/wheel.
    if (stillFeed) {
      sensor.pump(1);
      observer.bumpItems(1);
    }
    machine.onRouteChange(stillFeed);
  };
  const origPush = history.pushState.bind(history);
  const origReplace = history.replaceState.bind(history);
  history.pushState = function (...args) {
    const r = origPush(...(args as Parameters<typeof origPush>));
    queueMicrotask(notifyRoute);
    return r;
  };
  history.replaceState = function (...args) {
    const r = origReplace(...(args as Parameters<typeof origReplace>));
    queueMicrotask(notifyRoute);
    return r;
  };
  window.addEventListener('popstate', notifyRoute);
  // Respaldo: sondea la URL por si Shorts cambia de short sin pushState/popstate.
  window.setInterval(notifyRoute, 1000);

  // --- Tab oculto un rato = buen exit ---
  let hiddenTimer: number | undefined;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenTimer = window.setTimeout(() => machine.onHidden(), 5000);
    } else if (hiddenTimer) {
      clearTimeout(hiddenTimer);
    }
  });

  window.addEventListener('pagehide', () => machine.stop(), { once: true });

  // Atajo de demo: Alt+Shift+S dispara el screamer a mano (sin depender de la detección).
  // Capture phase para ganarle a los handlers de teclado de YouTube/TikTok.
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.altKey && e.shiftKey && e.code === 'KeyS') {
        e.preventDefault();
        e.stopPropagation();
        void machine.forceInterrupt();
      }
      if (e.altKey && e.shiftKey && e.code === 'KeyR') {
        e.preventDefault();
        e.stopPropagation();
        machine.reset();
      }
    },
    { capture: true },
  );

  // Mensajes desde el popup (botones "Reiniciar contador" / "Probar screamer").
  chrome.runtime.onMessage.addListener((msg: { kind?: string }) => {
    if (msg?.kind === 'RESET_COUNTER') machine.reset();
    if (msg?.kind === 'FORCE_SCREAMER') void machine.forceInterrupt();
  });

  // Debug interno (mundo aislado, no accesible desde la consola de la página).
  (window as unknown as Record<string, unknown>).__SCROLL_INFINITO = { machine, sensor, observer };
  console.log('[SCROLL_INFINITO] listo · Alt+Shift+S = disparar screamer · Alt+Shift+R = reiniciar contador');
}

main().catch((e) => console.log('[SCROLL_INFINITO] init error', e));
