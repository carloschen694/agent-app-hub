import React from 'react';
import { LONG_TERM_CATEGORY_LABELS } from '../types/memory';
import type { LongTermMemory, ShortTermMemory } from '../types/memory';

export interface KnowledgeViewerProps {
  longTerm: LongTermMemory[];
  shortTerm: ShortTermMemory[];
  onForgetLongTerm: (id: string) => void;
  onClearShortTerm: () => void;
}

const formatTime = (value: number) =>
  new Date(value).toLocaleString('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

/**
 * Read-only window onto what the assistant currently believes about the
 * user. Long-term entries can be forgotten (that is a correction, not
 * editing), but nothing here is editable in place — the agent owns the
 * wording, the user owns whether it survives.
 */
export const KnowledgeViewer: React.FC<KnowledgeViewerProps> = ({
  longTerm,
  shortTerm,
  onForgetLongTerm,
  onClearShortTerm
}) => (
  <div className="space-y-6 p-4">
    <section className="space-y-2">
      <header className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-slate-800">長程記憶</h3>
        <span className="text-[11px] text-slate-400">跨對話保留．共 {longTerm.length} 筆</span>
      </header>
      {longTerm.length === 0 ? (
        <p className="rounded border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
          助理還不認識你。聊一聊，它會慢慢把長期不變的事記下來。
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded border border-slate-200">
          {longTerm.map(memory => (
            <li key={memory.id} className="flex items-start gap-3 px-3 py-2">
              <span className="mt-0.5 shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                {LONG_TERM_CATEGORY_LABELS[memory.category]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-slate-700">{memory.key}</span>
                <span className="block break-words text-sm text-slate-800">{memory.value}</span>
                <span className="block text-[10px] text-slate-400">
                  把握度 {Math.round(memory.confidence * 100)}%．更新於 {formatTime(memory.updatedAt)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onForgetLongTerm(memory.id)}
                title="忘記這一則"
                className="material-symbols-outlined shrink-0 text-[16px] text-slate-300 hover:text-red-500"
              >
                delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>

    <section className="space-y-2">
      <header className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-slate-800">短程記憶</h3>
        <span className="flex items-baseline gap-2 text-[11px] text-slate-400">
          <span>重整頁面即清空．共 {shortTerm.length} 筆</span>
          {shortTerm.length > 0 && (
            <button type="button" onClick={onClearShortTerm} className="text-blue-600 hover:underline">
              清空
            </button>
          )}
        </span>
      </header>
      {shortTerm.length === 0 ? (
        <p className="rounded border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
          本次工作階段還沒有累積近況。
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded border border-slate-200">
          {shortTerm.map(memory => (
            <li key={memory.id} className="px-3 py-2">
              <span className="block text-xs font-medium text-slate-700">{memory.topic}</span>
              <span className="block break-words text-sm text-slate-800">{memory.detail}</span>
              <span className="block text-[10px] text-slate-400">{formatTime(memory.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  </div>
);
