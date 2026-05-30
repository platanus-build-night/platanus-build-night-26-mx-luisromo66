// smoke.ts — Verificación de la lógica pura sin navegador.
import { computeDoomScore } from '../src/content/doomScore';
import { getLevelSpec, pickSubtitle } from '../src/content/overlay/levels';
import { buildWeeklyProfile, seededProfile } from '../src/data/patternDetector';
import { DEFAULT_CONFIG } from '../src/data/schema';
import type { ScrollEvent } from '../src/data/schema';

let failed = 0;
function check(name: string, cond: boolean) {
  console.log(`${cond ? '✓' : '✗'} ${name}`);
  if (!cond) failed++;
}

// 1. doomScore: navegación tranquila => bajo; binge => alto.
const calm = computeDoomScore({ activeFeedMs: 5000, scrollDistancePx: 1000, p95Velocity: 300, itemsAppended: 2, lowDwellRatio: 0.1 });
const binge = computeDoomScore({ activeFeedMs: 180000, scrollDistancePx: 40000, p95Velocity: 5000, itemsAppended: 40, lowDwellRatio: 0.8 });
check('doomScore calm < 0.3', calm.score < 0.3);
check('doomScore binge >= 0.6', binge.score >= 0.6);
check('doomScore acotado [0,1]', binge.score <= 1 && calm.score >= 0);

// 2. Escalación: fricción crece con el nivel; intensidad la escala.
const l1 = getLevelSpec(1, 'normal');
const l4 = getLevelSpec(4, 'normal');
check('fricción L4 > L1', l4.frictionSec > l1.frictionSec);
check('L4 pide hold-to-continue', l4.holdToContinue === true);
check('intensidad intenso > suave', getLevelSpec(4, 'intenso').frictionSec > getLevelSpec(4, 'suave').frictionSec);
check('subtítulo interpola screens', pickSubtitle(l1, 12).length > 0);

// 3. WeeklyProfile: perfil sembrado válido + construcción desde eventos.
const seed = seededProfile();
check('seed tiene hotspot', seed.patterns.some((p) => p.type === 'hotspot'));
check('seed adherencia [0,1]', seed.goals[0].adherence >= 0 && seed.goals[0].adherence <= 1);

const now = Date.now();
const events: ScrollEvent[] = [];
for (let i = 0; i < 8; i++) {
  events.push({
    type: 'session_end',
    ts: now - i * 3600_000,
    site: 'tiktok',
    sessionId: `s${i}`,
    endReason: 'left_feed',
    kind: i % 2 === 0 ? 'binge' : 'passive_browse',
    durationMs: 12 * 60_000,
    scrollPx: 30000,
    itemsSeen: 30,
  });
}
const profile = buildWeeklyProfile(events, DEFAULT_CONFIG, now);
check('profile suma minutos', profile.totals.scrollMinutes > 0);
check('profile cuenta sesiones', profile.totals.sessions === 8);
check('profile detecta binge', profile.stateMix.bingeEpisodes > 0);

console.log(failed === 0 ? '\nTODO OK ✅' : `\n${failed} fallo(s) ❌`);
process.exit(failed === 0 ? 0 : 1);
