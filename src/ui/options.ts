// options.ts — Carga/guarda la config del usuario y maneja privacidad.
import { getConfig, setConfig } from '../background/storage';
import { clearAll } from '../data/eventLog';
import { SITE_LABELS } from '../data/schema';
import type { EscalationIntensity, SiteId, UserConfig } from '../data/schema';

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`#${id} no existe`);
  return e as T;
}

const SITE_IDS = Object.keys(SITE_LABELS) as SiteId[];

function renderSites(cfg: UserConfig) {
  const host = el('sites');
  host.innerHTML = '';
  for (const id of SITE_IDS) {
    const wrap = document.createElement('label');
    wrap.className = 'site';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = cfg.perSiteEnabled[id];
    cb.dataset.site = id;
    wrap.appendChild(cb);
    wrap.appendChild(document.createTextNode(SITE_LABELS[id]));
    host.appendChild(wrap);
  }
}

function fill(cfg: UserConfig) {
  el<HTMLInputElement>('cooldownMinutes').value = String(cfg.cooldownMinutes);
  el('cooldownVal').textContent = String(cfg.cooldownMinutes);
  el<HTMLInputElement>('retriggerEveryNScrolls').value = String(cfg.retriggerEveryNScrolls);
  el<HTMLSelectElement>('escalationIntensity').value = cfg.escalationIntensity;
  el<HTMLInputElement>('soundEnabled').checked = cfg.soundEnabled;
  el<HTMLInputElement>('doomThreshold').value = String(cfg.doomThreshold);
  el<HTMLInputElement>('minItemsForTrigger').value = String(cfg.minItemsForTrigger);
  el<HTMLInputElement>('dailyBudgetMinutes').value = String(cfg.dailyBudgetMinutes);
  el<HTMLInputElement>('ifThenPlan').value = cfg.ifThenPlan;
  el<HTMLInputElement>('aiEnabled').checked = cfg.aiEnabled;
  el<HTMLInputElement>('proxyUrl').value = cfg.proxyUrl;
  renderSites(cfg);
}

function collect(): Partial<UserConfig> {
  const perSiteEnabled = {} as Record<SiteId, boolean>;
  el('sites')
    .querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
    .forEach((cb) => {
      perSiteEnabled[cb.dataset.site as SiteId] = cb.checked;
    });
  return {
    cooldownMinutes: Number(el<HTMLInputElement>('cooldownMinutes').value),
    retriggerEveryNScrolls: Number(el<HTMLInputElement>('retriggerEveryNScrolls').value),
    escalationIntensity: el<HTMLSelectElement>('escalationIntensity').value as EscalationIntensity,
    soundEnabled: el<HTMLInputElement>('soundEnabled').checked,
    doomThreshold: Number(el<HTMLInputElement>('doomThreshold').value),
    minItemsForTrigger: Number(el<HTMLInputElement>('minItemsForTrigger').value),
    dailyBudgetMinutes: Number(el<HTMLInputElement>('dailyBudgetMinutes').value),
    ifThenPlan: el<HTMLInputElement>('ifThenPlan').value.trim(),
    aiEnabled: el<HTMLInputElement>('aiEnabled').checked,
    proxyUrl: el<HTMLInputElement>('proxyUrl').value.trim(),
    perSiteEnabled,
  };
}

el<HTMLInputElement>('cooldownMinutes').addEventListener('input', (e) => {
  el('cooldownVal').textContent = (e.target as HTMLInputElement).value;
});

el('save').addEventListener('click', async () => {
  await setConfig(collect());
  const saved = el('saved');
  saved.classList.add('show');
  setTimeout(() => saved.classList.remove('show'), 1500);
});

el('clearData').addEventListener('click', async () => {
  if (!confirm('¿Borrar todos tus datos de scroll? Esto no se puede deshacer.')) return;
  await clearAll();
  alert('Listo, datos borrados.');
});

void (async () => fill(await getConfig()))();
