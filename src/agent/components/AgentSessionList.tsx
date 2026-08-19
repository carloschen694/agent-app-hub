import React, { useState } from 'react';
import { useAgentSession } from '../hooks/useAgentSession';
import { useAgentUiState } from '../hooks/useAgentUiState';
import { agentAppRegistry } from '../../config/agentAppRegistry';

export const AgentSessionList: React.FC = () => {
  const {
    sessions,
    currentSession,
    switchSession,
    deleteSession,
    renameSession,
    clearAllSessions
  } = useAgentSession();
  const { setUiState } = useAgentUiState();

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleInput, setEditTitleInput] = useState('');

  const handleStartRename = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(id);
    setEditTitleInput(currentTitle);
  };

  const handleSaveRename = (id: string, e: React.FormEvent) => {
    e.preventDefault();
    if (editTitleInput.trim()) {
      renameSession(id, editTitleInput.trim());
    }
    setEditingSessionId(null);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm('確定要刪除此對話記錄嗎？')) {
      deleteSession(id);
    }
  };

  const handleClearAll = () => {
    if (window.confirm('確定要清除所有對話記錄嗎？此動作無法復原。')) {
      clearAllSessions();
    }
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${m}/${day} ${h}:${min}`;
  };

  const getAppLabel = (activeAppId?: string) => {
    if (!activeAppId || activeAppId === 'dashboard') return '大廳';
    return agentAppRegistry.find(app => app.agentAppId === activeAppId)?.agentAppName ?? '大廳';
  };

  const handleSelectSession = (id: string) => {
    switchSession(id);
    setUiState({ isSessionsListOpen: false });
  };

  return (
    <div className="flex flex-col h-full flex-1 bg-slate-50 text-gray-700 text-xs select-none">
      <div className="p-3 border-b border-slate-200 flex items-center">
        <span className="font-semibold text-gray-900 flex items-center gap-1">
          <span className="material-symbols-outlined text-base">forum</span>
          歷史對話
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {sessions.length === 0 ? (
          <div className="text-center text-gray-400 py-8">目前無對話記錄</div>
        ) : (
          sessions.map((s) => {
            const isSelected = currentSession?.id === s.id;
            const isEditing = editingSessionId === s.id;

            return (
              <div
                key={s.id}
                onClick={() => !isEditing && handleSelectSession(s.id)}
                className={`p-2.5 rounded border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50 border-blue-200 text-blue-900 font-medium'
                    : 'bg-white border-slate-200 hover:bg-slate-100 text-gray-700'
                }`}
              >
                {isEditing ? (
                  <form
                    onSubmit={(e) => handleSaveRename(s.id, e)}
                    onClick={(e) => e.stopPropagation()}
                    className="flex gap-1"
                  >
                    <input
                      type="text"
                      value={editTitleInput}
                      onChange={(e) => setEditTitleInput(e.target.value)}
                      className="flex-1 px-1.5 py-0.5 border border-blue-400 rounded text-xs focus:outline-none bg-white text-gray-800"
                      autoFocus
                      onBlur={() => setTimeout(() => setEditingSessionId(null), 200)}
                    />
                    <button
                      type="submit"
                      className="bg-blue-600 text-white rounded px-1.5 flex items-center justify-center"
                    >
                      <span className="material-symbols-outlined text-sm font-bold">done</span>
                    </button>
                  </form>
                ) : (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-start justify-between gap-1.5">
                      <span className="truncate flex-1 text-xs">{s.title}</span>
                      <div className="flex items-center gap-0.5 opacity-60 hover:opacity-100">
                        <button
                          onClick={(e) => handleStartRename(s.id, s.title, e)}
                          className="hover:text-blue-600 p-0.5"
                          title="重新命名"
                        >
                          <span className="material-symbols-outlined text-sm">edit</span>
                        </button>
                        <button
                          onClick={(e) => handleDelete(s.id, e)}
                          className="hover:text-red-600 p-0.5"
                          title="刪除對話"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-gray-400 font-normal">
                      <span>應用區: {getAppLabel(s.activeAppId)}</span>
                      <span>更新: {formatDate(s.updatedAt)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {sessions.length > 0 && (
        <div className="p-3 border-t border-slate-200">
          <button
            onClick={handleClearAll}
            className="w-full py-1.5 border border-red-200 hover:bg-red-50 text-red-600 rounded text-[11px] font-semibold text-center transition-colors"
          >
            清除所有歷史記錄
          </button>
        </div>
      )}
    </div>
  );
};
