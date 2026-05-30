# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Finite Scroll is a Manifest V3 browser extension that detects doomscrolling on social feeds in real time and fires an **absurd (never scary) full-screen "screamer"** to break the pattern. It escalates in ridiculousness/friction (L1→L4), not horror, and respects WCAG 2.3.1 (no flashes >3/sec), `prefers-reduced-motion`, and system mute. An optional Claude-powered coach turns **aggregated weekly data only** into non-judgmental recommendations.

The codebase is in Spanish (comments, UI copy, the AI system prompt). Keep new comments/UI text in Spanish to match.

## Commands

```bash
npm install
npm run build       # esbuild -> dist/  (load dist/ as an unpacked extension)
npm run watch       # rebuild on change
npm run typecheck   # tsc --noEmit (no emit; build.mjs does the bundling)
npm test            # bundles test/smoke.ts and runs it under node (pure-logic smoke test)
npm run proxy:dev   # wrangler dev for proxy/worker.ts
npm run proxy:deploy
```

There is no test runner/framework. `npm test` bundles `test/smoke.ts` with esbuild (stubbing `window`) and runs the assertions in `check(...)`; to add a test, add a `check('name', cond)` line there. The build has no lint step.

**Loading the extension:** `chrome://extensions` → enable Developer mode → "Load unpacked" → select `dist/`.

**AI proxy deploy:** `npx wrangler deploy` then `npx wrangler secret put ANTHROPIC_API_KEY`. Paste the worker URL into Options › Capa IA › proxy URL. The Anthropic API key lives **only** in the Cloudflare Worker — never in the extension.

## Architecture

Three runtime contexts communicate; understand the boundaries before changing message flow.

1. **Content script** (`src/content/`, bundled to `content.js`) — injected into feed pages. Runs the detection + the screamer overlay. Cannot persist data or hold the AI key; it talks to the background via typed messages.
2. **Background service worker** (`src/background/serviceWorker.ts` → `background.js`) — the single message router. Owns IndexedDB persistence, cooldown state, `chrome.alarms`, and AI orchestration. MV3 workers sleep, so all background state lives in storage, not memory.
3. **AI proxy** (`proxy/worker.ts`) — a separate Cloudflare Worker. Holds the API key, receives a `WeeklyProfile`, calls Claude with strict tool-use, returns a validated `AIDigest`.

### The core detection loop

`StateMachine` (`src/content/stateMachine.ts`) is the heart. States: `WATCHING → INTERRUPT → COOLDOWN`. It ticks every 1s and:
- Reads signals from `ScrollSensor` (scroll distance/velocity/count) and `FeedObserver` (auto-appended items, low-dwell ratio).
- Feeds them to `computeDoomScore` (`doomScore.ts`) — an explainable weighted `[0,1]` score; each term is `clamp((x-soft)/(hard-soft)) * weight`.
- **First trigger is an AND-gate:** `score ≥ doomThreshold` AND enough evidence of an infinite feed (`itemsAppended ≥ minItemsForTrigger`, with a high scroll-volume fallback so a changed selector doesn't go silent).
- **Re-trigger:** every `retriggerEveryNScrolls` scrolls, escalating one level (capped at `MAX_LEVEL = 4`).
- **Reset only on real inactivity:** the cooldown (15–30 min) resets the episode only when scrolling actually stops — buttons ("Ya terminé" / "Seguir") never grant immunity. This is by design; don't add per-button cooldown.

`src/content/index.ts` bootstraps: picks a `SiteAdapter`, hooks SPA routing (`history.pushState/replaceState` + `popstate` + a 1s URL poll, because feeds never full-reload and Shorts/Reels change URL per item), and wires good-exit detection (route change, hidden tab). Debug handles: `Alt+Shift+S` force-fires, `Alt+Shift+R` resets, `window.__FINITE_SCROLL` exposes `{ machine, sensor, observer }` (isolated world).

### Site support is a single table

`src/content/siteAdapters.ts` is the one place per-site logic lives: `matchHost`, `isFeedPath` (distinguishes infinite feeds from isolated posts/profiles), and CSS selectors for the feed container/items. To add or fix a site, edit this table — the detection core is site-agnostic. Selectors are intentionally redundant (first match wins, falls back to `document`) to survive redesigns. Sites: Instagram, TikTok, X/Twitter, Reddit, YouTube **Shorts only**, Facebook. The same host list must stay in sync across `manifest.json` (permissions + content_scripts + web_accessible_resources) and `siteAdapters.ts`.

### Overlay / screamer

`src/content/overlay/` renders the full-screen interrupt in a Shadow DOM host (`overlayHost.ts`). `levels.ts` defines per-level friction (delay, hold-to-continue at L4) scaled by `escalationIntensity`. `a11y.ts` enforces the accessibility guarantees; `audioUnlock.ts` + `soundPrompt.ts` handle the one-click audio unlock (browsers block autoplay).

### Data + privacy model

- `src/data/eventLog.ts` — append-only IndexedDB log (`finite_scroll` DB), **on-device only**, ~90-day retention, daily prune via alarm. Never stores content text or creator IDs.
- `src/data/rollups.ts` → `DashboardStats` for the popup (today/week minutes, heatmap, accept rate).
- `src/data/patternDetector.ts` → `buildWeeklyProfile` aggregates events into a `WeeklyProfile` — **the only thing that ever leaves the device.** `seededProfile()` is a demo fallback when there are <5 sessions, so the AI demo always works.
- `src/data/schema.ts` — the shared contract: `SiteId`, `UserConfig`/`DEFAULT_CONFIG`, the `ScrollEvent` union, the content↔background `Msg`/`MsgResponse` protocol, and `WeeklyProfile`/`AIDigest`. This file is meant to be reusable by future Android/iOS siblings; treat it as the source of truth and update it before changing any cross-context payload.

### AI orchestration

`serviceWorker.getDigest()` builds the weekly profile (or seed), POSTs it to `aiProxyClient.fetchDigest(proxyUrl, profile)`, and returns an `AIDigest`. The proxy (`proxy/worker.ts`) uses `tool_choice: emit_digest` for strict JSON, caches the large system prompt (`cache_control: ephemeral`), and enforces a warm, non-shaming tone. Model: `claude-opus-4-8`.

## Conventions

- **Adding a content↔background message:** extend the `Msg`/`MsgResponse` unions in `schema.ts`, add a `case` in `serviceWorker.handle`, and add a typed wrapper in `src/content/bgClient.ts`. Logging is fire-and-forget; everything else is request/response (the SW returns `true` to keep the channel open).
- **New build entry point:** register it in `entries` in `build.mjs` (and copy any static HTML in `copyStatic`).
- Tunables (`doomThreshold`, `minItemsForTrigger`, `retriggerEveryNScrolls`, `cooldownMinutes`) are user-facing in Options and clamped (e.g. `clampCooldown` → 15–30). Lower them in Options to make the demo fire faster.

## Not committed

`dist/` (build output), `.dev.vars` (local secrets), `node_modules`. There is no git repo here yet.
