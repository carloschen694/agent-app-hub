import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAgent } from '../../../agent/hooks/useAgent';
import { TalkingHeadAvatar } from './TalkingHeadAvatar';
import { parseStreamEmotion } from '../services/emotionParser';
import {
  clearAllNotifications,
  dismissPipContent,
  emitPipReply,
  getPipMountNode,
  removeNotification,
  setActiveNotification,
  subscribePip
} from '../services/pipService';
import { memoRepository } from '../repositories/memoRepository';
import { liveAssistanceStore } from '../store/liveAssistanceStore';
import type { PipState } from '../types/pip';

type AvatarMode = 'auto' | 'full' | 'compact' | 'off';

const AVATAR_MODE_LABELS: Record<AvatarMode, string> = {
  auto: '自動 (雙模式)',
  full: '滿版 3D 人像',
  compact: '圓形小頭像',
  off: '關閉'
};

interface PipHostProps {
  micActive: boolean;
  onToggleMic: () => void;
  /** Fired when the user answers via option button or free text. */
  onReply: (text: string) => void;
  modelUrl?: string;
  cameraView?: 'head' | 'upper' | 'full';
  liveTranscript?: string;
}

function getIframeBootstrap(origin: string): string {
  return `
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
<script>
  // Agent HTML can call window.reply('...') or use [data-reply] attributes.
  window.reply = function (value) {
    var msg = { source: 'class10-pip', value: String(value) };
    try { if (parent) parent.postMessage(msg, '*'); } catch (e) {}
    try { if (window.top && window.top !== parent) window.top.postMessage(msg, '*'); } catch (e) {}
    try { if (window.opener) window.opener.postMessage(msg, '*'); } catch (e) {}
  };
  document.addEventListener('click', function (event) {
    var el = event.target.closest('[data-reply]');
    if (el) window.reply(el.getAttribute('data-reply'));
  });

  // Automatic repair for YouTube Embed Error 153 in PiP Window
  function fixYouTubeEmbeds() {
    var mainOrigin = "${origin}";
    var ytFrames = document.querySelectorAll('iframe[src*="youtube.com"], iframe[src*="youtu.be"]');
    ytFrames.forEach(function (frame) {
      var src = frame.getAttribute('src');
      if (src) {
        frame.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
        if (mainOrigin && !src.includes('origin=')) {
          var sep = src.includes('?') ? '&' : '?';
          src += sep + 'enablejsapi=1&origin=' + encodeURIComponent(mainOrigin) + '&widget_referrer=' + encodeURIComponent(mainOrigin);
          frame.setAttribute('src', src);
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fixYouTubeEmbeds);
  } else {
    fixYouTubeEmbeds();
  }

  // Links must escape the tiny overlay rather than navigate it.
  document.addEventListener('click', function (event) {
    var link = event.target.closest('a[href]');
    if (link) link.target = '_blank';
  });
</script>
<style>
  body { margin: 0; padding: 12px; font-family: Inter, system-ui, sans-serif;
         font-size: 13px; line-height: 1.6; color: #0f172a; background: #ffffff; }
  img, video, table { max-width: 100%; }
  a { color: #2563eb; }
  h1, h2, h3 { font-size: 15px; margin: 12px 0 6px; }
  ul, ol { padding-left: 18px; }
  .embed-wrapper, .sketchfab-embed-wrapper { position: relative; width: 100%; min-height: 240px; margin: 10px 0; border-radius: 10px; overflow: hidden; background: #f8fafc; border: 1px solid #e2e8f0; }
  .embed-wrapper iframe, .sketchfab-embed-wrapper iframe { width: 100%; min-height: 240px; border: 0; }
</style>
`;
}

export const PipHost: React.FC<PipHostProps> = ({
  micActive,
  onToggleMic,
  onReply,
  modelUrl,
  cameraView = 'head'
}) => {
  const [state, setState] = useState<PipState | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [showNotificationList, setShowNotificationList] = useState(false);
  const [avatarMode, setAvatarMode] = useState<AvatarMode>('auto');
  const [memoSaved, setMemoSaved] = useState(false);

  const { liveStatus, liveTranscript } = useAgent();
  const speaking = liveStatus === 'speaking';

  const parsedEmotion = useMemo(() => {
    return parseStreamEmotion(liveTranscript || '');
  }, [liveTranscript]);

  const activeNotification = state?.activeNotificationId
    ? state.notifications.find(n => n.id === state.activeNotificationId)
    : null;

  const gazeTarget = useMemo(() => {
    if (activeNotification) return 'screen';
    if (liveStatus === 'speaking' || liveStatus === 'listening') return 'user';
    return 'user';
  }, [activeNotification, liveStatus]);

  const mountNode = getPipMountNode();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => subscribePip(setState), []);

  const handleSaveHtmlToMemo = () => {
    const html = state?.content?.html;
    if (!html) return;
    const match = html.match(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/i);
    const rawTitle = match ? match[1].replace(/<[^>]*>/g, '').trim() : '';
    const title = rawTitle || `HTML 卡片 - ${new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`;
    const summaryText = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);

    memoRepository.create({
      title,
      summary: summaryText,
      type: 'html',
      htmlContent: html,
      tags: ['HTML卡片', '來自浮動視窗']
    });

    liveAssistanceStore.emit('memos-changed');
    setMemoSaved(true);
    setTimeout(() => setMemoSaved(false), 2000);
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.source === 'class10-pip' && typeof event.data.value === 'string') {
        emitPipReply({ value: event.data.value });
        onReply(event.data.value);
      }
    };
    const targetWin = mountNode?.ownerDocument?.defaultView || window;
    targetWin.addEventListener('message', handleMessage);
    if (targetWin !== window) {
      window.addEventListener('message', handleMessage);
    }
    return () => {
      targetWin.removeEventListener('message', handleMessage);
      if (targetWin !== window) {
        window.removeEventListener('message', handleMessage);
      }
    };
  }, [mountNode, onReply]);

  const content = state?.content ?? null;

  const mainOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const srcDoc = useMemo(
    () => (content?.html ? `${getIframeBootstrap(mainOrigin)}${content.html}` : ''),
    [content?.html, mainOrigin]
  );

  if (!mountNode || !state?.open) return null;

  const submitReply = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    emitPipReply({ text: trimmed });
    onReply(trimmed);
    setInputValue('');
    dismissPipContent();
  };

  const hasContent = Boolean(content || showNotificationList);
  const effectiveMode = avatarMode === 'auto' ? (hasContent ? 'compact' : 'full') : avatarMode;

  const cycleAvatarMode = () => {
    setAvatarMode(prev => {
      if (prev === 'auto') return 'full';
      if (prev === 'full') return 'compact';
      if (prev === 'compact') return 'off';
      return 'auto';
    });
  };

  return createPortal(
    <div className="relative flex h-screen flex-col bg-white text-slate-900 overflow-hidden">
      <header className="z-40 flex items-center gap-2 border-b border-slate-200 bg-white/95 backdrop-blur px-3 py-2">
        <button
          type="button"
          onClick={onToggleMic}
          aria-label={micActive ? '停止語音對談' : '開始語音對談'}
          className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
            micActive ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {micActive ? 'mic' : 'mic_off'}
          </span>
        </button>

        <span className="flex-1 truncate text-[11px] font-medium tracking-wide text-slate-400">
          即時協作助理
        </span>

        {/* Avatar Mode Toggle Button */}
        <button
          type="button"
          onClick={cycleAvatarMode}
          aria-label={`切換 3D 人像模式 (${AVATAR_MODE_LABELS[avatarMode]})`}
          title={`3D 人像模式：${AVATAR_MODE_LABELS[avatarMode]}（點擊切換模式）`}
          className={`relative inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
            effectiveMode !== 'off'
              ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
              : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {effectiveMode === 'full' ? 'face' : effectiveMode === 'compact' ? 'face_6' : 'person_off'}
          </span>
          {avatarMode !== 'auto' && (
            <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-purple-600 ring-2 ring-white" />
          )}
        </button>

        {/* Notifications Button */}
        <button
          type="button"
          onClick={() => setShowNotificationList(!showNotificationList)}
          aria-label="通知清單"
          className={`relative inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
            showNotificationList ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">notifications</span>
          {state.hasBadge && (
            <span
              className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white"
              aria-label="有新訊息"
            />
          )}
        </button>
      </header>

      {/* Main Body Area */}
      {effectiveMode === 'full' ? (
        <div className="relative flex-1 flex flex-col bg-slate-900 overflow-hidden items-center justify-center">
          <TalkingHeadAvatar
            modelUrl={modelUrl}
            cameraView={cameraView}
            speaking={speaking}
            liveTranscript={liveTranscript}
            mood={parsedEmotion.mood}
            gazeTarget={gazeTarget}
            width="100%"
            height="100%"
          />
          {hasContent && (
            <button
              type="button"
              onClick={() => setAvatarMode('compact')}
              className="absolute top-3 inset-x-auto rounded-full bg-slate-900/80 backdrop-blur px-3 py-1 text-[11px] text-blue-300 border border-blue-500/30 hover:bg-blue-600 hover:text-white transition-colors"
            >
              有新資訊卡片 (點擊查看)
            </button>
          )}
          {!speaking && (
            <div className="absolute bottom-3 inset-x-0 text-center text-[11px] text-slate-400/80 font-medium pointer-events-none">
              3D 助理對嘴模式開啟中
            </div>
          )}
        </div>
      ) : showNotificationList ? (
        <div className="flex flex-1 flex-col overflow-hidden bg-slate-50">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2">
            <span className="text-[12px] font-semibold text-slate-700">
              通知清單 ({state.notifications.length})
            </span>
            {state.notifications.length > 0 && (
              <button
                type="button"
                onClick={() => clearAllNotifications()}
                className="text-[11px] font-medium text-red-600 hover:text-red-700"
              >
                全部清除
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {state.notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-1">
                <span className="material-symbols-outlined text-2xl">notifications_off</span>
                <span className="text-xs">尚無通知記錄</span>
              </div>
            ) : (
              state.notifications.map(notif => {
                const isActive = notif.id === state.activeNotificationId;
                return (
                  <div
                    key={notif.id}
                    onClick={() => {
                      setActiveNotification(notif.id);
                      setShowNotificationList(false);
                    }}
                    className={`group flex items-start gap-2.5 rounded-lg border p-2.5 text-left text-xs transition-colors cursor-pointer ${
                      isActive
                        ? 'border-blue-500 bg-blue-50/70 text-slate-900 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className={`material-symbols-outlined text-[16px] mt-0.5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>
                      {notif.content.layout === 'prompt' ? 'help_outline' : 'info'}
                    </span>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-[12px] text-slate-900 truncate">
                          {notif.title}
                        </span>
                        {!notif.read && (
                          <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0" aria-label="未讀" />
                        )}
                      </div>
                      <p className="line-clamp-2 text-[11px] text-slate-500 leading-snug">
                        {notif.summary}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="刪除通知"
                      onClick={e => {
                        e.stopPropagation();
                        removeNotification(notif.id);
                      }}
                      className="opacity-60 hover:opacity-100 p-0.5 text-slate-400 hover:text-red-600 transition-opacity"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {!content && (
            <p className="px-4 py-6 text-center text-xs text-slate-400">
              助理待命中，有需要時會在這裡出現。
            </p>
          )}

          {content?.layout === 'content' && (
            <iframe
              ref={iframeRef}
              title="助理訊息"
              srcDoc={srcDoc}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-modals allow-downloads"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; xr-spatial-tracking; web-share; fullscreen"
              referrerPolicy="strict-origin-when-cross-origin"
              className="h-full w-full border-0"
            />
          )}

          {content?.layout === 'prompt' && (
            <div className="space-y-3 p-3">
              {content.message && (
                <p className="text-[13px] leading-relaxed text-slate-800">{content.message}</p>
              )}
              {content.showInput && (
                <input
                  value={inputValue}
                  onChange={event => setInputValue(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') submitReply(inputValue);
                  }}
                  placeholder={content.inputPlaceholder ?? '輸入回覆…'}
                  className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-[13px] focus:border-blue-500 focus:outline-none"
                />
              )}
              <div className="space-y-1.5">
                {content.options?.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => submitReply(option.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-left text-[13px] text-slate-700 transition-colors hover:border-blue-500 hover:bg-blue-50"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating Compact Avatar Overlay (when in compact mode) */}
      {effectiveMode === 'compact' && (
        <div
          title="3D 助理頭像（點擊切換滿版模式）"
          onClick={() => setAvatarMode('full')}
          className="absolute bottom-12 right-3 z-30 h-[102px] w-[102px] cursor-pointer rounded-full border-3 border-purple-500 bg-slate-900 shadow-2xl overflow-hidden transition-transform hover:scale-110 active:scale-95 ring-2 ring-purple-300/40"
        >
          <TalkingHeadAvatar
            modelUrl={modelUrl}
            cameraView={cameraView}
            speaking={speaking}
            liveTranscript={liveTranscript}
            width="100%"
            height="100%"
          />
        </div>
      )}

      {!showNotificationList && content && (
        <footer className="flex items-center justify-between border-t border-slate-200 px-3 py-1.5 bg-slate-50">
          {content.html ? (
            <button
              type="button"
              onClick={handleSaveHtmlToMemo}
              className="inline-flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-700 transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-[14px]">{memoSaved ? 'check' : 'bookmark_add'}</span>
              {memoSaved ? '已存入 Memo' : '存為 Memo'}
            </button>
          ) : (
            <div />
          )}
          <button
            type="button"
            onClick={dismissPipContent}
            className="rounded px-3 py-1 text-[11px] font-medium tracking-wide text-slate-500 hover:bg-slate-200 hover:text-slate-700"
          >
            DISMISS
          </button>
        </footer>
      )}
    </div>,
    mountNode
  );
};
