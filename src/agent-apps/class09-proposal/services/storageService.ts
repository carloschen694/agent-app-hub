import type { ProposalDoc, DocSummary, VersionSnapshot } from '../types';

const INDEX_KEY = 'class09-proposal-index';
const CURRENT_KEY = 'class09-proposal-current';
const docKey = (id: string) => `class09-proposal-doc-${id}`;
const versionsKey = (id: string) => `class09-proposal-versions-${id}`;
const MAX_SNAPSHOTS = 10;

export function loadIndex(): DocSummary[] {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function saveIndex(summaries: DocSummary[]): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(summaries));
}

export function loadDoc(id: string): ProposalDoc | null {
  try {
    const raw = localStorage.getItem(docKey(id));
    return raw ? (JSON.parse(raw) as ProposalDoc) : null;
  } catch {
    return null;
  }
}

export function saveDoc(doc: ProposalDoc): void {
  localStorage.setItem(docKey(doc.id), JSON.stringify(doc));
  const index = loadIndex();
  const i = index.findIndex(s => s.id === doc.id);
  const summary: DocSummary = { id: doc.id, title: doc.title, updatedAt: doc.updatedAt };
  if (i >= 0) {
    index[i] = summary;
  } else {
    index.unshift(summary);
  }
  saveIndex(index);
}

export function deleteDoc(id: string): void {
  localStorage.removeItem(docKey(id));
  localStorage.removeItem(versionsKey(id));
  saveIndex(loadIndex().filter(s => s.id !== id));
}

export function loadVersions(docId: string): VersionSnapshot[] {
  try {
    return JSON.parse(localStorage.getItem(versionsKey(docId)) ?? '[]');
  } catch {
    return [];
  }
}

export function saveVersionSnapshot(docId: string, snapshot: VersionSnapshot): void {
  const versions = loadVersions(docId);
  versions.push(snapshot);
  localStorage.setItem(versionsKey(docId), JSON.stringify(versions.slice(-MAX_SNAPSHOTS)));
}

export function getCurrentDocId(): string | null {
  return localStorage.getItem(CURRENT_KEY);
}

export function setCurrentDocId(id: string | null): void {
  if (id) {
    localStorage.setItem(CURRENT_KEY, id);
  } else {
    localStorage.removeItem(CURRENT_KEY);
  }
}

export function exportDocAsJson(doc: ProposalDoc): void {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${doc.title}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importDocFromJson(json: string): ProposalDoc | null {
  try {
    return JSON.parse(json) as ProposalDoc;
  } catch {
    return null;
  }
}

export function incrementVersion(current: string, type: 'major' | 'minor' | 'patch'): string {
  const [maj, min, pat] = current.split('.').map(Number);
  if (type === 'major') return `${maj + 1}.0.0`;
  if (type === 'minor') return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
}
