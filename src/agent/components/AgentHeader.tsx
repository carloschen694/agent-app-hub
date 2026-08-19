import React from 'react';
import { useAgentUiState } from '../hooks/useAgentUiState';
import { useAgentSession } from '../hooks/useAgentSession';
import type { ZoomState } from '../context/AgentContext';

export const AgentHeader: React.FC = () => {
  const {
    zoomState,
    isSettingsPanelOpen,
    isSessionsListOpen,
    setUiState,
    toggleOpen
  } = useAgentUiState();
  const { createNewSession } = useAgentSession();

  const handleZoomToggle = () => {
    const order: ZoomState[] = ['small', 'large', 'panel'];
    const currentIndex = order.indexOf(zoomState);
    const nextIndex = (currentIndex + 1) % order.length;
    setUiState({ zoomState: order[nextIndex] });
  };

  const handleSettingsToggle = () => {
    setUiState({ isSettingsPanelOpen: !isSettingsPanelOpen, isSessionsListOpen: false });
  };

  const handleSessionsToggle = () => {
    setUiState({ isSessionsListOpen: !isSessionsListOpen, isSettingsPanelOpen: false });
  };

  const handleNewConversation = () => {
    createNewSession();
    setUiState({ isSessionsListOpen: false, isSettingsPanelOpen: false });
  };

  const zoomLabels: Record<ZoomState, string> = {
    small: 'Compact',
    large: 'Wide',
    panel: 'Docked',
    drawer: 'Drawer',
    fullscreen: 'Fullscreen'
  };

  return (
    <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3.5 py-3 text-slate-800 select-none">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={handleSessionsToggle}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-slate-100 ${
            isSessionsListOpen ? 'bg-slate-100 text-blue-700' : 'text-slate-500'
          }`}
          title="Conversation history"
        >
          <span className="material-symbols-outlined text-[19px]">forum</span>
        </button>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900">AI Assistant</div>
          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
            Search + Tools
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 text-xs font-medium">
        <button
          type="button"
          onClick={handleNewConversation}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          title="開始新對話"
        >
          <span className="material-symbols-outlined text-[18px]">edit_square</span>
        </button>

        <button
          type="button"
          onClick={handleZoomToggle}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          title={`Size: ${zoomLabels[zoomState]}`}
        >
          <span className="material-symbols-outlined text-[18px]">aspect_ratio</span>
        </button>

        <button
          type="button"
          onClick={handleSettingsToggle}
          className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-slate-100 ${
            isSettingsPanelOpen ? 'bg-slate-100 text-blue-700' : 'text-slate-500 hover:text-slate-900'
          }`}
          title="Settings"
        >
          <span className="material-symbols-outlined text-[18px]">settings</span>
        </button>

        <button
          type="button"
          onClick={toggleOpen}
          className="ml-1 flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          title="Close"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
    </div>
  );
};
