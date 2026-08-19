/**
 * Tool handlers run outside React, so they announce data changes here and
 * the views re-read from the repositories. Same emit/subscribe shape as
 * class08's sandboxStore.
 */

export type LiveAssistanceEvent = 'memos-changed' | 'memory-changed' | 'report-ready';

type Listener = (event: LiveAssistanceEvent, payload?: unknown) => void;

const listeners = new Set<Listener>();

export const liveAssistanceStore = {
  emit(event: LiveAssistanceEvent, payload?: unknown) {
    listeners.forEach(listener => listener(event, payload));
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }
};
