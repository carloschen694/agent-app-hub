import React, { useEffect, useState } from 'react';
import type { AgentActivity } from '../types/agent';
import type { LiveInteractionStatus } from '../services/liveInteractionService';

interface AgentActivityIndicatorProps {
  activity: AgentActivity;
  liveStatus: LiveInteractionStatus;
}

interface ActivityDisplay {
  busy: boolean;
  icon: string;
  label: string;
  detail?: string;
}

function resolveDisplay(
  activity: AgentActivity,
  liveStatus: LiveInteractionStatus
): ActivityDisplay {
  if (activity.state === 'thinking') {
    return {
      busy: true,
      icon: 'psychology',
      label: 'Thinking',
      detail: activity.detail ?? '正在思考與推理回應內容…'
    };
  }
  if (activity.state === 'task') {
    return {
      busy: true,
      icon: 'checklist',
      label: 'Long task',
      detail: activity.detail ?? '正在執行長任務…'
    };
  }
  if (activity.state === 'tool') {
    return {
      busy: true,
      icon: 'construction',
      label: 'Running tool',
      detail: activity.detail ?? '正在執行工具…'
    };
  }

  switch (liveStatus) {
    case 'connecting':
      return { busy: true, icon: 'wifi_tethering', label: 'Live voice', detail: '正在連線即時語音…' };
    case 'listening':
      return { busy: true, icon: 'mic', label: 'Live voice', detail: '正在聆聽使用者說話…' };
    case 'speaking':
      return { busy: true, icon: 'graphic_eq', label: 'Live voice', detail: '正在以語音回覆…' };
    case 'interrupted':
      return { busy: true, icon: 'front_hand', label: 'Live voice', detail: '語音回覆被打斷，回到聆聽…' };
    default:
      return { busy: false, icon: 'bedtime', label: 'Idle', detail: 'Agent 目前閒置中，等待你的訊息。' };
  }
}

export const AgentActivityIndicator: React.FC<AgentActivityIndicatorProps> = ({
  activity,
  liveStatus
}) => {
  const display = resolveDisplay(activity, liveStatus);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!display.busy) {
      setElapsedSeconds(0);
      return;
    }
    setElapsedSeconds(Math.floor((Date.now() - activity.since) / 1000));
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - activity.since) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [display.busy, activity.since, activity.state, activity.detail]);

  return (
    <div className="mt-2 flex items-start gap-1.5 pl-1 text-xs">
      <div
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white shadow-sm ${
          display.busy ? 'animate-pulse bg-slate-900' : 'bg-slate-300'
        }`}
      >
        <span className="material-symbols-outlined text-[11px] font-bold">smart_toy</span>
      </div>

      <div
        className={`flex max-w-[85%] flex-col gap-0.5 rounded-2xl rounded-bl-sm border px-2.5 py-1.5 shadow-sm ${
          display.busy
            ? 'border-blue-100 bg-blue-50/70 text-slate-600'
            : 'border-slate-100 bg-white text-slate-400'
        }`}
      >
        <div className="flex items-center gap-1.5">
          <span
            className={`material-symbols-outlined text-[13px] ${
              display.busy ? 'animate-pulse text-blue-600' : 'text-slate-300'
            }`}
          >
            {display.icon}
          </span>
          <span className={`font-semibold ${display.busy ? 'text-slate-700' : 'text-slate-400'}`}>
            {display.label}
          </span>
          {display.busy && (
            <>
              <span className="flex items-center gap-0.5">
                <span className="h-1 w-1 animate-bounce rounded-full bg-blue-400" style={{ animationDelay: '0ms' }}></span>
                <span className="h-1 w-1 animate-bounce rounded-full bg-blue-400" style={{ animationDelay: '150ms' }}></span>
                <span className="h-1 w-1 animate-bounce rounded-full bg-blue-400" style={{ animationDelay: '300ms' }}></span>
              </span>
              {elapsedSeconds > 0 && (
                <span className="text-[10px] tabular-nums text-slate-400">{elapsedSeconds}s</span>
              )}
            </>
          )}
        </div>
        {display.detail && (
          <div className="text-[10px] leading-relaxed">{display.detail}</div>
        )}
      </div>
    </div>
  );
};
