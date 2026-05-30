// audioUnlock.ts — Sortea la política de autoplay-con-sonido de los navegadores.
// Mantiene UN elemento de audio persistente y lo "ceba" con el primer gesto del
// usuario (clic/tecla/touch). Una vez cebado, puede sonar aunque el screamer se
// dispare por scroll (que no cuenta como gesto).

let audio: HTMLAudioElement | null = null;
let primed = false;

/** Crea el audio persistente y engancha el cebado al primer gesto. Idempotente. */
export function initScreamerAudio(url: string) {
  if (audio) return;
  audio = new Audio(url);
  audio.loop = true;
  audio.preload = 'auto';

  const prime = () => {
    if (!audio || primed) return;
    // Reproduce DESmuteado pero a volumen 0 dentro del gesto: eso "bendice" al
    // elemento para poder sonar luego sin gesto, sin emitir un blip audible.
    audio.muted = false;
    audio.volume = 0;
    audio
      .play()
      .then(() => {
        audio!.pause();
        audio!.currentTime = 0;
        primed = true;
        console.log('[SCROLL_INFINITO] audio desbloqueado para esta sesión 🔊');
      })
      .catch(() => {});
  };

  // capture + once: capturamos el primer gesto antes que la página.
  (['pointerdown', 'keydown', 'touchstart'] as const).forEach((ev) =>
    window.addEventListener(ev, prime, { capture: true, once: true }),
  );
}

/** Reproduce el sonido del screamer desde el inicio. Devuelve la promesa de play(). */
export function playScreamerSound(): Promise<void> {
  if (!audio) return Promise.reject(new Error('audio no inicializado'));
  audio.muted = false;
  audio.volume = 1;
  audio.currentTime = 0;
  return audio.play();
}

/** Cebado explícito (llamar dentro de un clic del usuario). Bendice el audio. */
export function primeNow(): Promise<void> {
  if (!audio) return Promise.reject(new Error('audio no inicializado'));
  audio.muted = false;
  audio.volume = 0;
  return audio.play().then(() => {
    audio!.pause();
    audio!.currentTime = 0;
    audio!.volume = 1;
    primed = true;
    console.log('[SCROLL_INFINITO] audio desbloqueado (clic explícito) 🔊');
  });
}

export function stopScreamerSound() {
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
}

export function isAudioPrimed(): boolean {
  return primed;
}
