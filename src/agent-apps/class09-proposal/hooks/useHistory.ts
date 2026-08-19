import { useState, useCallback } from 'react';
import type { ProposalDoc } from '../types';
import { saveDoc } from '../services/storageService';

const MAX_HISTORY = 20;

export function useProposalHistory() {
  const [past, setPast] = useState<ProposalDoc[]>([]);
  const [present, setPresent] = useState<ProposalDoc | null>(null);
  const [future, setFuture] = useState<ProposalDoc[]>([]);

  const setDoc = useCallback((next: ProposalDoc) => {
    const updated = { ...next, updatedAt: Date.now() };
    saveDoc(updated);
    setPast(p => [...p.slice(-(MAX_HISTORY - 1)), ...(present ? [present] : [])]);
    setPresent(updated);
    setFuture([]);
  }, [present]);

  const loadDoc = useCallback((doc: ProposalDoc | null) => {
    setPast([]);
    setPresent(doc);
    setFuture([]);
  }, []);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    setPast(p => p.slice(0, -1));
    setFuture(f => (present ? [present, ...f] : f));
    setPresent(prev);
    if (prev) saveDoc(prev);
  }, [past, present]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture(f => f.slice(1));
    setPast(p => (present ? [...p, present] : p));
    setPresent(next);
    if (next) saveDoc(next);
  }, [future, present]);

  return {
    doc: present,
    setDoc,
    loadDoc,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
