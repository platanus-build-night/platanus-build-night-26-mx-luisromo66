// popup.ts — Render del espejo de uso, heatmap y tarjeta del coach IA.
import { getStats, getDigest } from './uiClient';
import type { AIDigest, DashboardStats } from '../data/schema';

const DAY_MS = 24 * 60 * 60 * 1000;
// getDay(): 0=domingo … 6=sábado.
const DAY_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} no existe`);
  return el;
}

/** Letra del día para el índice i de un arreglo de `len` días que termina HOY. */
function dayLetter(i: number, len: number, now: number): string {
  const date = new Date(now - (len - 1 - i) * DAY_MS);
  return DAY_LETTERS[date.getDay()];
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

/** Heatmap completo: 7 filas (día) × 24 columnas (hora). */
function renderHeatmap(heatmap: number[][]) {
  const max = Math.max(1, ...heatmap.flat());
  const now = Date.now();
  const host = $('heatmap');
  host.innerHTML = '';
  heatmap.forEach((day, i) => {
    const isToday = i === heatmap.length - 1;
    const letter = dayLetter(i, heatmap.length, now);

    const row = document.createElement('div');
    row.className = 'hrow' + (isToday ? ' today' : '');
    const label = document.createElement('div');
    label.className = 'hlabel';
    label.textContent = letter;
    const cells = document.createElement('div');
    cells.className = 'hcells';
    for (let h = 0; h < 24; h++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      const v = day[h] / max;
      cell.style.background = v > 0 ? `rgba(108,92,231,${0.2 + v * 0.8})` : '#232a52';
      cell.title = `${letter} ${String(h).padStart(2, '0')}:00 — ${Math.round(day[h])} min`;
      cells.appendChild(cell);
    }
    row.appendChild(label);
    row.appendChild(cells);
    host.appendChild(row);
  });
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
