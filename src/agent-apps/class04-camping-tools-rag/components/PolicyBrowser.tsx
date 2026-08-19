import { useState } from 'react';
import { policyRetrievalService } from '../services/policyRetrievalService';

export function PolicyBrowser() {
  const chunks = policyRetrievalService.getAllChunks();
  const [openId, setOpenId] = useState<string | null>(chunks[0]?.id ?? null);

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-base font-semibold text-gray-800">服務規章章節目錄</h2>
      <p className="text-xs text-gray-400">點擊章節可展開原文內容，方便對照 AI 小助手的回答來源。</p>
      <ul className="mt-1 space-y-1.5">
        {chunks.map((chunk) => {
          const isOpen = openId === chunk.id;
          return (
            <li key={chunk.id} className="rounded-lg border border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : chunk.id)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <span className="min-w-0 truncate">{chunk.title}</span>
                <span className="material-symbols-outlined shrink-0 text-base text-gray-400">
                  {isOpen ? 'expand_less' : 'expand_more'}
                </span>
              </button>
              {isOpen && (
                <div className="border-t border-slate-100 px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap text-gray-600">
                  {chunk.content}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
