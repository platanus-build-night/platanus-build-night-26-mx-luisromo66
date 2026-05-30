// a11y.ts — Salvaguardas de accesibilidad/seguridad del overlay.
// El screamer es ABSURDO, no de terror. Estas reglas son obligatorias.

/** El usuario pidió menos movimiento -> usamos fallback estático. */
export function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * Tope WCAG 2.3.1: nada debe parpadear más de 3 veces por segundo.
 * Nuestras animaciones nunca cambian de luminancia tan rápido; este helper
 * documenta y fuerza el mínimo periodo permitido para cualquier animación.
 */
export const MIN_FLASH_PERIOD_MS = 334; // 1000/3, redondeado hacia arriba

/** Duración segura para cualquier animación de luminancia. */
export function safeAnimationDuration(desiredMs: number): number {
  return Math.max(MIN_FLASH_PERIOD_MS, desiredMs);
}
