import React, { useState, useRef } from 'react';
import { marked } from 'marked';
import type { ProposalBlock } from '../types';

// Inline-only markdown (bold, italic, code, links) — no wrapping <p>
const inlineMd = (text: string) => ({
  __html: marked.parseInline(text) as string,
});

// Block markdown (paragraphs, lists, code blocks, etc.)
const blockMd = (text: string) => ({
  __html: marked.parse(text) as string,
});

interface Props {
  block: ProposalBlock;
  onUpdate: (updated: ProposalBlock) => void;
  onDelete: () => void;
  onAiRewrite: (userPrompt: string) => void;
}

export const DocumentBlock: React.FC<Props> = ({ block, onUpdate, onDelete, onAiRewrite }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [showRewritePrompt, setShowRewritePrompt] = useState(false);
  const [rewritePrompt, setRewritePrompt] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);

  const startEdit = () => {
    const current = typeof block.content === 'string' ? block.content : '';
    setEditValue(current);
    setIsEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const commitEdit = () => {
    if (typeof block.content === 'string') {
      onUpdate({ ...block, content: editValue });
    }
    setIsEditing(false);
  };

  const openRewritePrompt = () => {
    setShowRewritePrompt(true);
    setRewritePrompt('');
    setTimeout(() => promptInputRef.current?.focus(), 0);
  };

  const submitRewrite = () => {
    const prompt = rewritePrompt.trim();
    if (!prompt) return;
    onAiRewrite(prompt);
    setShowRewritePrompt(false);
    setRewritePrompt('');
  };

  const cancelRewrite = () => {
    setShowRewritePrompt(false);
    setRewritePrompt('');
  };

  const renderContent = () => {
    const text = typeof block.content === 'string' ? block.content : '';
    const tableData = Array.isArray(block.content) ? (block.content as string[][]) : null;

    switch (block.type) {
      case 'h1':
        return <h1 className="text-2xl font-bold text-gray-900 mt-6 mb-2" dangerouslySetInnerHTML={inlineMd(text)} />;
      case 'h2':
        return <h2 className="text-xl font-semibold text-gray-800 mt-5 mb-2" dangerouslySetInnerHTML={inlineMd(text)} />;
      case 'h3':
        return <h3 className="text-base font-semibold text-gray-700 mt-4 mb-1" dangerouslySetInnerHTML={inlineMd(text)} />;
      case 'paragraph':
        return (
          <div
            className="prose prose-sm prose-slate max-w-none my-2 text-gray-700"
            dangerouslySetInnerHTML={blockMd(text)}
          />
        );
      case 'list_item':
        return (
          <div className="flex gap-2 my-1 text-sm text-gray-700">
            <span className="shrink-0 mt-1 text-gray-400">•</span>
            <span dangerouslySetInnerHTML={inlineMd(text)} />
          </div>
        );
      case 'table':
        if (!tableData || tableData.length === 0) return null;
        return (
          <div className="my-3 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <tbody>
                {tableData.map((row, ri) => (
                  <tr key={ri} className={ri === 0 ? 'bg-gray-100 font-semibold' : 'even:bg-gray-50'}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="border border-gray-200 px-3 py-1.5 text-gray-700">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
    }
  };

  const isTextBlock = block.type !== 'table';

  return (
    <div className="group relative">
      {/* Block content or manual edit textarea */}
      {isEditing && isTextBlock ? (
        <div className="my-1">
          <textarea
            ref={textareaRef}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && block.type !== 'paragraph') {
                e.preventDefault();
                commitEdit();
              }
              if (e.key === 'Escape') setIsEditing(false);
            }}
            rows={block.type === 'paragraph' ? 4 : 2}
            className="w-full border border-blue-300 rounded px-2 py-1 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
      ) : (
        renderContent()
      )}

      {/* Hover action toolbar */}
      {!isEditing && !showRewritePrompt && (
        <div className="absolute right-0 top-0 hidden group-hover:flex gap-1 bg-white border border-gray-200 rounded shadow-sm px-1 py-0.5 z-10">
          <button
            onClick={openRewritePrompt}
            className="p-1 text-xs text-gray-500 hover:text-purple-600"
            title="AI 改寫"
          >
            ✨
          </button>
          {isTextBlock && (
            <button
              onClick={startEdit}
              className="p-1 text-xs text-gray-500 hover:text-blue-600"
              title="手動編輯"
            >
              ✏️
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-1 text-xs text-gray-500 hover:text-red-500"
            title="刪除"
          >
            🗑️
          </button>
        </div>
      )}

      {/* AI rewrite prompt panel */}
      {showRewritePrompt && (
        <div className="mt-2 mb-1 rounded-lg border border-purple-200 bg-purple-50 p-3 shadow-sm">
          <p className="text-xs font-medium text-purple-700 mb-2 flex items-center gap-1">
            <span>✨</span> AI 改寫 — 告訴 AI 你想怎麼調整這段內容
          </p>
          <textarea
            ref={promptInputRef}
            value={rewritePrompt}
            onChange={e => setRewritePrompt(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitRewrite();
              }
              if (e.key === 'Escape') cancelRewrite();
            }}
            placeholder="例如：改得更簡潔、加入數據佐證、換成更正式的語氣…"
            rows={2}
            className="w-full border border-purple-200 rounded px-2.5 py-1.5 text-xs text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white placeholder-gray-400"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={cancelRewrite}
              className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
            >
              取消
            </button>
            <button
              onClick={submitRewrite}
              disabled={!rewritePrompt.trim()}
              className="text-xs text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed rounded px-3 py-1 font-medium transition-colors"
            >
              送出給 AI ↗
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
