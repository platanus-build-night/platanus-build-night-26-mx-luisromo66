// demo.ts — Página de prueba: dispara el screamer con un clic (sonido garantizado
// porque hay gesto de usuario). Útil para presentar sin depender del scroll.
import { ScreamerOverlay } from '../content/overlay/overlayHost';
import { getConfig } from '../background/storage';
import { DEFAULT_CONFIG } from '../data/schema';

function el<T extends HTMLElement = HTMLElement>(sel: string): T {
  const e = document.querySelector(sel);
  if (!e) throw new Error(`${sel} no existe`);
  return e as T;
}

async function init() {
  const config = await getConfig().catch(() => DEFAULT_CONFIG);
  const overlay = new ScreamerOverlay(config);
  const sound = el<HTMLInputElement>('#sound');
  const status = el('#status');

  document.querySelectorAll<HTMLButtonElement>('button[data-level]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const level = Number(btn.dataset.level);
      status.textContent = `Mostrando nivel ${level}…`;
      const response = await overlay.show({
        level,
        screens: 42,
        budgetUsedMin: 73,
        budgetMin: config.dailyBudgetMinutes || 60,
        soundEnabled: sound.checked,
      });
      status.textContent = `Respuesta del usuario: "${response}"`;
    });
  });
}

void init();
