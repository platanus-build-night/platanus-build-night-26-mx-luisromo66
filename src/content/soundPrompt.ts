// soundPrompt.ts — Banner de "Activar sonido" (un clic = gesto que desbloquea el
// audio del screamer para toda la sesión). Construido por DOM para sortear Trusted Types.
import { primeNow, isAudioPrimed } from './overlay/audioUnlock';

const HOST_ID = 'scroll-infinito-sound-prompt';

export function showSoundPrompt() {
  if (isAudioPrimed()) return; // ya está desbloqueado
  if (document.getElementById(HOST_ID)) return; // ya mostrado

  const host = document.createElement('div');
  host.id = HOST_ID;
  host.style.cssText =
    'all: initial; position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 2147483646;';
  const root = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    .btn {
      font: 600 14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      color: #fff; background: #6c5ce7; border: 0; border-radius: 999px;
      padding: 12px 18px; cursor: pointer; box-shadow: 0 6px 20px rgba(0,0,0,.35);
      display: flex; align-items: center; gap: 8px;
    }
    .btn:hover { filter: brightness(1.08); }
    .x { background: rgba(255,255,255,.25); border-radius: 50%; width: 18px; height: 18px;
         display: inline-flex; align-items: center; justify-content: center; font-size: 12px; }
  `;
  root.appendChild(style);

  const btn = document.createElement('button');
  btn.className = 'btn';
  const label = document.createElement('span');
  label.textContent = '🔊 Activar sonido del screamer';
  const close = document.createElement('span');
  close.className = 'x';
  close.textContent = '✕';
  btn.append(label, close);
  root.appendChild(btn);

  const remove = () => host.remove();

  close.addEventListener('click', (e) => {
    e.stopPropagation();
    remove();
  });

  btn.addEventListener('click', () => {
    primeNow()
      .then(() => {
        label.textContent = '✓ Sonido activado';
        close.style.display = 'none';
        setTimeout(remove, 1200);
      })
      .catch(() => {
        label.textContent = '⚠️ Intenta de nuevo';
      });
  });

  document.documentElement.appendChild(host);

  // Si lo ignoras, desaparece solo a los 20s (sin estorbar).
  setTimeout(() => {
    if (!isAudioPrimed()) remove();
  }, 20000);
}
