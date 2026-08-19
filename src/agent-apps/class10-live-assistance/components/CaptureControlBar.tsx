import React from 'react';

type LampTone = 'on' | 'off' | 'warn';

interface LampProps {
  label: string;
  tone: LampTone;
  detail?: string;
}

const TONE_CLASSES: Record<LampTone, string> = {
  on: 'bg-emerald-500',
  off: 'bg-slate-300',
  warn: 'bg-amber-500'
};

const Lamp: React.FC<LampProps> = ({ label, tone, detail }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className={`h-2 w-2 rounded-full ${TONE_CLASSES[tone]} ${tone === 'on' ? 'animate-pulse' : ''}`} />
    <span className={tone === 'on' ? 'text-slate-700' : 'text-slate-400'}>{label}</span>
    {detail && <span className="text-slate-400">{detail}</span>}
  </span>
);

export interface CaptureControlBarProps {
  capturing: boolean;
  observing: boolean;
  voiceActive: boolean;
  pipOpen: boolean;
  pipPending: boolean;
  pipSupported: boolean;
  captureSupported: boolean;
  lastObservedAt: number | null;
  onToggleCapture: () => void;
  onToggleObserver: () => void;
  onToggleVoice: () => void;
  onOpenPip: () => void;
}

const formatTime = (value: number) =>
  new Date(value).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });

/**
 * The one thing that must always be visible: whether the assistant is
 * actually watching, listening, and able to reach the user. Three lamps
 * answer that at a glance; the buttons next to them change it.
 */
export const CaptureControlBar: React.FC<CaptureControlBarProps> = ({
  capturing,
  observing,
  voiceActive,
  pipOpen,
  pipPending,
  pipSupported,
  captureSupported,
  lastObservedAt,
  onToggleCapture,
  onToggleObserver,
  onToggleVoice,
  onOpenPip
}) => {
  const buttonClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs font-medium transition-colors ${
      active
        ? 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700'
        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
    } disabled:cursor-not-allowed disabled:opacity-50`;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 bg-white px-4 py-2.5">
      <div className="flex items-center gap-4 text-xs">
        <Lamp label="螢幕分享" tone={capturing ? 'on' : 'off'} />
        <Lamp
          label="主動觀察"
          tone={observing ? 'on' : 'off'}
          detail={observing && lastObservedAt ? `· ${formatTime(lastObservedAt)}` : undefined}
        />
        <Lamp label="語音對談" tone={voiceActive ? 'on' : 'off'} />
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onToggleCapture}
          disabled={!captureSupported}
          className={buttonClass(capturing)}
          title={captureSupported ? undefined : '此瀏覽器不支援螢幕擷取'}
        >
          <span className="material-symbols-outlined text-[16px]">
            {capturing ? 'stop_screen_share' : 'screen_share'}
          </span>
          {capturing ? '停止螢幕分享' : '開始螢幕分享'}
        </button>

        <button
          type="button"
          onClick={onToggleObserver}
          disabled={!capturing}
          className={buttonClass(observing)}
          title={capturing ? undefined : '請先開啟螢幕分享'}
        >
          <span className="material-symbols-outlined text-[16px]">visibility</span>
          {observing ? '停止主動觀察' : '開始主動觀察'}
        </button>

        <button type="button" onClick={onToggleVoice} className={buttonClass(voiceActive)}>
          <span className="material-symbols-outlined text-[16px]">{voiceActive ? 'mic' : 'mic_off'}</span>
          {voiceActive ? '結束語音' : '語音對談'}
        </button>

        <button
          type="button"
          onClick={onOpenPip}
          disabled={!pipSupported}
          className={`${buttonClass(pipOpen)} ${pipPending && !pipOpen ? 'ring-2 ring-amber-400' : ''}`}
          title={pipSupported ? undefined : '此瀏覽器不支援 Document Picture-in-Picture（需 Chrome / Edge 116+）'}
        >
          <span className="material-symbols-outlined text-[16px]">picture_in_picture</span>
          {pipOpen ? '浮動視窗已開啟' : pipPending ? '助理有話要說，開啟浮動視窗' : '開啟浮動視窗'}
        </button>
      </div>
    </div>
  );
};
