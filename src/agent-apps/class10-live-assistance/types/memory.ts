export type LongTermCategory =
  | 'identity'
  | 'goal'
  | 'domain'
  | 'preference'
  | 'solved';

export const LONG_TERM_CATEGORY_LABELS: Record<LongTermCategory, string> = {
  identity: '身分資料',
  goal: '目標',
  domain: '領域知識',
  preference: '偏好',
  solved: '已解決的問題'
};

/**
 * Things about the master that rarely change — name, job, service domain,
 * domain model, problems already solved. Persisted across sessions.
 */
export interface LongTermMemory {
  id: string;
  category: LongTermCategory;
  key: string;
  value: string;
  /** 0–1. Lets the agent overwrite a guess with a confirmed fact. */
  confidence: number;
  createdAt: number;
  updatedAt: number;
  sourceSessionId?: string;
}

/**
 * What is happening right now — current task, current focus, the problem
 * being worked on. Deliberately in-memory only: it must NOT leak into the
 * next conversation. Consolidation promotes a summary into long-term.
 */
export interface ShortTermMemory {
  id: string;
  topic: string;
  detail: string;
  createdAt: number;
}
