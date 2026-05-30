<p align="center">
  <img src="src/assets/icon128.png" alt="Finite Scroll" width="120" height="120">
</p>

<h1 align="center">Finite Scroll</h1>

> **Manifest V3 browser extension that detects doomscrolling the moment it happens and fires an *absurd* (never scary) full-screen interrupt to break the pattern.** It re-fires every N scrolls, escalating in ridiculousness, and only switches off after a 15–30 min pause — at which point everything resets. You set your goals, and an optional **Claude-powered coach** turns your *aggregated* weekly data into gentle recommendations, never lectures.

<p align="center">🌐 <b><a href="#english">🇺🇸 English</a> · <a href="#español">🇲🇽 Español</a></b></p>

---

<a name="english"></a>

## 🇺🇸 English

### What it is

Finite Scroll is a browser extension (Manifest V3) that watches social feeds in real time. When it detects doomscrolling, it throws a full-screen **"screamer"** to interrupt the pattern.

The screamer is **absurd, not horror**. The evidence is clear: real scares backfire (people uninstall) and are a medical risk (photosensitive epilepsy). So the interrupt escalates in *ridiculousness and friction* — never in terror — and respects:

- **WCAG 2.3.1** — no flashes faster than 3 per second.
- `prefers-reduced-motion` — the overlay becomes static.
- **System mute** — no surprise audio.

### The core loop

```
WATCHING → (doomScore ≥ 0.6 AND items ≥ 15) → SCREAMER L1
   ↑                                              │ you keep scrolling, every N scrolls…
   │                                              ▼
RESET ←── COOLDOWN 15–30 min ←── good exit   SCREAMER L2 → L3 → L4 (escalates)
```

- **First trigger is an AND-gate:** the weighted doom score must cross your threshold **and** there must be real evidence of an infinite feed (enough auto-appended items, with a high scroll-volume fallback so a changed CSS selector never silences detection).
- **Re-trigger:** every `retriggerEveryNScrolls` scrolls, escalating one level (capped at L4).
- **Reset only on real inactivity:** the 15–30 min cooldown resets the episode only when scrolling actually stops. Buttons ("I'm done" / "Keep going") never grant immunity — this is by design, and it's why opening another tab of the same site during cooldown doesn't dodge it.

### Architecture

Three runtime contexts communicate over typed messages:

| Layer | Files | Role |
|-------|-------|------|
| **Detection** | `src/content/siteAdapters.ts`, `scrollSensor.ts`, `feedObserver.ts`, `doomScore.ts` | Reads scroll/feed signals, computes an explainable `[0,1]` doom score |
| **Core loop** | `src/content/stateMachine.ts`, `src/background/cooldown.ts` | `WATCHING → INTERRUPT → COOLDOWN` state machine, ticks every 1s |
| **Screamer** | `src/content/overlay/{overlayHost,levels,a11y,audioUnlock}.ts` | Full-screen interrupt rendered in a Shadow DOM host |
| **Background** | `src/background/serviceWorker.ts`, `storage.ts`, `aiProxyClient.ts` | Single message router, IndexedDB, `chrome.alarms`, AI orchestration |
| **Data + AI** | `src/data/{schema,eventLog,rollups,patternDetector}.ts` | On-device event log, dashboard rollups, weekly profile builder |
| **UI** | `src/ui/{popup,options,demo}.{html,ts}` | Popup stats/heatmap, options, demo page |
| **AI proxy** | `proxy/worker.ts` | Separate Cloudflare Worker — the API key lives **here, never** in the extension |

1. **Content script** (`→ content.js`) — injected into feed pages. Runs detection + the overlay. Can't persist data or hold the AI key; talks to the background via typed messages.
2. **Background service worker** (`→ background.js`) — the single message router. Owns IndexedDB, cooldown state, alarms, and AI orchestration. MV3 workers sleep, so **all background state lives in storage**, not memory.
3. **AI proxy** (`proxy/worker.ts`) — a separate Cloudflare Worker. Holds the API key, receives a `WeeklyProfile`, calls Claude (`claude-opus-4-8`) with strict tool-use, returns a validated `AIDigest`.

**Supported sites:** Instagram, TikTok, X/Twitter, Reddit, YouTube **Shorts only**, Facebook. Per-site logic lives in a single table (`siteAdapters.ts`: `matchHost`, `isFeedPath`, CSS selectors). To add or fix a site, edit that table — the detection core is site-agnostic. The host list stays in sync between `manifest.json` and `siteAdapters.ts`.

### Privacy model

- The event log (`src/data/eventLog.ts`) is **on-device only** (IndexedDB, ~90-day retention, daily prune). It **never** stores content text or creator IDs.
- The **only** thing that ever leaves the device is a `WeeklyProfile` — aggregated counts, never *what* you saw or *who* posted it.
- If there are fewer than 5 sessions, a seeded demo profile is used so the AI feature always works.

### Build & load

```bash
npm install
npm run build       # esbuild → dist/   (npm run watch to rebuild on change)
npm run typecheck   # optional: tsc --noEmit
npm test            # bundles test/smoke.ts and runs pure-logic assertions
```

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select the `dist/` folder

### AI coach (optional)

```bash
npx wrangler deploy                       # deploys proxy/worker.ts
npx wrangler secret put ANTHROPIC_API_KEY # the key lives ONLY in the Worker
```

Paste the worker URL into **Options › AI layer › Proxy URL** and enable the coach. For local proxy dev: copy `.dev.vars.example` to `.dev.vars`, add your key, then `npm run proxy:dev`.

### How to test (demo)

1. Open TikTok/Instagram and scroll fast. In the console, `__FINITE_SCROLL` exposes `{ machine, sensor, observer }` for live tuning.
2. **Core loop:** the screamer appears on first trigger → reappears every N scrolls, leveling up → "I'm done" starts the cooldown → it won't interrupt during cooldown → after 15–30 min it resets.
3. **Anti-evasion:** open another tab of the same site during cooldown — it isn't dodged.
4. **Accessibility:** with `prefers-reduced-motion` active, the overlay is static.
5. **Goals/mirror:** set a goal in Options; check stats and the heatmap in the popup.
6. **AI:** "✨ Generate recommendations" in the popup.

To make it fire faster in a demo, lower `doomThreshold` and `minItemsForTrigger` in Options › Sensitivity, or set `retriggerEveryNScrolls` to 3. Debug shortcuts: `Alt+Shift+S` force-fires, `Alt+Shift+R` resets.

---

<a name="español"></a>

## 🇲🇽 Español

### Qué es

Finite Scroll es una extensión de navegador (Manifest V3) que observa los feeds sociales en tiempo real. Cuando **detecta el doomscrolling en el momento exacto**, dispara un **"screamer"** a pantalla completa para romper el patrón.

El screamer es **absurdo, no de terror**. La evidencia es clara: los sustos reales son contraproducentes (la gente desinstala) y son un riesgo médico (epilepsia fotosensible). Por eso escala en *ridiculez y fricción* — nunca en horror — y respeta:

- **WCAG 2.3.1** — sin flashes a más de 3 por segundo.
- `prefers-reduced-motion` — el overlay se vuelve estático.
- **El silencio del sistema** — sin audio sorpresa.

### El loop central

```
WATCHING → (doomScore ≥ 0.6 Y items ≥ 15) → SCREAMER L1
   ↑                                            │ sigues scrolleando, cada N scrolls…
   │                                            ▼
RESET ←── COOLDOWN 15–30 min ←── buen exit   SCREAMER L2 → L3 → L4 (escala)
```

- **El primer disparo es un AND-gate:** el doom score ponderado debe cruzar tu umbral **y** debe haber evidencia real de un feed infinito (suficientes items autoañadidos, con un fallback de alto volumen de scroll para que un selector CSS cambiado nunca silencie la detección).
- **Re-disparo:** cada `retriggerEveryNScrolls` scrolls, subiendo un nivel (tope en L4).
- **Reset solo con inactividad real:** el cooldown de 15–30 min reinicia el episodio solo cuando el scroll realmente para. Los botones ("Ya terminé" / "Seguir") nunca dan inmunidad — es por diseño, y por eso abrir otra pestaña del mismo sitio durante el cooldown no lo esquiva.

### Arquitectura

Tres contextos de ejecución se comunican por mensajes tipados:

| Capa | Archivos | Rol |
|------|----------|-----|
| **Detección** | `src/content/siteAdapters.ts`, `scrollSensor.ts`, `feedObserver.ts`, `doomScore.ts` | Lee señales de scroll/feed, calcula un doom score explicable `[0,1]` |
| **Core loop** | `src/content/stateMachine.ts`, `src/background/cooldown.ts` | Máquina de estados `WATCHING → INTERRUPT → COOLDOWN`, tick cada 1s |
| **Screamer** | `src/content/overlay/{overlayHost,levels,a11y,audioUnlock}.ts` | Interrupción a pantalla completa renderizada en un host Shadow DOM |
| **Background** | `src/background/serviceWorker.ts`, `storage.ts`, `aiProxyClient.ts` | Router único de mensajes, IndexedDB, `chrome.alarms`, orquestación IA |
| **Datos + IA** | `src/data/{schema,eventLog,rollups,patternDetector}.ts` | Log de eventos en el dispositivo, rollups del dashboard, perfil semanal |
| **UI** | `src/ui/{popup,options,demo}.{html,ts}` | Stats/heatmap del popup, opciones, página demo |
| **Proxy IA** | `proxy/worker.ts` | Cloudflare Worker aparte — la API key vive **aquí, nunca** en la extensión |

1. **Content script** (`→ content.js`) — inyectado en las páginas de feed. Corre la detección + el overlay. No puede persistir datos ni guardar la key de IA; habla con el background por mensajes tipados.
2. **Background service worker** (`→ background.js`) — el router único de mensajes. Es dueño de IndexedDB, el estado de cooldown, las alarmas y la orquestación IA. Los workers MV3 se duermen, así que **todo el estado de background vive en storage**, no en memoria.
3. **Proxy IA** (`proxy/worker.ts`) — un Cloudflare Worker aparte. Guarda la API key, recibe un `WeeklyProfile`, llama a Claude (`claude-opus-4-8`) con tool-use estricto, y devuelve un `AIDigest` validado.

**Sitios soportados:** Instagram, TikTok, X/Twitter, Reddit, YouTube **solo Shorts**, Facebook. La lógica por sitio vive en una sola tabla (`siteAdapters.ts`: `matchHost`, `isFeedPath`, selectores CSS). Para agregar o arreglar un sitio, edita esa tabla — el core de detección es agnóstico al sitio. La lista de hosts se mantiene sincronizada entre `manifest.json` y `siteAdapters.ts`.

### Modelo de privacidad

- El log de eventos (`src/data/eventLog.ts`) es **solo en el dispositivo** (IndexedDB, retención ~90 días, prune diario). **Nunca** guarda texto de contenido ni IDs de creadores.
- Lo **único** que sale del dispositivo es un `WeeklyProfile` — conteos agregados, nunca *qué* viste ni *quién* lo publicó.
- Si hay menos de 5 sesiones, se usa un perfil de ejemplo (seed) para que la función de IA siempre funcione.

### Build y carga

```bash
npm install
npm run build       # esbuild → dist/   (npm run watch para recompilar al vuelo)
npm run typecheck   # opcional: tsc --noEmit
npm test            # bundlea test/smoke.ts y corre aserciones de lógica pura
```

1. Abre `chrome://extensions`
2. Activa **Modo de desarrollador**
3. **Cargar descomprimida** → selecciona la carpeta `dist/`

### Coach IA (opcional)

```bash
npx wrangler deploy                       # despliega proxy/worker.ts
npx wrangler secret put ANTHROPIC_API_KEY # la key vive SOLO en el Worker
```

Pega la URL del worker en **Opciones › Capa IA › URL del proxy** y activa el coach. Para desarrollo local del proxy: copia `.dev.vars.example` a `.dev.vars`, agrega tu key, y corre `npm run proxy:dev`.

### Cómo probar (demo)

1. Abre TikTok/Instagram y scrollea rápido. En la consola, `__FINITE_SCROLL` expone `{ machine, sensor, observer }` para tuning en vivo.
2. **Core loop:** el screamer aparece al primer trigger → reaparece cada N scrolls subiendo de nivel → "Ya terminé" arranca el cooldown → durante el cooldown no interrumpe → a los 15–30 min se reinicia.
3. **Anti-evasión:** abre otra pestaña del mismo sitio durante el cooldown; no lo esquiva.
4. **Accesibilidad:** con `prefers-reduced-motion` activo, el overlay es estático.
5. **Metas/espejo:** pon una meta en Opciones; mira stats y heatmap en el popup.
6. **IA:** "✨ Generar recomendaciones" en el popup.

Para afinar la sensibilidad en el demo, baja `doomThreshold` y `minItemsForTrigger` en Opciones › Sensibilidad, o `retriggerEveryNScrolls` a 3. Atajos de debug: `Alt+Shift+S` fuerza el disparo, `Alt+Shift+R` reinicia.

---

## 📂 Project layout / Estructura

```
src/
  content/        Detection + overlay (injected into feed pages)
    overlay/      Shadow-DOM screamer (levels, a11y, audio unlock)
  background/     MV3 service worker, storage, cooldown, AI client
  data/           schema (source of truth), event log, rollups, pattern detector
  ui/             popup, options, demo (HTML + TS)
  assets/         icons + screamer media
proxy/            Cloudflare Worker holding the Anthropic API key
test/             smoke.ts (pure-logic checks via npm test)
build.mjs         esbuild bundler → dist/
manifest.json     MV3 manifest (host list synced with siteAdapters.ts)
wrangler.toml     proxy deploy config
```

## 🛠️ Tech / Tecnología

esbuild · TypeScript · Chrome Manifest V3 · IndexedDB · Cloudflare Workers · Claude (`claude-opus-4-8`, strict tool-use)

**Version / Versión:** 0.1.0 · No lint step; `npm test` is a pure-logic smoke test bundled with esbuild.
