import React, { useRef } from 'react';
import type { DocSummary } from '../types';
import { importDocFromJson, saveDoc, loadIndex } from '../services/storageService';

interface Props {
  docList: DocSummary[];
  onOpenDoc: (id: string) => void;
  onCreateDoc: () => void;
  onDeleteDoc: (id: string) => void;
  onDocListChange: (list: DocSummary[]) => void;
}

export const FileManagerView: React.FC<Props> = ({
  docList,
  onOpenDoc,
  onCreateDoc,
  onDeleteDoc,
  onDocListChange,
}) => {
  const importRef = useRef<HTMLInputElement>(null);

  const formatDate = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60_000) return '剛剛';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分鐘前`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小時前`;
    if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`;
    return new Date(ts).toLocaleDateString('zh-TW');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const imported = importDocFromJson(ev.target?.result as string);
      if (imported) {
        saveDoc(imported);
        onDocListChange(loadIndex());
        onOpenDoc(imported.id);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">📋 AI 企劃書撰寫助手</h1>
            <p className="text-sm text-gray-500 mt-1">選擇企劃書開始編輯，或建立新文件</p>
          </div>
          <div className="flex gap-2">
            <input
              ref={importRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImport}
            />
            <button
              onClick={() => importRef.current?.click()}
              className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5 bg-white hover:bg-gray-50 transition-colors"
            >
              匯入 JSON
            </button>
            <button
              onClick={onCreateDoc}
              className="text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-4 py-1.5 font-medium transition-colors"
            >
              + 新增企劃書
            </button>
          </div>
        </div>

        {/* Empty state */}
        {docList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <span className="text-6xl">📄</span>
            <p className="text-gray-500 text-center">
              還沒有任何企劃書<br />
              <span className="text-sm">建立第一份文件，或在右側對話框告訴 AI 你需要什麼</span>
            </p>
            <button
              onClick={onCreateDoc}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800 border border-blue-300 rounded-lg px-5 py-2"
            >
              + 建立第一份企劃書
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* New doc card */}
            <button
              onClick={onCreateDoc}
              className="flex flex-col items-center justify-center gap-2 h-40 rounded-xl border-2 border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all"
            >
              <span className="text-3xl">＋</span>
              <span className="text-sm">新增企劃書</span>
            </button>

            {/* Document cards */}
            {docList.map(summary => (
              <div
                key={summary.id}
                className="group relative flex flex-col h-40 rounded-xl border border-gray-200 bg-white hover:border-blue-300 hover:shadow-md transition-all cursor-pointer overflow-hidden"
                onClick={() => onOpenDoc(summary.id)}
              >
                {/* Card top: icon area */}
                <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-3">
                  <span className="text-4xl">📋</span>
                </div>
                {/* Card bottom: info */}
                <div className="px-3 py-2 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-800 truncate">{summary.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(summary.updatedAt)}</p>
                </div>
                {/* Delete button — top right on hover */}
                <button
                  onClick={e => {
                    e.stopPropagation();
                    if (confirm(`確定要刪除「${summary.title}」嗎？`)) {
                      onDeleteDoc(summary.id);
                    }
                  }}
                  className="absolute top-2 right-2 hidden group-hover:flex items-center justify-center w-6 h-6 rounded-full bg-white/80 text-gray-400 hover:text-red-500 hover:bg-white text-sm shadow"
                  title="刪除"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
