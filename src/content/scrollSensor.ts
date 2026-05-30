// scrollSensor.ts — Escucha scroll/wheel (throttled) y acumula señales cinemáticas:
// distancia recorrida, velocidad (px/s) y un buffer para p95.
export interface ScrollSample {
  /** Delta vertical absoluto del último tick (px). */
  dy: number;
  /** Velocidad instantánea (px/s). */
  velocity: number;
  /** Conteo total de ticks de scroll en la sesión actual. */
  scrollCount: number;
}

export class ScrollSensor {
  private lastY = window.scrollY;
  private lastT = performance.now();
  private velocities: number[] = [];
  private throttleMs: number;
  private pending = false;

  totalDistance = 0;
  scrollCount = 0;

  /** Callback por cada tick procesado (ya throttled). */
  onTick?: (sample: ScrollSample) => void;

  constructor(throttleMs = 200) {
    this.throttleMs = throttleMs;
  }

  start() {
    window.addEventListener('scroll', this.handle, { passive: true });
    window.addEventListener('wheel', this.handleWheel, { passive: true });
    // Captura scroll de contenedores internos (feeds tipo Shorts/TikTok) y swipes.
    document.addEventListener('scroll', this.handle, { passive: true, capture: true });
    window.addEventListener('touchmove', this.handleWheel, { passive: true });
  }

  stop() {
    window.removeEventListener('scroll', this.handle);
    window.removeEventListener('wheel', this.handleWheel);
    document.removeEventListener('scroll', this.handle, { capture: true } as EventListenerOptions);
    window.removeEventListener('touchmove', this.handleWheel);
  }

  /** Tick sintético: avance de Short por cambio de URL (cuenta como una pantalla). */
  pump(screens = 1) {
    this.registerTick(window.innerHeight * screens, 6000);
  }

  reset() {
    this.totalDistance = 0;
    this.scrollCount = 0;
    this.velocities = [];
    this.lastY = window.scrollY;
    this.lastT = performance.now();
  }

  /** Velocidad p95 (px/s) sobre las últimas muestras. */
  p95Velocity(): number {
    if (this.velocities.length === 0) return 0;
    const sorted = [...this.velocities].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
    return sorted[idx];
  }

  private handleWheel = () => this.handle();

  private handle = () => {
    if (this.pending) return;
    this.pending = true;
    setTimeout(() => {
      this.pending = false;
      this.process();
    }, this.throttleMs);
  };

  private process() {
    const now = performance.now();
    const y = window.scrollY;
    const dy = Math.abs(y - this.lastY);
    const dt = (now - this.lastT) / 1000;
    if (dy < 1) {
      // Scroll en contenedor interno (feeds tipo TikTok no mueven window.scrollY).
      // Aproximamos un tick de magnitud "una pantalla" para no perder la señal.
      this.registerTick(window.innerHeight * 0.9, dt > 0 ? (window.innerHeight * 0.9) / dt : 0);
    } else {
      const velocity = dt > 0 ? dy / dt : 0;
      this.registerTick(dy, velocity);
    }
    this.lastY = y;
    this.lastT = now;
  }

  private registerTick(dy: number, velocity: number) {
    this.totalDistance += dy;
    this.scrollCount += 1;
    this.velocities.push(velocity);
    if (this.velocities.length > 100) this.velocities.shift();
    this.onTick?.({ dy, velocity, scrollCount: this.scrollCount });
  }
}
