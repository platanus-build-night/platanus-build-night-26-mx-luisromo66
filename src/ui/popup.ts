// popup.ts — Lanzador: abre el dashboard de estadísticas y acciones de utilidad.

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} no existe`);
  return el;
}

$('openDashboard').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
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
