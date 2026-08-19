import type { Memo, MemoDraft } from '../types/memo';

/**
 * Memo persistence. Metadata lives in localStorage so the list renders
 * synchronously; screenshots are base64 data URLs that would blow the
 * ~5MB localStorage quota, so they go to IndexedDB keyed by screenshot id.
 */

const MEMO_INDEX_KEY = 'class10_memos';
const DB_NAME = 'class10_screenshot_db';
const DB_VERSION = 1;
const STORE_NAME = 'screenshots';

const openDB = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });

export const generateId = (prefix: string): string =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const readIndex = (): Memo[] => {
  try {
    const raw = localStorage.getItem(MEMO_INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to read memo index', e);
    return [];
  }
};

const writeIndex = (memos: Memo[]): void => {
  try {
    localStorage.setItem(MEMO_INDEX_KEY, JSON.stringify(memos));
  } catch (e) {
    console.error('Failed to write memo index', e);
  }
};

/**
 * Case-insensitive substring match across every field the user might
 * remember a memo by. Keyword-based rather than fuzzy: with a few hundred
 * memos this is instant and its behavior is obvious to the user.
 */
export const matchesQuery = (memo: Memo, query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    memo.title,
    memo.summary,
    memo.content,
    memo.htmlContent ?? '',
    memo.translation ?? '',
    memo.userNote ?? '',
    memo.tags.join(' '),
    memo.todos.map(todo => todo.text).join(' ')
  ]
    .join('\n')
    .toLowerCase();
  return q.split(/\s+/).every(term => haystack.includes(term));
};

export const memoRepository = {
  list(): Memo[] {
    return readIndex().sort((a, b) => b.updatedAt - a.updatedAt);
  },

  get(id: string): Memo | null {
    return readIndex().find(memo => memo.id === id) ?? null;
  },

  search(query: string, tags?: string[]): Memo[] {
    return memoRepository
      .list()
      .filter(memo => matchesQuery(memo, query))
      .filter(memo =>
        !tags?.length ? true : tags.every(tag => memo.tags.includes(tag))
      );
  },

  create(draft: MemoDraft): Memo {
    const now = Date.now();
    const memo: Memo = {
      id: generateId('memo'),
      title: draft.title?.trim() || '未命名 Memo',
      summary: draft.summary?.trim() || '',
      content: draft.content ?? '',
      type: draft.type ?? (draft.htmlContent ? 'html' : 'note'),
      htmlContent: draft.htmlContent,
      translation: draft.translation,
      tags: draft.tags ?? [],
      todos: draft.todos ?? [],
      userNote: draft.userNote,
      screenshotIds: draft.screenshotIds ?? [],
      sourceUrls: draft.sourceUrls,
      createdAt: now,
      updatedAt: now
    };
    writeIndex([memo, ...readIndex()]);
    return memo;
  },

  update(id: string, patch: MemoDraft): Memo | null {
    const memos = readIndex();
    const index = memos.findIndex(memo => memo.id === id);
    if (index < 0) return null;
    const updated: Memo = { ...memos[index], ...patch, updatedAt: Date.now() };
    memos[index] = updated;
    writeIndex(memos);
    return updated;
  },

  async remove(id: string): Promise<boolean> {
    const memos = readIndex();
    const target = memos.find(memo => memo.id === id);
    if (!target) return false;
    writeIndex(memos.filter(memo => memo.id !== id));
    // Orphaned blobs would otherwise sit in IndexedDB forever.
    await Promise.all(target.screenshotIds.map(screenshotId => deleteScreenshot(screenshotId)));
    return true;
  },

  allTags(): string[] {
    const tags = new Set<string>();
    readIndex().forEach(memo => memo.tags.forEach(tag => tags.add(tag)));
    return [...tags].sort();
  },

  clearAll(): void {
    localStorage.removeItem(MEMO_INDEX_KEY);
  }
};

export async function saveScreenshot(dataUrl: string): Promise<string> {
  const id = generateId('shot');
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const request = db
        .transaction(STORE_NAME, 'readwrite')
        .objectStore(STORE_NAME)
        .put(dataUrl, id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('Failed to save screenshot', e);
  }
  return id;
}

export async function getScreenshot(id: string): Promise<string | null> {
  try {
    const db = await openDB();
    return await new Promise<string | null>((resolve, reject) => {
      const request = db
        .transaction(STORE_NAME, 'readonly')
        .objectStore(STORE_NAME)
        .get(id);
      request.onsuccess = () => resolve((request.result as string) ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('Failed to read screenshot', e);
    return null;
  }
}

export async function deleteScreenshot(id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const request = db
        .transaction(STORE_NAME, 'readwrite')
        .objectStore(STORE_NAME)
        .delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('Failed to delete screenshot', e);
  }
}
