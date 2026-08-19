import React from 'react';
import { showPipContent } from '../services/pipService';
import type { Memo } from '../types/memo';

export interface MemoListPanelProps {
  memos: Memo[];
  selectedId: string | null;
  query: string;
  activeTag: string | null;
  allTags: string[];
  onQueryChange: (query: string) => void;
  onTagChange: (tag: string | null) => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onExport: () => void;
}

const formatDate = (value: number) =>
  new Date(value).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' });

export type MemoViewMode = 'list' | 'small-card' | 'large-card';

const CARD_IFRAME_BOOTSTRAP = `
<script>
  document.addEventListener('click', function (e) { e.preventDefault(); });
  document.addEventListener('DOMContentLoaded', function () {
    var ytFrames = document.querySelectorAll('iframe[src*="youtube.com"], iframe[src*="youtu.be"]');
    ytFrames.forEach(function (frame) {
      if (!frame.getAttribute('referrerpolicy')) {
        frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      }
    });
  });
</script>
<style>
  body { margin: 0; padding: 8px; font-family: Inter, system-ui, sans-serif; font-size: 11px; line-height: 1.4; color: #1e293b; background: #ffffff; overflow: hidden; }
  img, video, table { max-width: 100%; }
  h1, h2, h3 { font-size: 12px; margin: 4px 0; }
  ul, ol { padding-left: 14px; }
  .embed-wrapper, .sketchfab-embed-wrapper { position: relative; width: 100%; min-height: 120px; margin: 4px 0; border-radius: 6px; overflow: hidden; background: #f8fafc; }
  .embed-wrapper iframe, .sketchfab-embed-wrapper iframe { width: 100%; min-height: 120px; border: 0; }
</style>
`;

export const MemoListPanel: React.FC<MemoListPanelProps> = ({
  memos,
  selectedId,
  query,
  activeTag,
  allTags,
  onQueryChange,
  onTagChange,
  onSelect,
  onCreate,
  onDelete,
  onExport
}) => {
  const [expandAdvanced, setExpandAdvanced] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<MemoViewMode>('small-card');

  return (
    <div className="flex h-full flex-col border-r border-slate-200 bg-white">
      {/* Top Search & Controls */}
      <div className="space-y-2 border-b border-slate-200 p-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="material-symbols-outlined pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">
              search
            </span>
            <input
              value={query}
              onChange={event => onQueryChange(event.target.value)}
              placeholder="搜尋 memo…"
              className="w-full rounded border border-slate-300 py-1.5 pl-8 pr-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={onCreate}
            title="新增 memo"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
          </button>
        </div>

        {/* View Mode Switcher + Advanced Search Header */}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => setExpandAdvanced(!expandAdvanced)}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
          >
            <span className="material-symbols-outlined text-[15px]">tune</span>
            高級搜尋與標籤 {activeTag ? `(${activeTag})` : ''}
            <span className="material-symbols-outlined text-[15px]">
              {expandAdvanced ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {/* View Mode Switcher Buttons */}
          <div className="flex items-center gap-0.5 rounded bg-slate-100 p-0.5 border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              title="清單模式"
              className={`p-1 rounded text-slate-600 hover:text-slate-900 transition-colors ${
                viewMode === 'list' ? 'bg-white shadow-sm text-blue-600 font-bold' : ''
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">view_list</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('small-card')}
              title="小卡片模式"
              className={`p-1 rounded text-slate-600 hover:text-slate-900 transition-colors ${
                viewMode === 'small-card' ? 'bg-white shadow-sm text-blue-600 font-bold' : ''
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">grid_view</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('large-card')}
              title="大卡片模式 (可直接載入 HTML 小程式)"
              className={`p-1 rounded text-slate-600 hover:text-slate-900 transition-colors ${
                viewMode === 'large-card' ? 'bg-white shadow-sm text-blue-600 font-bold' : ''
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">view_agenda</span>
            </button>
          </div>
        </div>

        {/* Collapsible Advanced Tag Drawer */}
        {expandAdvanced && allTags.length > 0 && (
          <div className="rounded-lg bg-slate-50 p-2.5 space-y-1.5 border border-slate-100 shadow-inner mt-2">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>按標籤篩選：</span>
              {activeTag && (
                <button
                  type="button"
                  onClick={() => onTagChange(null)}
                  className="text-blue-600 hover:underline"
                >
                  清除篩選
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {allTags.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onTagChange(activeTag === tag ? null : tag)}
                  className={`rounded-full px-2 py-0.5 text-[11px] transition-colors ${
                    activeTag === tag
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* --- List Content Area --- */}
      <div className="min-h-0 flex-1 overflow-y-auto p-2 bg-slate-50/40">
        {memos.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-slate-400">
            還沒有 memo。用語音說「幫我記一下」，或按上面的 + 自己新增。
          </p>
        ) : viewMode === 'list' ? (
          /* --- View 1: Compact List View --- */
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
            {memos.map(memo => {
              const openTodos = memo.todos.filter(todo => !todo.done).length;
              const isHtml = memo.type === 'html' || Boolean(memo.htmlContent);
              return (
                <li key={memo.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(memo.id)}
                    className={`group flex w-full flex-col gap-1 px-3 py-2 text-left transition-colors ${
                      selectedId === memo.id ? 'bg-blue-50/80' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-start gap-2">
                      {isHtml && (
                        <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                          HTML
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                        {memo.title}
                      </span>
                      <span className="shrink-0 text-[10px] text-slate-400">{formatDate(memo.updatedAt)}</span>
                      <span
                        role="button"
                        tabIndex={0}
                        title="刪除"
                        onClick={event => {
                          event.stopPropagation();
                          onDelete(memo.id);
                        }}
                        onKeyDown={event => {
                          if (event.key === 'Enter') {
                            event.stopPropagation();
                            onDelete(memo.id);
                          }
                        }}
                        className="material-symbols-outlined shrink-0 text-[15px] text-slate-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                      >
                        delete
                      </span>
                    </span>
                    <span className="line-clamp-1 text-xs text-slate-500 flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate">{memo.summary || '（沒有摘要）'}</span>
                      {openTodos > 0 && (
                        <span className="shrink-0 text-[10px] text-amber-600 font-medium">
                          {openTodos} 待辦
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : viewMode === 'small-card' ? (
          /* --- View 2: Small Grid Cards View --- */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {memos.map(memo => {
              const isHtml = memo.type === 'html' || Boolean(memo.htmlContent);
              const openTodos = memo.todos.filter(todo => !todo.done).length;
              const isSelected = selectedId === memo.id;
              return (
                <div
                  key={memo.id}
                  onClick={() => onSelect(memo.id)}
                  className={`group relative flex flex-col justify-between rounded-lg border p-2.5 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/60 shadow-md ring-1 ring-blue-400/50'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-1.5">
                      <span className="font-semibold text-xs text-slate-800 line-clamp-1 group-hover:text-blue-600 transition-colors">
                        {memo.title}
                      </span>
                      {isHtml && (
                        <span className="shrink-0 rounded bg-blue-100 border border-blue-200 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">
                          HTML
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                      {memo.summary || '（沒有摘要）'}
                    </p>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-1.5 text-[10px] text-slate-400">
                    <span>{formatDate(memo.updatedAt)}</span>
                    <div className="flex items-center gap-1.5">
                      {memo.screenshotIds.length > 0 && (
                        <span className="inline-flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[11px]">image</span>
                          {memo.screenshotIds.length}
                        </span>
                      )}
                      {openTodos > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-amber-600">
                          <span className="material-symbols-outlined text-[11px]">check_box</span>
                          {openTodos}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          onDelete(memo.id);
                        }}
                        className="material-symbols-outlined text-[14px] text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="刪除"
                      >
                        delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* --- View 3: Large Cards View (Direct HTML Execution) --- */
          <div className="space-y-3">
            {memos.map(memo => {
              const isHtml = memo.type === 'html' || Boolean(memo.htmlContent);
              const isSelected = selectedId === memo.id;
              return (
                <div
                  key={memo.id}
                  onClick={() => onSelect(memo.id)}
                  className={`group relative flex flex-col rounded-xl border p-3 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-white shadow-lg ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="material-symbols-outlined text-[18px] text-blue-600 shrink-0">
                        {isHtml ? 'code_blocks' : 'description'}
                      </span>
                      <h4 className="font-semibold text-sm text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                        {memo.title}
                      </h4>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isHtml && (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            showPipContent({
                              title: memo.title,
                              html: memo.htmlContent || memo.content,
                              layout: 'content'
                            });
                          }}
                          className="inline-flex items-center gap-1 rounded bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-blue-700 transition-colors shadow-sm"
                          title="載入至 PIP 浮動視窗"
                        >
                          <span className="material-symbols-outlined text-[12px]">picture_in_picture_alt</span>
                          載入至 PIP
                        </button>
                      )}
                      <span className="text-[10px] text-slate-400">{formatDate(memo.updatedAt)}</span>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          onDelete(memo.id);
                        }}
                        className="material-symbols-outlined text-[15px] text-slate-300 hover:text-red-500 transition-colors"
                        title="刪除"
                      >
                        delete
                      </button>
                    </div>
                  </div>

                  {memo.summary && (
                    <p className="py-2 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {memo.summary}
                    </p>
                  )}

                  {/* HTML Direct Embedded Preview */}
                  {isHtml && (memo.htmlContent || memo.content) ? (
                    <div className="mt-1 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 relative pointer-events-none">
                      <iframe
                        srcDoc={`${CARD_IFRAME_BOOTSTRAP}${memo.htmlContent || memo.content}`}
                        title={memo.title}
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-modals allow-downloads"
                        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; xr-spatial-tracking; web-share; fullscreen"
                        referrerPolicy="strict-origin-when-cross-origin"
                        className="h-36 w-full border-0 bg-white"
                      />
                      <div className="absolute inset-0 bg-transparent" />
                    </div>
                  ) : (
                    <div className="mt-1 rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs text-slate-500 font-mono line-clamp-3">
                      {memo.content || '（無內文）'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Export Button */}
      <div className="border-t border-slate-200 p-2 bg-white">
        <button
          type="button"
          onClick={onExport}
          disabled={memos.length === 0}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded border border-slate-300 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">description</span>
          匯出 Markdown 工作摘要
        </button>
      </div>
    </div>
  );
};
