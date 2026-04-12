// Minimal IndexedDB wrapper for local memoirs. Blobs are stored directly.

import type { ClientPhoto } from "./client-pipeline";

const DB_NAME = "memoir-db";
const DB_VERSION = 1;
const STORE = "memoirs";

export interface StoredMemoir {
  id: string;            // slug-like id
  title: string;
  createdAt: string;     // ISO
  updatedAt: string;     // ISO
  photos: ClientPhoto[]; // Blobs travel through structured clone
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDb();
      const t = db.transaction(STORE, mode);
      const store = t.objectStore(STORE);
      let result: any;
      const r = fn(store);
      if (r && "onsuccess" in r) {
        r.onsuccess = () => { result = (r as IDBRequest).result; };
        r.onerror = () => reject((r as IDBRequest).error);
      }
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    } catch (e) { reject(e); }
  });
}

export async function saveMemoir(m: StoredMemoir): Promise<void> {
  await tx("readwrite", (store) => store.put(m));
}

export async function loadMemoir(id: string): Promise<StoredMemoir | null> {
  const result = await tx<StoredMemoir>("readonly", (store) => store.get(id));
  return (result as StoredMemoir | undefined) ?? null;
}

export async function listMemoirs(): Promise<StoredMemoir[]> {
  const result = await tx<StoredMemoir[]>("readonly", (store) => store.getAll());
  return (result as StoredMemoir[] | undefined) ?? [];
}

export async function deleteMemoir(id: string): Promise<void> {
  await tx("readwrite", (store) => store.delete(id));
}
