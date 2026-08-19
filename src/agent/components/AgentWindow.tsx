import React from 'react';
import { useAgentUiState } from '../hooks/useAgentUiState';
import { useAgentChat } from '../hooks/useAgentChat';
import { AgentHeader } from './AgentHeader';
import { AgentMessageList } from './AgentMessageList';
import { AgentInputBox } from './AgentInputBox';
import { AgentSettingsPanel } from './AgentSettingsPanel';
import { AgentSessionList } from './AgentSessionList';
import { AgentTaskList } from './AgentTaskList';
import { useAgent } from '../hooks/useAgent';
import { getAgentWindowClasses } from './agentWindowClasses';

export const AgentWindow: React.FC = () => {
  const { isOpened, zoomState, isSettingsPanelOpen, isSessionsListOpen, toggleOpen } = useAgentUiState();
  const { messages, sendMessage, isLoading } = useAgentChat();
  const { activeAppManifest, agentActivity, taskPlan, liveStatus, liveTranscript, liveError } = useAgent();

  if (!isOpened) return null;

  return (
    <div id="agent-window" className={getAgentWindowClasses(zoomState)}>
      {/* Drag-handle affordance: only visible on the mobile bottom sheet (hidden the
          moment a `sm:`+ layout takes over), signals "swipe/tap away to dismiss". */}
      {zoomState !== 'fullscreen' && (
        <button
          type="button"
          onClick={toggleOpen}
          aria-label="Close"
          className="flex h-5 w-full shrink-0 items-center justify-center sm:hidden"
        >
          <span className="h-1.5 w-10 rounded-full bg-slate-300" />
        </button>
      )}

      {/* 1. Header (Always Visible) */}
      <AgentHeader />

      {/* 2. Content Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {isSessionsListOpen ? (
          <AgentSessionList />
        ) : isSettingsPanelOpen ? (
          <AgentSettingsPanel />
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <AgentMessageList
              messages={messages}
              onFollowupClick={sendMessage}
              isLoading={isLoading}
              activity={agentActivity}
              liveStatus={liveStatus}
            />
            {taskPlan && <AgentTaskList plan={taskPlan} />}
            {(liveStatus !== 'idle' || liveError) && (
              <div
                className={`border-t px-3 py-2 text-[11px] ${
                  liveError
                    ? 'border-red-100 bg-red-50 text-red-700'
                    : 'border-slate-200 bg-slate-50 text-slate-500'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">
                    {liveError ? 'error' : liveStatus === 'speaking' ? 'graphic_eq' : 'mic'}
                  </span>
                  <span className="font-semibold">
                    {liveError ? 'Live voice error' : `Live voice: ${liveStatus}`}
                  </span>
                </div>
                {liveError ? (
                  <div className="mt-1 break-words text-[10px]">{liveError}</div>
                ) : liveTranscript ? (
                  <div className="mt-1 truncate text-slate-600">{liveTranscript}</div>
                ) : null}
              </div>
            )}
            <AgentInputBox
              onSend={sendMessage}
              disabled={isLoading}
              supportedUploads={activeAppManifest?.supportedUploads}
            />
          </div>
        )}
      </div>
    </div>
  );
};
