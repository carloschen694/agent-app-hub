import React, { useState } from 'react';
import { TalkingHeadAvatar } from './TalkingHeadAvatar';

export interface AvatarOverlayProps {
  open: boolean;
  onClose: () => void;
  speaking: boolean;
  liveTranscript?: string;
  mood?: 'happy' | 'neutral' | 'thinking' | 'sad';
  modelUrl?: string;
  cameraView?: 'head' | 'upper' | 'full';
}

export const AvatarOverlay: React.FC<AvatarOverlayProps> = ({
  open,
  onClose,
  speaking,
  liveTranscript,
  mood = 'neutral',
  modelUrl,
  cameraView = 'head'
}) => {
  const [testSpeaking, setTestSpeaking] = useState(false);

  if (!open) return null;

  const handleTestMouth = () => {
    setTestSpeaking(true);
    setTimeout(() => setTestSpeaking(false), 3000);
  };

  const isAvatarSpeaking = speaking || testSpeaking;

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col rounded-xl border border-slate-700 bg-slate-900 text-white shadow-2xl transition-all w-80 h-96 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px] text-blue-400">face_3</span>
          <span className="text-xs font-semibold tracking-wide text-slate-200">3D 人像對嘴助理</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleTestMouth}
            title="測試 3D 對嘴與講話動畫"
            className="rounded px-2 py-0.5 text-[10px] bg-blue-600/30 text-blue-300 hover:bg-blue-600/50 transition-colors"
          >
            測試對嘴
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉人像"
            className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      </div>

      {/* Main 3D Canvas Body */}
      <div className="relative flex-1 overflow-hidden">
        <TalkingHeadAvatar
          modelUrl={modelUrl}
          speaking={isAvatarSpeaking}
          textToSpeak={isAvatarSpeaking ? (liveTranscript || 'Hello, I am speaking with real-time lip sync.') : undefined}
          mood={mood}
          cameraView={cameraView}
        />

        {/* Floating status badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-slate-950/70 backdrop-blur-md px-2.5 py-1 text-[10px] font-medium border border-slate-800">
          <span
            className={`h-2 w-2 rounded-full ${
              isAvatarSpeaking ? 'bg-green-500 animate-pulse' : 'bg-slate-500'
            }`}
          />
          <span className="text-slate-300">{isAvatarSpeaking ? '發聲與對嘴中' : '待命中'}</span>
        </div>
      </div>

      {/* Footer Transcript Preview */}
      {liveTranscript && (
        <div className="border-t border-slate-800 bg-slate-950 px-3 py-1.5 text-[11px] text-slate-300 truncate">
          <span className="text-blue-400 font-medium mr-1">🎙️</span>
          {liveTranscript}
        </div>
      )}
    </div>
  );
};
