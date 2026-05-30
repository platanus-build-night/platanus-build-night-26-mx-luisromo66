// siteAdapters.ts — Tabla única host+path: ¿la superficie actual es un feed infinito?
// Tener todo en un archivo hace el mantenimiento rápido cuando un sitio se rediseña.
import type { SiteId } from '../data/schema';

export interface SiteAdapter {
  id: SiteId;
  /** ¿El hostname pertenece a este sitio? */
  matchHost: (host: string) => boolean;
  /** ¿El pathname actual es un feed infinito (no un post/perfil aislado)? */
  isFeedPath: (path: string) => boolean;
  /**
   * Selectores candidatos del contenedor de items del feed (para MutationObserver
   * e IntersectionObserver). El primero que exista gana. Si ninguno existe se usa
   * el fallback a nivel document, así la detección core sobrevive un rediseño.
   */
  feedContainerSelectors: string[];
  /** Selector de un "item" del feed (para contar items e impresiones). */
  itemSelector: string;
}

const ADAPTERS: SiteAdapter[] = [
  {
    id: 'instagram',
    matchHost: (h) => h.endsWith('instagram.com'),
    // Home feed "/" y reels "/reels/...". Excluye posts aislados "/p/..." y perfiles.
    isFeedPath: (p) => p === '/' || p.startsWith('/reels'),
    feedContainerSelectors: ['main[role="main"]', 'section main'],
    itemSelector: 'article',
  },
  {
    id: 'tiktok',
    matchHost: (h) => h.endsWith('tiktok.com'),
    isFeedPath: (p) => p === '/' || p.startsWith('/foryou') || p.startsWith('/following'),
    feedContainerSelectors: ['[data-e2e="recommend-list-item-container"]', '#main-content-homepage_hot', 'main'],
    itemSelector: '[data-e2e="recommend-list-item-container"], article',
  },
  {
    id: 'twitter',
    matchHost: (h) => h.endsWith('twitter.com') || h.endsWith('x.com'),
    isFeedPath: (p) => p === '/home' || p === '/' || p.startsWith('/i/timeline'),
    feedContainerSelectors: ['[aria-label][role="region"]', 'main[role="main"]'],
    itemSelector: 'article[data-testid="tweet"], article',
  },
  {
    id: 'reddit',
    matchHost: (h) => h.endsWith('reddit.com'),
    // Listings (home, popular, subreddits) pero NO páginas de comentarios.
    isFeedPath: (p) => !p.includes('/comments/') && (p === '/' || p.startsWith('/r/') || p.startsWith('/best') || p.startsWith('/hot') || p.startsWith('/new') || p.startsWith('/top')),
    feedContainerSelectors: ['shreddit-feed', '[data-testid="post-container"]', 'main'],
    itemSelector: 'shreddit-post, article, [data-testid="post-container"]',
  },
  {
    id: 'youtube',
    matchHost: (h) => h.endsWith('youtube.com'),
    // Solo Shorts (scroll infinito). El home no es scroll-infinito clásico.
    isFeedPath: (p) => p.startsWith('/shorts'),
    feedContainerSelectors: ['#shorts-container', 'ytd-reel-video-renderer', 'ytd-shorts'],
    itemSelector: 'ytd-reel-video-renderer',
  },
  {
    id: 'facebook',
    matchHost: (h) => h.endsWith('facebook.com'),
    isFeedPath: (p) => p === '/' || p.startsWith('/reel') || p.startsWith('/watch'),
    feedContainerSelectors: ['[role="feed"]', '[role="main"]'],
    itemSelector: '[role="article"]',
  },
];

export function getAdapterForHost(host: string): SiteAdapter | null {
  return ADAPTERS.find((a) => a.matchHost(host)) ?? null;
}

/** Resuelve el contenedor del feed; null si ninguno existe (=> usar document). */
export function resolveFeedContainer(adapter: SiteAdapter): Element | null {
  for (const sel of adapter.feedContainerSelectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}
