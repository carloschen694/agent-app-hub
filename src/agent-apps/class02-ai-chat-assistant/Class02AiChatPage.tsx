import React from 'react';
import { useAgent } from '../../agent/hooks/useAgent';

export const Class02AiChatPage: React.FC = () => {
  const { setUiState } = useAgent();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 inline-flex items-center gap-2 rounded bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600">
          <span className="material-symbols-outlined text-sm">school</span>
          class02 / example03
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Gemini AI 互動助理</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          這個範例已整合到 Agent App Hub。原本 example03 自己實作的浮動聊天視窗、
          API Key 設定、模型選擇與 Session 管理，現在統一由右下角的共用 Agent 殼層提供。
        </p>
        <button
          type="button"
          onClick={() => setUiState({ isOpened: true })}
          className="mt-5 inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <span className="material-symbols-outlined text-base">chat</span>
          開啟右下角 AI 助理
        </button>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ['settings', '設定集中化', 'API Key、Model、System Prompt 由 Hub 共用設定面板管理。'],
          ['forum', '多輪對話', 'Session 建立、切換、刪除與對話歷史由共用 Agent runtime 處理。'],
          ['error', '錯誤處理', 'API Key、額度與伺服器忙碌等錯誤會轉成課堂可讀的中文提示。'],
        ].map(([icon, title, desc]) => (
          <div key={title} className="rounded-lg border border-slate-200 bg-white p-4">
            <span className="material-symbols-outlined text-blue-600">{icon}</span>
            <h2 className="mt-2 text-sm font-semibold text-slate-800">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">{desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
};
