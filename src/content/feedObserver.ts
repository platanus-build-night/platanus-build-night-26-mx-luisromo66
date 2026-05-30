// feedObserver.ts — MutationObserver (items appended = propiedad definitoria del
// scroll infinito) + IntersectionObserver (dwell_ms por item).
import type { SiteAdapter } from './siteAdapters';
import { resolveFeedContainer } from './siteAdapters';

export class FeedObserver {
  private mutation?: MutationObserver;
  private intersection?: IntersectionObserver;
  private adapter: SiteAdapter;
  private dwellStart = new Map<Element, number>();

  itemsAppended = 0;
  dwellSamples: number[] = [];

  /** Callback cuando se agregan items nuevos (auto-append confirmado). */
  onItemsAppended?: (count: number) => void;

  constructor(adapter: SiteAdapter) {
    this.adapter = adapter;
  }

  start() {
    const container = resolveFeedContainer(this.adapter) ?? document.body;

    this.mutation = new MutationObserver((mutations) => {
      let added = 0;
      for (const m of mutations) {
        m.addedNodes.forEach((n) => {
          if (n.nodeType !== Node.ELEMENT_NODE) return;
          const el = n as Element;
          if (el.matches?.(this.adapter.itemSelector) || el.querySelector?.(this.adapter.itemSelector)) {
            added += 1;
            this.observeItem(el);
          }
        });
      }
      if (added > 0) {
        this.itemsAppended += added;
        this.onItemsAppended?.(added);
      }
    });
    this.mutation.observe(container, { childList: true, subtree: true });

    this.intersection = new IntersectionObserver(
      (entries) => {
        const now = performance.now();
        for (const e of entries) {
          if (e.isIntersecting) {
            this.dwellStart.set(e.target, now);
          } else {
            const start = this.dwellStart.get(e.target);
            if (start != null) {
              this.dwellSamples.push(now - start);
              if (this.dwellSamples.length > 100) this.dwellSamples.shift();
              this.dwellStart.delete(e.target);
            }
          }
        }
      },
      { threshold: 0.5 },
    );

    // Observa los items ya presentes al iniciar.
    document.querySelectorAll(this.adapter.itemSelector).forEach((el) => this.observeItem(el));
  }

  private observeItem(el: Element) {
    try {
      this.intersection?.observe(el);
    } catch {
      /* nodo no observable */
    }
  }

  /** Suma items manualmente (p.ej. avance de Short por cambio de URL). */
  bumpItems(n = 1) {
    this.itemsAppended += n;
  }

  /** Fracción de impresiones con dwell bajo (<1.2s) = flicking de baja atención [0,1]. */
  lowDwellRatio(): number {
    if (this.dwellSamples.length === 0) return 0;
    const low = this.dwellSamples.filter((d) => d < 1200).length;
    return low / this.dwellSamples.length;
  }

  reset() {
    this.itemsAppended = 0;
    this.dwellSamples = [];
    this.dwellStart.clear();
  }

  stop() {
    this.mutation?.disconnect();
    this.intersection?.disconnect();
    this.dwellStart.clear();
  }
}
