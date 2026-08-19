import React from 'react';
import { useAgentUiState } from '../hooks/useAgentUiState';
import { useAgent } from '../hooks/useAgent';
import { isLiveModel } from '../services/liveInteractionService';

export const AgentLauncher: React.FC = () => {
  const { isOpened, toggleOpen } = useAgentUiState();
  const {
    settings,
    activeAppManifest,
    liveStatus,
    liveError,
    startRealtimeVoice,
    stopRealtimeVoice
  } = useAgent();

  const hasLiveCredential = Boolean(settings.liveApiKey);
  const canUseRealtimeVoice =
    Boolean(activeAppManifest?.supportsRealtimeVoice) &&
    hasLiveCredential &&
    isLiveModel(settings.liveModel);
  const shouldShowRealtimeVoice = Boolean(activeAppManifest?.supportsRealtimeVoice);
  const isVoiceActive = liveStatus !== 'idle' && liveStatus !== 'error';
  const voiceUnavailableReason = !hasLiveCredential
    ? '請先在 Agent 設定中填入 Gemini Live API Key'
    : !isLiveModel(settings.liveModel)
      ? '目前 Realtime voice model 不支援即時語音'
      : 'Start realtime voice';

  // The floating mic is a standalone realtime-voice toggle. It must not
  // open or close the chat view — the chat view has its own mic that only
  // does speech-to-text input.
  const toggleRealtimeVoice = () => {
    if (isVoiceActive) {
      stopRealtimeVoice();
      return;
    }
    void startRealtimeVoice();
  };

  return (
    // When the chat window is open it occupies the bottom-right corner, so
    // the standalone mic moves to the bottom-left to stay reachable.
    <div className={`fixed bottom-5 z-[60] flex items-center gap-2 sm:bottom-6 ${isOpened ? 'left-5 sm:left-6' : 'right-5 sm:right-6'}`}>
      {/* The chat window shows its own liveError banner, but only while
          open — the standalone mic can be used with the window closed, so
          it needs its own visible failure indicator too. */}
      {!isOpened && liveError && (
        <div className="max-w-[220px] rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white shadow-lg">
          {liveError}
        </div>
      )}
      {shouldShowRealtimeVoice && (
        <button
          id="agent-live-voice-btn"
          onClick={toggleRealtimeVoice}
          disabled={!canUseRealtimeVoice && !isVoiceActive}
          className={`flex items-center justify-center rounded-full p-3 shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            isVoiceActive
              ? 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
              : canUseRealtimeVoice
                ? 'bg-slate-700 text-white hover:bg-slate-800 focus:ring-slate-500'
                : 'cursor-not-allowed bg-slate-200 text-slate-400 shadow-sm focus:ring-slate-300'
          }`}
          title={isVoiceActive ? 'Stop realtime voice' : voiceUnavailableReason}
        >
          <span className="material-symbols-outlined text-xl font-bold">
            {isVoiceActive ? 'mic_off' : 'mic'}
          </span>
        </button>
      )}

      {!isOpened && (
        <button
          id="agent-launcher-btn"
          onClick={toggleOpen}
          className="flex items-center justify-center rounded-full bg-blue-600 p-4 text-white shadow-lg transition-all duration-200 hover:bg-blue-700 hover:shadow-xl active:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          title="Open AI assistant"
        >
          <span className="material-symbols-outlined text-2xl font-bold">
            chat
          </span>
        </button>
      )}
    </div>
  );
};
