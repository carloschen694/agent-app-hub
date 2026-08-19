import type { LongTermMemory, LongTermCategory, ShortTermMemory } from '../types/memory';
import { generateId } from './memoRepository';

/**
 * The agent's "experience". Long-term memory survives reloads; short-term
 * memory deliberately does not — it is what is happening in *this* session
 * and must not be carried into the next conversation. Promoting short-term
 * findings into long-term is an explicit act (consolidate).
 */

const LONG_TERM_KEY = 'class10_memory_long';

let activeSessionId = 'default';
let shortTermMemoriesBySession: Record<string, ShortTermMemory[]> = {};

const readLongTerm = (): LongTermMemory[] => {
  try {
    const raw = localStorage.getItem(LONG_TERM_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to read long-term memory', e);
    return [];
  }
};

const writeLongTerm = (memories: LongTermMemory[]): void => {
  try {
    localStorage.setItem(LONG_TERM_KEY, JSON.stringify(memories));
  } catch (e) {
    console.error('Failed to write long-term memory', e);
  }
};

export const memoryRepository = {
  setActiveSessionId(sessionId: string): void {
    if (sessionId) {
      activeSessionId = sessionId;
    }
  },

  getActiveSessionId(): string {
    return activeSessionId;
  },

  listLongTerm(): LongTermMemory[] {
    return readLongTerm().sort((a, b) => b.updatedAt - a.updatedAt);
  },

  /**
   * Upserts by (category, key). A new value only wins when it is at least
   * as confident as what is already stored, so a confirmed fact is never
   * clobbered by a later guess.
   */
  saveLongTerm(input: {
    category: LongTermCategory;
    key: string;
    value: string;
    confidence?: number;
    sourceSessionId?: string;
  }): { memory: LongTermMemory; applied: boolean } {
    const memories = readLongTerm();
    const confidence = Math.min(1, Math.max(0, input.confidence ?? 0.7));
    const now = Date.now();
    const index = memories.findIndex(
      memory => memory.category === input.category && memory.key === input.key
    );

    if (index >= 0) {
      const existing = memories[index];
      if (confidence < existing.confidence) {
        return { memory: existing, applied: false };
      }
      const updated: LongTermMemory = {
        ...existing,
        value: input.value,
        confidence,
        updatedAt: now,
        sourceSessionId: input.sourceSessionId ?? existing.sourceSessionId
      };
      memories[index] = updated;
      writeLongTerm(memories);
      return { memory: updated, applied: true };
    }

    const created: LongTermMemory = {
      id: generateId('ltm'),
      category: input.category,
      key: input.key,
      value: input.value,
      confidence,
      createdAt: now,
      updatedAt: now,
      sourceSessionId: input.sourceSessionId
    };
    writeLongTerm([created, ...memories]);
    return { memory: created, applied: true };
  },

  deleteLongTerm(id: string): boolean {
    const memories = readLongTerm();
    const next = memories.filter(memory => memory.id !== id);
    if (next.length === memories.length) return false;
    writeLongTerm(next);
    return true;
  },

  clearLongTerm(): void {
    localStorage.removeItem(LONG_TERM_KEY);
  },

  listShortTerm(sessionId?: string): ShortTermMemory[] {
    const sid = sessionId || activeSessionId;
    return [...(shortTermMemoriesBySession[sid] || [])].sort((a, b) => b.createdAt - a.createdAt);
  },

  saveShortTerm(topic: string, detail: string, sessionId?: string): ShortTermMemory {
    const sid = sessionId || activeSessionId;
    const memory: ShortTermMemory = {
      id: generateId('stm'),
      topic,
      detail,
      createdAt: Date.now()
    };
    const current = shortTermMemoriesBySession[sid] || [];
    shortTermMemoriesBySession[sid] = [
      memory,
      ...current.filter(item => item.topic !== topic)
    ].slice(0, 30);
    return memory;
  },

  clearShortTerm(sessionId?: string): void {
    const sid = sessionId || activeSessionId;
    delete shortTermMemoriesBySession[sid];
  },

  /**
   * Promotes the current session's short-term notes into long-term memory,
   * then clears the short-term store. Called when a session wraps up or
   * when the agent decides something is worth remembering permanently.
   */
  consolidate(
    entries: Array<{ category: LongTermCategory; key: string; value: string; confidence?: number }>,
    sourceSessionId?: string
  ): LongTermMemory[] {
    const sid = sourceSessionId || activeSessionId;
    const saved = entries.map(
      entry => memoryRepository.saveLongTerm({ ...entry, sourceSessionId: sid }).memory
    );
    memoryRepository.clearShortTerm(sid);
    return saved;
  }
};

/**
 * Renders both memory stores as the compact text block injected into the
 * agent's runtime context every turn.
 */
export function buildMemoryContext(sessionId?: string): string {
  const longTerm = memoryRepository.listLongTerm();
  const shortTerm = memoryRepository.listShortTerm(sessionId);

  const longTermText = longTerm.length
    ? longTerm.map(m => `- [${m.category}] ${m.key}：${m.value}`).join('\n')
    : '（尚無長程記憶）';
  const shortTermText = shortTerm.length
    ? shortTerm.map(m => `- ${m.topic}：${m.detail}`).join('\n')
    : '（尚無短程記憶）';

  return `【長程記憶／關於主人的長期事實】\n${longTermText}\n\n【短程記憶／本次工作階段的近況】\n${shortTermText}`;
}
