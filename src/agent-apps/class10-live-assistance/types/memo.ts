export interface MemoTodo {
  text: string;
  done: boolean;
}

export interface MemoSource {
  url: string;
  title: string;
}

/**
 * One memo note. Covers everything the class-10 spec asks a memo to hold:
 * screenshot, summary, translation, tags, todos, and the user's own note.
 * Screenshots live in IndexedDB (blobs are far too big for localStorage);
 * only their ids are stored here.
 */
export interface Memo {
  id: string;
  title: string;
  /** Short description shown on the memo card in the list. */
  summary: string;
  /** Markdown body. */
  content: string;
  translation?: string;
  type?: 'note' | 'html';
  htmlContent?: string;
  tags: string[];
  todos: MemoTodo[];
  /** Free-form note written by the user, never overwritten by the agent. */
  userNote?: string;
  screenshotIds: string[];
  sourceUrls?: MemoSource[];
  createdAt: number;
  updatedAt: number;
}

export type MemoDraft = Partial<Omit<Memo, 'id' | 'createdAt' | 'updatedAt'>>;
