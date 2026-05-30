# 🌀 SCROLL_INFINITO

Extensión de navegador (Manifest V3) que **detecta el doomscrolling en el momento exacto** y dispara un **screamer absurdo** a pantalla completa para romper el patrón. Se vuelve a disparar cada N scrolls y **solo se apaga tras una pausa de 15–30 min**, momento en que todo se reinicia. Tú pones tus metas, y un **coach IA (Claude)** convierte tus datos agregados en recomendaciones semanales sin regañar.

> El "screamer" es **absurdo, no de terror**: la evidencia es clara en que los sustos reales son contraproducentes (la gente desinstala) y son un riesgo médico (epilepsia fotosensible). Por eso escala en ridiculez y fricción, nunca en horror, y respeta WCAG 2.3.1 (sin flashes >3/seg), `prefers-reduced-motion` y el silencio del sistema.

## El loop central

```
WATCHING → (doomScore≥0.6 AND items≥15) → SCREAMER L1
   ↑                                          │ sigues scrolleando cada N scrolls
   │                                          ▼
RESET ←── COOLDOWN 15-30 min ←── buen exit   SCREAMER L2→L3→L4 (escala)
```

## Arquitectura

| Capa | Archivos |
|------|----------|
| Detección | `src/content/siteAdapters.ts`, `scrollSensor.ts`, `feedObserver.ts`, `doomScore.ts` |
| Core loop | `src/content/stateMachine.ts`, `src/background/cooldown.ts` |
| Screamer | `src/content/overlay/{overlayHost,levels,a11y}.ts` |
| Background | `src/background/serviceWorker.ts`, `storage.ts`, `aiProxyClient.ts` |
| Datos + IA | `src/data/{schema,eventLog,rollups,patternDetector}.ts` |
| UI | `src/ui/{popup,options}.{html,ts}` |
| Proxy IA | `proxy/worker.ts` (la API key vive aquí, **nunca** en la extensión) |

Sitios soportados: Instagram, TikTok, X/Twitter, Reddit, YouTube Shorts, Facebook.

## Build y carga

```bash
npm install
npm run build       # -> dist/   (npm run watch para recompilar al vuelo)
npm run typecheck   # opcional
```

1. Abre `chrome://extensions`
2. Activa **Modo de desarrollador**
3. **Cargar descomprimida** → selecciona la carpeta `dist/`

## Coach IA (opcional)

```bash
npx wrangler deploy                  # despliega proxy/worker.ts
npx wrangler secret put ANTHROPIC_API_KEY
```

Pega la URL del worker en **Opciones › Capa IA › URL del proxy** y activa el coach.
Solo salen del dispositivo **agregados semanales** (nunca contenido ni quién publicó).
Si hay pocos datos, el digest usa un perfil de ejemplo para que la demo siempre funcione.

## Cómo probar (demo)

1. Abre TikTok/Instagram y scrollea rápido. En la consola: `__SCROLL_INFINITO` expone `machine`/`sensor` para tuning en vivo.
2. **Core loop:** el screamer aparece al primer trigger → reaparece cada N scrolls subiendo de nivel → "Ya terminé" arranca el cooldown → durante el cooldown no interrumpe → a los 15–30 min se reinicia.
3. **Anti-evasión:** abre otra pestaña del mismo sitio durante el cooldown; no lo esquiva.
4. **Accesibilidad:** con `prefers-reduced-motion` activo el overlay es estático.
5. **Metas/espejo:** pon una meta en Opciones; mira stats y heatmap en el popup.
6. **IA:** "✨ Generar recomendaciones" en el popup.

Para afinar la sensibilidad rápido en el demo, baja `doomThreshold` y `minItemsForTrigger`
en Opciones › Sensibilidad, o `retriggerEveryNScrolls` a 3.

## Honestidad del pitch

- **Real hoy:** navegador — única plataforma donde el loop completo (ver el scroll + overlay) funciona sin bloqueos.
- **Roadmap:** Android (AccessibilityService, ~8–12 semanas, riesgo de Google Play) e iOS (Screen Time API → solo límite de tiempo, **no** detección de scroll), reusando la capa `data/` + IA.
- Mide **tasa de pausas aceptadas**, no solo minutos. Referencias: estudio de *one sec* (PNAS 2023), RCTs de escala de grises.
