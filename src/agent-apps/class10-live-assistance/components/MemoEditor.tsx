import React, { useEffect, useState } from 'react';
import { marked } from 'marked';
import { getScreenshot } from '../repositories/memoRepository';
import { showPipContent } from '../services/pipService';
import type { Memo } from '../types/memo';

export interface MemoEditorProps {
  memo: Memo;
  onChange: (patch: Partial<Memo>) => void;
}

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({
  label,
  hint,
  children
}) => (
  <label className="block space-y-1">
    <span className="flex items-baseline gap-2">
      <span className="text-xs font-medium text-slate-700">{label}</span>
      {hint && <span className="text-[10px] text-slate-400">{hint}</span>}
    </span>
    {children}
  </label>
);

const inputClass =
  'w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none';

export const MemoEditor: React.FC<MemoEditorProps> = ({ memo, onChange }) => {
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [todoDraft, setTodoDraft] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [htmlViewMode, setHtmlViewMode] = useState<'iframe' | 'source'>('iframe');
  const [markdownViewMode, setMarkdownViewMode] = useState<'preview' | 'edit'>('preview');
  const [expandMeta, setExpandMeta] = useState(false);

  const isHtmlMemo = memo.type === 'html' || Boolean(memo.htmlContent);

  useEffect(() => {
    let cancelled = false;
    Promise.all(memo.screenshotIds.map(getScreenshot)).then(results => {
      if (!cancelled) setScreenshots(results.filter((item): item is string => Boolean(item)));
    });
    return () => {
      cancelled = true;
    };
  }, [memo.screenshotIds]);

  const addTag = () => {
    const tag = tagDraft.trim();
    if (!tag || memo.tags.includes(tag)) return;
    onChange({ tags: [...memo.tags, tag] });
    setTagDraft('');
  };

  const removeTag = (tag: string) => {
    onChange({ tags: memo.tags.filter(t => t !== tag) });
  };

  const addTodo = () => {
    const text = todoDraft.trim();
    if (!text) return;
    onChange({ todos: [...memo.todos, { text, done: false }] });
    setTodoDraft('');
  };

  const toggleTodo = (index: number) => {
    const next = memo.todos.map((item, i) => (i === index ? { ...item, done: !item.done } : item));
    onChange({ todos: next });
  };

  const removeTodo = (index: number) => {
    onChange({ todos: memo.todos.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      {/* --- Top Title & Summary Section --- */}
      <div className="space-y-3">
        <Field label="標題 (Title)">
          <input
            type="text"
            value={memo.title}
            onChange={event => onChange({ title: event.target.value })}
            className={`${inputClass} font-semibold text-base`}
            placeholder="請輸入 Memo 標題..."
          />
        </Field>

        <Field label="摘要 (Summary)" hint="顯示在清單卡片上的簡短描述">
          <textarea
            value={memo.summary}
            onChange={event => onChange({ summary: event.target.value })}
            rows={2}
            className={`${inputClass} resize-y text-xs`}
            placeholder="請輸入簡短摘要..."
          />
        </Field>

        {memo.translation && (
          <Field label="翻譯結果 (Translation)">
            <textarea
              value={memo.translation}
              onChange={event => onChange({ translation: event.target.value })}
              rows={3}
              className={`${inputClass} resize-y text-xs bg-slate-50`}
            />
          </Field>
        )}
      </div>

      {/* --- Metadata Collapsible (Tags, Todos, Screenshots, Sources) --- */}
      <div className="rounded border border-slate-200 bg-slate-50/70 p-2.5">
        <button
          type="button"
          onClick={() => setExpandMeta(!expandMeta)}
          className="flex w-full items-center justify-between text-xs font-semibold text-slate-700 hover:text-slate-900"
        >
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-slate-500">sell</span>
            標籤與後續整理 (Tags & Metadata)
            <span className="rounded-full bg-slate-200 px-1.5 py-0.2 text-[10px] text-slate-600">
              {memo.tags.length} 標籤 · {memo.todos.length} 待辦 · {screenshots.length} 截圖
            </span>
          </span>
          <span className="material-symbols-outlined text-[18px]">
            {expandMeta ? 'expand_less' : 'expand_more'}
          </span>
        </button>

        {expandMeta && (
          <div className="mt-3 space-y-3 border-t border-slate-200 pt-3 text-xs">
            {/* Tags */}
            <Field label="標籤 (Tags)">
              <div className="flex flex-wrap items-center gap-1.5">
                {memo.tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:text-blue-900"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={tagDraft}
                    onChange={e => setTagDraft(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    placeholder="新增標籤..."
                    className="rounded border border-slate-300 px-2 py-0.5 text-xs focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-300"
                  >
                    +
                  </button>
                </div>
              </div>
            </Field>

            {/* Todos */}
            <Field label="待辦事項 (Todos)">
              <div className="space-y-1.5">
                {memo.todos.map((todo, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={todo.done}
                        onChange={() => toggleTodo(idx)}
                        className="rounded border-slate-300 text-blue-600"
                      />
                      <span className={todo.done ? 'line-through text-slate-400' : ''}>
                        {todo.text}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => removeTodo(idx)}
                      className="text-slate-400 hover:text-red-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={todoDraft}
                    onChange={e => setTodoDraft(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTodo())}
                    placeholder="新增待辦..."
                    className="flex-1 rounded border border-slate-300 px-2 py-0.5 text-xs focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={addTodo}
                    className="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-300"
                  >
                    +
                  </button>
                </div>
              </div>
            </Field>

            {/* Screenshots */}
            {screenshots.length > 0 && (
              <Field label="隨附截圖 (Screenshots)">
                <div className="flex flex-wrap gap-2 pt-1">
                  {screenshots.map((url, idx) => (
                    <img
                      key={idx}
                      src={url}
                      alt={`截圖 ${idx + 1}`}
                      onClick={() => setPreviewImage(url)}
                      className="h-16 w-24 object-cover rounded border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity"
                    />
                  ))}
                </div>
              </Field>
            )}

            {/* Source URLs */}
            {memo.sourceUrls && memo.sourceUrls.length > 0 && (
              <Field label="參考來源 (Sources)">
                <ul className="space-y-1 list-disc pl-4 text-xs text-blue-600">
                  {memo.sourceUrls.map((src, idx) => (
                    <li key={idx}>
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline"
                      >
                        {src.title || src.url}
                      </a>
                    </li>
                  ))}
                </ul>
              </Field>
            )}
          </div>
        )}
      </div>

      {/* --- Main Content Section --- */}
      <div className="space-y-2 pt-1 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-blue-600">article</span>
            Memo 內容 (Content)
          </span>

          {isHtmlMemo ? (
            <div className="flex items-center gap-1 rounded bg-slate-100 p-0.5 border border-slate-200">
              <button
                type="button"
                onClick={() => setHtmlViewMode('iframe')}
                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  htmlViewMode === 'iframe'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">preview</span>
                HTML 預覽
              </button>
              <button
                type="button"
                onClick={() => setHtmlViewMode('source')}
                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  htmlViewMode === 'source'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">code</span>
                原始碼 (Source)
              </button>
              <button
                type="button"
                onClick={() =>
                  showPipContent({
                    title: memo.title,
                    html: memo.htmlContent || memo.content,
                    layout: 'content'
                  })
                }
                className="inline-flex items-center gap-1 rounded bg-blue-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors shadow-sm ml-1"
                title="將這個 HTML 小程式加載至 PIP 浮動視窗中播放與互動"
              >
                <span className="material-symbols-outlined text-[14px]">picture_in_picture_alt</span>
                載入至 PIP 視窗
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 rounded bg-slate-100 p-0.5 border border-slate-200">
              <button
                type="button"
                onClick={() => setMarkdownViewMode('preview')}
                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  markdownViewMode === 'preview'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">preview</span>
                Markdown 預覽
              </button>
              <button
                type="button"
                onClick={() => setMarkdownViewMode('edit')}
                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  markdownViewMode === 'edit'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">edit_note</span>
                純文字編輯
              </button>
            </div>
          )}
        </div>

        {isHtmlMemo ? (
          htmlViewMode === 'iframe' ? (
            <iframe
              srcDoc={memo.htmlContent || memo.content}
              title="HTML Memo 預覽"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-modals allow-downloads"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; xr-spatial-tracking; web-share; fullscreen"
              referrerPolicy="strict-origin-when-cross-origin"
              className="h-[420px] w-full rounded-lg border border-slate-200 bg-white shadow-sm"
            />
          ) : (
            <textarea
              value={memo.htmlContent ?? memo.content}
              onChange={event =>
                onChange({
                  htmlContent: event.target.value,
                  content: event.target.value
                })
              }
              rows={16}
              className={`${inputClass} resize-y font-mono text-xs leading-relaxed`}
            />
          )
        ) : markdownViewMode === 'preview' ? (
          <div
            className="h-[380px] w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-800 shadow-sm prose max-w-none"
            dangerouslySetInnerHTML={{
              __html: marked.parse(memo.content || '*(無內容)*') as string
            }}
          />
        ) : (
          <textarea
            value={memo.content}
            onChange={event => onChange({ content: event.target.value })}
            rows={14}
            className={`${inputClass} resize-y font-mono text-[13px] leading-relaxed`}
          />
        )}
      </div>

      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <div className="relative max-h-[90vh] max-w-[90vw] overflow-auto rounded-lg bg-white p-2 shadow-2xl">
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/70 text-white hover:bg-slate-900"
            >
              ✕
            </button>
            <img
              src={previewImage}
              alt="截圖放大預覽"
              className="max-h-[85vh] max-w-[85vw] object-contain rounded"
            />
          </div>
        </div>
      )}
    </div>
  );
};
