// popup.ts — Render del espejo de uso, heatmap y tarjeta del coach IA.
import { getStats, getDigest } from './uiClient';
import type { AIDigest, DashboardStats } from '../data/schema';

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} no existe`);
  return el;
}

function renderStats(s: DashboardStats) {
  $('todayMin').textContent = String(s.todayMinutes);
  $('streak').textContent = String(s.currentStreakDays);
  $('sessions').textContent = String(s.todaySessions);
  $('binges').textContent = String(s.bingeEpisodesToday);
  $('interventions').textContent = String(s.interventionsToday);
  $('acceptRate').textContent = `${Math.round(s.acceptRate * 100)}%`;
  renderHeatmap(s.heatmap);
}

function renderHeatmap(heatmap: number[][]) {
  const flat = heatmap.flat();
  const max = Math.max(1, ...flat);
  const host = $('heatmap');
  host.innerHTML = '';
  // Mostramos solo HOY (última fila) en 24 columnas para que quepa; tooltip por hora.
  const today = heatmap[heatmap.length - 1] ?? new Array(24).fill(0);
  for (let h = 0; h < 24; h++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    const v = today[h] / max;
    cell.style.background = v > 0 ? `rgba(108,92,231,${0.25 + v * 0.75})` : '#232a52';
    cell.title = `${String(h).padStart(2, '0')}:00 — ${Math.round(today[h])} min`;
    host.appendChild(cell);
  }
}

function renderDigest(digest: AIDigest) {
  const host = $('digest');
  host.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <div class="celebration">🎉 ${escape(digest.celebration)}</div>
    <div class="insight">${escape(digest.insight)}</div>
    ${digest.recommendations
      .map(
        (r) => `<div class="rec">
          <div class="t">${escape(r.title)}</div>
          <div class="a">→ ${escape(r.action)}</div>
          <div class="w">${escape(r.why)}</div>
        </div>`,
      )
      .join('')}
  `;
  host.appendChild(card);
}

function escape(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

async function load() {
  try {
    renderStats(await getStats());
  } catch (e) {
    $('todayMin').textContent = '–';
    console.debug(e);
  }
}

$('getDigest').addEventListener('click', async () => {
  const btn = $('getDigest') as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = '⏳ Pensando…';
  const host = $('digest');
  try {
    const { digest, error } = await getDigest();
    if (digest) {
      renderDigest(digest);
    } else {
      host.innerHTML = `<div class="card err">${escape(error ?? 'No se pudo generar.')}<br><span class="muted">Configura el proxy en Opciones › Capa IA.</span></div>`;
    }
  } catch (e) {
    host.innerHTML = `<div class="card err">${escape((e as Error).message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = '✨ Generar recomendaciones';
  }
});

$('testScreamer').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('demo.html') });
});

$('resetCounter').addEventListener('click', async () => {
  const btn = $('resetCounter');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  chrome.tabs.sendMessage(tab.id, { kind: 'RESET_COUNTER' }, () => {
    const err = chrome.runtime.lastError;
    btn.textContent = err ? '⚠️ Abre TikTok/IG/Shorts primero' : '✓ Contador reiniciado';
    setTimeout(() => (btn.textContent = '🔄 Reiniciar contador (en esta pestaña)'), 1600);
  });
});

$('openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());

void load();
