// levels.ts — Definición de cada nivel del screamer (L1->L4).
// Escalar = MÁS ridiculez y MÁS fricción, NUNCA más terror.
import type { EscalationIntensity } from '../../data/schema';

export interface LevelSpec {
  level: number;
  /** Segundos que el botón "Seguir" queda bloqueado (fricción/deliberación). */
  frictionSec: number;
  /** Tamaño del personaje absurdo (rem). */
  emojiSize: number;
  /** Emojis tontos que rotan/bailan. */
  emojis: string[];
  /** Título grande. */
  title: string;
  /** Subtítulo (se rota para combatir habituación). */
  subtitlePool: string[];
  /** Mostrar el espejo de uso (minutos hoy vs meta). */
  showUsageMirror: boolean;
  /** L4 exige hold-para-continuar en vez de un click. */
  holdToContinue: boolean;
}

const BASE: LevelSpec[] = [
  {
    level: 1,
    frictionSec: 0,
    emojiSize: 4,
    emojis: ['👀'],
    title: '¿Sigues ahí?',
    subtitlePool: [
      'Llevas ~{screens} pantallas. Respira una vez 🫧',
      'Pequeña pausa: ¿esto te sirve ahora mismo?',
      'Hey, solo un check rápido 👋',
    ],
    showUsageMirror: false,
    holdToContinue: false,
  },
  {
    level: 2,
    frictionSec: 3,
    emojiSize: 7,
    emojis: ['🕺', '💃', '🪩', '🎉'],
    title: 'OK esto ya es mucho scroll',
    subtitlePool: [
      'Tu pulgar entrenó para un maratón 🏃',
      '~{screens} pantallas. El algoritmo está feliz, ¿y tú?',
      'Baile de interrupción activado 🪩',
    ],
    showUsageMirror: false,
    holdToContinue: false,
  },
  {
    level: 3,
    frictionSec: 6,
    emojiSize: 10,
    emojis: ['🦙', '🛸', '🤡', '🐸'],
    title: '¿De verdad quieres esto ahora?',
    subtitlePool: [
      'No "¿puedo seguir?", sino: ¿de verdad lo quiero? 🤔',
      'Una llama te está juzgando con cariño 🦙',
      'Cierra los ojos 3 segundos. Te esperamos.',
    ],
    showUsageMirror: true,
    holdToContinue: false,
  },
  {
    level: 4,
    frictionSec: 8,
    emojiSize: 14,
    emojis: ['🚨', '🤠', '🦖', '🫠'],
    title: 'Finite Scroll dice: ya estuvo 🤠',
    subtitlePool: [
      'Mira tu día. Mantén presionado si DE VERDAD quieres seguir.',
      'Tu yo de mañana te lo va a agradecer 🫠',
      'Plan twist: cierra esto y ve por agua 💧',
    ],
    showUsageMirror: true,
    holdToContinue: true,
  },
];

const INTENSITY_MULT: Record<EscalationIntensity, number> = {
  suave: 0.5,
  normal: 1,
  intenso: 1.6,
};

export function getLevelSpec(level: number, intensity: EscalationIntensity): LevelSpec {
  const spec = BASE[Math.max(0, Math.min(BASE.length - 1, level - 1))];
  return { ...spec, frictionSec: Math.round(spec.frictionSec * INTENSITY_MULT[intensity]) };
}

export function pickSubtitle(spec: LevelSpec, screens: number): string {
  // Determinista-ish por nivel+screens para variar sin Math.random pesado.
  const idx = (spec.level + screens) % spec.subtitlePool.length;
  return spec.subtitlePool[idx].replace('{screens}', String(screens));
}
