// eventLog.ts — Log append-only en IndexedDB (crudo, solo on-device).
// Nunca se guarda texto de contenido ni IDs de creadores.
import type { ScrollEvent } from './schema';

const DB_NAME = 'scroll_infinito';
const STORE = 'events';
const DB_VERSION = 1;
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000; // ~90 días de crudos

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('ts', 'ts');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function appendEvent(event: ScrollEvent): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add(event);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Eventos con ts >= since (epoch ms). */
export async function getEventsSince(since: number): Promise<ScrollEvent[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const idx = tx.objectStore(STORE).index('ts');
    const range = IDBKeyRange.lowerBound(since);
    const out: ScrollEvent[] = [];
    idx.openCursor(range).onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        out.push(cursor.value as ScrollEvent);
        cursor.continue();
      } else {
        resolve(out);
      }
    };
    tx.onerror = () => reject(tx.error);
  });
}

/** Borra eventos crudos más viejos que la retención. */
export async function pruneOld(): Promise<void> {
  const db = await openDB();
  const cutoff = Date.now() - RETENTION_MS;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const idx = tx.objectStore(STORE).index('ts');
    idx.openCursor(IDBKeyRange.upperBound(cutoff)).onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Borra TODO (botón de privacidad del usuario). */
export async function clearAll(): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
