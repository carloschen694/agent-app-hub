export type ReportMode = 'replace' | 'append';

type Listener = (html: string, title?: string, mode?: ReportMode) => void;

let listener: Listener | null = null;

export const sandboxStore = {
  emit(html: string, title?: string, mode: ReportMode = 'replace') {
    listener?.(html, title, mode);
  },
  subscribe(fn: Listener) {
    listener = fn;
    return () => { listener = null; };
  },
};
