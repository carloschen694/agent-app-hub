import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAgent } from '../../agent/hooks/useAgent';
import { CaptureControlBar } from './components/CaptureControlBar';
import { MemoListPanel } from './components/MemoListPanel';
import { MemoEditor } from './components/MemoEditor';
import { KnowledgeViewer } from './components/KnowledgeViewer';
import { AssistantSettingsPanel, type AssistantSettings } from './components/AssistantSettingsPanel';
import { PipHost } from './components/PipHost';
import { memoRepository, saveScreenshot } from './repositories/memoRepository';
import { buildMemoryContext, memoryRepository } from './repositories/memoryRepository';
import { buildMarkdownReport, downloadMarkdown } from './services/memoExportService';
import {
  isCaptureSupported,
  isCapturing,
  onCaptureStateChange,
  startCapture,
  stopCapture
} from './services/screenCaptureService';
import {
  getPipState,
  openPipWindow,
  showPipContent,
  subscribePip,
  subscribePipReply
} from './services/pipService';
import { GoogleAuthBanner } from './components/GoogleAuthBanner';
import { requestGoogleScope } from './services/googleAuthService';
import {
  intervalForProactiveness,
  startObserver,
  type ObserverHandle,
  type ObserverVerdict
} from './services/observerService';
import { liveAssistanceStore } from './store/liveAssistanceStore';
import { playVoiceEndChime } from './services/chimeService';
import { createMemoToolHandlers } from './tools/memoTools';
import { createCaptureToolHandlers } from './tools/captureTools';
import { createPipToolHandlers } from './tools/pipTools';
import { createMemoryToolHandlers } from './tools/memoryTools';
import { createGoogleToolHandlers } from './tools/googleTools';
import { PERSONALITY_PROFILES, buildPersonalityPrompt } from './prompts/personalityPrompts';
import type { Memo } from './types/memo';
import type { PipState } from './types/pip';

const SETTINGS_KEY = 'class10_assistant_settings';

const DEFAULT_ASSISTANT_SETTINGS: AssistantSettings = {
  personalityId: 'steady',
  voiceName: 'Puck',
  avatarEnabled: true,
  avatarModelUrl: new URL('./assets/avatars/avaturn.glb', import.meta.url).href,
  avatarCameraView: 'head'
};

const readAssistantSettings = (): AssistantSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_ASSISTANT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    console.error('Failed to read assistant settings', e);
  }
  return DEFAULT_ASSISTANT_SETTINGS;
};

type Tab = 'memos' | 'knowledge' | 'settings' | 'report';

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'memos', label: 'Memo', icon: 'sticky_note_2' },
  { id: 'knowledge', label: '記憶', icon: 'psychology' },
  { id: 'settings', label: '設定', icon: 'tune' },
  { id: 'report', label: '報告', icon: 'description' }
];

export const LiveAssistancePage: React.FC = () => {
  const {
    settings,
    registerToolHandlers,
    setRuntimeContext,
    setLiveOverrides,
    sendLiveVideoFrame,
    sendLiveText,
    sendMessageText,
    startRealtimeVoice,
    stopRealtimeVoice,
    liveStatus,
    liveTranscript,
    currentSession
  } = useAgent();

  const [assistantSettings, setAssistantSettings] = useState<AssistantSettings>(readAssistantSettings);
  const [tab, setTab] = useState<Tab>('memos');
  const [memos, setMemos] = useState<Memo[]>(() => memoRepository.list());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [memoryVersion, setMemoryVersion] = useState(0);
  const [capturing, setCapturing] = useState(isCapturing);
  const [observing, setObserving] = useState(false);
  const [lastObservedAt, setLastObservedAt] = useState<number | null>(null);
  const [pipState, setPipState] = useState<PipState>(getPipState);
  const [ttsSpeaking, setTtsSpeaking] = useState(false);
  const [report, setReport] = useState<{ title: string; markdown: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const lastScreenshotRef = useRef<string | null>(null);
  const observerRef = useRef<ObserverHandle | null>(null);
  const assistantSettingsRef = useRef(assistantSettings);
  assistantSettingsRef.current = assistantSettings;

  const personality = PERSONALITY_PROFILES[assistantSettings.personalityId];
  const voiceActive = liveStatus !== 'idle' && liveStatus !== 'error';

  useEffect(() => {
    if (currentSession?.id) {
      memoryRepository.setActiveSessionId(currentSession.id);
    }
  }, [currentSession?.id]);

  // --- Voice End Chime Listener -------------------------------------------
  const isSpeaking = liveStatus === 'speaking' || ttsSpeaking;
  const prevSpeakingRef = useRef(false);

  useEffect(() => {
    if (prevSpeakingRef.current && !isSpeaking) {
      playVoiceEndChime();
    }
    prevSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  // --- persistence of this app's own settings -----------------------------

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(assistantSettings));
    } catch (e) {
      console.error('Failed to save assistant settings', e);
    }
  }, [assistantSettings]);

  // --- subscriptions ------------------------------------------------------

  useEffect(() => onCaptureStateChange(setCapturing), []);
  useEffect(() => subscribePip(setPipState), []);
  useEffect(
    () =>
      subscribePipReply(async (reply) => {
        if (typeof reply?.value === 'string' && reply.value.startsWith('authorize:')) {
          const service = reply.value.split(':')[1] as 'contacts' | 'calendar' | 'gmail';
          if (service) {
            const ok = await requestGoogleScope(service);
            if (ok) {
              const serviceNames: Record<string, string> = {
                contacts: 'Google 聯絡人 (People API)',
                calendar: 'Google 行事曆 (Calendar API)',
                gmail: 'Gmail 電子郵件 (Gmail API)'
              };
              const name = serviceNames[service] || service;
              const notification = `[系統通知] 使用者已成功完成 ${name} 的授權！存取權限與 Token 已就緒。請接續執行使用者原本請求的需求。`;

              const sentLive = sendLiveText(notification);
              if (!sentLive) {
                sendMessageText(notification);
              }

              memoryRepository.saveShortTerm('授權狀態', `${name} 已於 ${new Date().toLocaleTimeString('zh-TW')} 授權成功`);
              setMemoryVersion(v => v + 1);

              showPipContent(
                {
                  layout: 'content',
                  html: `<div style="padding:12px;text-align:center;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;color:#166534;">
                    <div style="font-weight:600;font-size:14px;margin-bottom:4px;">✅ ${escapeHtml(name)} 授權成功！</div>
                    <div style="font-size:12px;color:#15803d;">助理已取得權限，正在繼續為您處理原先的需求...</div>
                  </div>`
                },
                { replace: true }
              );
            }
          }
        } else if (typeof reply?.value === 'string' || typeof reply?.text === 'string') {
          const text = reply.value || reply.text || '';
          if (text) {
            const sentLive = sendLiveText(text);
            if (!sentLive) {
              sendMessageText(text);
            }
          }
        }
      }),
    [sendLiveText, sendMessageText]
  );

  useEffect(
    () =>
      liveAssistanceStore.subscribe((event, payload) => {
        if (event === 'memos-changed') setMemos(memoRepository.list());
        if (event === 'memory-changed') setMemoryVersion(version => version + 1);
        if (event === 'report-ready') {
          const data = payload as { markdown: string; title: string };
          setReport(data);
          setTab('report');
        }
      }),
    []
  );

  // --- agent wiring -------------------------------------------------------

  const personalityPrompt = useMemo(
    () => buildPersonalityPrompt(personality, assistantSettings.userName),
    [personality, assistantSettings.userName]
  );

  useEffect(() => {
    const context = [
      '目前頁面：class10 即時協作助理。主人正在這個 app 裡管理 memo 與你的記憶。',
      personalityPrompt,
      '',
      buildMemoryContext(),
      '',
      '【浮動視窗 (PIP Window) 內容設計硬性規範】',
      '1. 必定採用 Light Mode (明亮模式)：以純白或極淺背景 (#ffffff / #f8fafc) 搭配深色文字。嚴禁使用 Dark Mode 深色背景。',
      '2. 多圖少字、美觀視覺：善加搭配圖片 (img)、圖示 (Material Symbols / iconfont)、Emoji 與 SVG/D3.js 圖表，避開長篇大論純文字。',
      '3. 資訊精要精確：內容簡明扼要，以實際具體數字、明確結論與可點擊連結 (target="_blank") 為主。',
      '',
      `目前狀態：螢幕分享${capturing ? '已開啟' : '未開啟'}、主動觀察${observing ? '執行中' : '未啟動'}、浮動視窗${pipState.open ? '已開啟' : '未開啟'}。`,
      pipState.open
        ? ''
        : '浮動視窗尚未開啟，PIP 工具送出的內容會先暫存，並提示主人手動開啟（瀏覽器規定必須由使用者手勢觸發）。'
    ]
      .filter(Boolean)
      .join('\n');
    setRuntimeContext(context);
  }, [
    setRuntimeContext,
    personalityPrompt,
    capturing,
    observing,
    pipState.open,
    memoryVersion,
    memos.length
  ]);

  // The shell owns the voice session, so persona and voice are handed to it
  // through the override interface rather than by opening our own connection.
  useEffect(() => {
    setLiveOverrides({
      voiceName: assistantSettings.voiceName,
      systemPromptSuffix: personalityPrompt,
      mediaResolution: 'MEDIA_RESOLUTION_HIGH'
    });
    return () => {
      setLiveOverrides(null);
      stopRealtimeVoice();
    };
  }, [setLiveOverrides, stopRealtimeVoice, assistantSettings.voiceName, personalityPrompt]);

  useEffect(() => {
    const handlers = {
      ...createCaptureToolHandlers({
        apiKey: settings.apiKey,
        model: settings.model,
        sendLiveVideoFrame,
        setLastScreenshot: (dataUrl: string) => {
          lastScreenshotRef.current = dataUrl;
        }
      }),
      ...createPipToolHandlers(),
      ...createMemoToolHandlers({ getLastScreenshot: () => lastScreenshotRef.current }),
      ...createMemoryToolHandlers({ getSessionId: () => currentSession?.id }),
      ...createGoogleToolHandlers()
    };
    registerToolHandlers(handlers);
    return () => registerToolHandlers({});
  }, [registerToolHandlers, settings.apiKey, settings.model, sendLiveVideoFrame, currentSession?.id]);

  // --- observer loop ------------------------------------------------------

  const handleVerdict = useCallback(
    async (verdict: ObserverVerdict, frame: string) => {
      setLastObservedAt(Date.now());
      if (verdict.activity) {
        memoryRepository.saveShortTerm('目前活動', verdict.activity);
      }
      if (verdict.intent) {
        memoryRepository.saveShortTerm('推測意圖', verdict.intent);
      }
      setMemoryVersion(version => version + 1);
      lastScreenshotRef.current = frame;

      let promptText: string | undefined;

      if (verdict.strugglingSignal && verdict.offer) {
        promptText = verdict.offer;
        memoryRepository.saveShortTerm('最近主動提問', verdict.offer);
        showPipContent(
          {
            layout: 'prompt',
            message: verdict.offer,
            options: [
              { label: '好，幫我處理', value: `好，請幫我處理：${verdict.offer}` },
              { label: '整理成 memo', value: '請把剛剛的資料、摘要與來源整理成一則 memo。' },
              { label: '先不用', value: '先不用，我自己來。' }
            ]
          },
          { replace: false }
        );
      } else if (verdict.shouldNotify && verdict.note) {
        promptText = verdict.note;
        memoryRepository.saveShortTerm('最近主動提示', verdict.note);
        showPipContent(
          {
            layout: 'content',
            html: `<div><p style="margin:0 0 8px;font-size:11px;color:#64748b">主動提示</p><div>${escapeHtml(
              verdict.note
            ).replace(/\n/g, '<br>')}</div></div>`
          },
          { replace: false }
        );
      }

      if (promptText && assistantSettingsRef.current.proactiveVoice !== false) {
        const sentToLive = sendLiveText(
          `[系統指示] 觀察到使用者畫面上狀況：${verdict.activity || '處理任務'}。請用語音簡短親切地向主人提問：${promptText}`
        );
        if (!sentToLive && typeof window !== 'undefined' && 'speechSynthesis' in window) {
          try {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(promptText);
            utterance.lang = 'zh-TW';
            utterance.onstart = () => setTtsSpeaking(true);
            utterance.onend = () => setTtsSpeaking(false);
            utterance.onerror = () => setTtsSpeaking(false);
            window.speechSynthesis.speak(utterance);
          } catch (e) {
            console.warn('Browser SpeechSynthesis error', e);
          }
        }
      }
    },
    [sendLiveText]
  );

  const stopObserver = useCallback(() => {
    observerRef.current?.stop();
    observerRef.current = null;
    setObserving(false);
  }, []);

  const toggleObserver = () => {
    if (observing) {
      stopObserver();
      return;
    }
    if (!settings.apiKey) {
      setNotice('請先在 Agent 設定中填入 API 金鑰，主動觀察才能運作。');
      return;
    }
    observerRef.current = startObserver({
      apiKey: settings.apiKey,
      model: settings.model,
      intervalMs: intervalForProactiveness(personality.proactiveness),
      buildContext: () =>
        `${buildPersonalityPrompt(PERSONALITY_PROFILES[assistantSettingsRef.current.personalityId])}\n\n${buildMemoryContext()}`,
      onVerdict: handleVerdict,
      onTick: setLastObservedAt,
      onError: error => console.error('Observer error', error)
    });
    setObserving(true);
  };

  // Watching a screen nobody is sharing is pointless; stop the loop with it.
  useEffect(() => {
    if (!capturing && observerRef.current) stopObserver();
  }, [capturing, stopObserver]);

  useEffect(() => () => observerRef.current?.stop(), []);

  // --- handlers -----------------------------------------------------------

  const toggleCapture = async () => {
    if (capturing) {
      stopCapture();
      return;
    }
    try {
      setNotice(null);
      await startCapture();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '無法開始螢幕分享。');
    }
  };

  const toggleVoice = async () => {
    if (voiceActive) {
      stopRealtimeVoice();
      return;
    }
    try {
      setNotice(null);
      await startRealtimeVoice();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '無法開始語音對談。');
    }
  };

  const handleOpenPip = async () => {
    try {
      const opened = await openPipWindow();
      if (!opened) setNotice('此瀏覽器不支援 Document Picture-in-Picture，請改用 Chrome / Edge 116 以上版本。');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '無法開啟浮動視窗。');
    }
  };

  const handlePipReply = (text: string) => {
    void sendMessageText(text);
  };

  const filteredMemos = useMemo(
    () => memoRepository.search(query, activeTag ? [activeTag] : undefined),
    // memos is the change signal; the repository is the source of truth.
    [query, activeTag, memos]
  );

  const selectedMemo = selectedId ? memos.find(memo => memo.id === selectedId) ?? null : null;

  const handleMemoChange = (patch: Partial<Memo>) => {
    if (!selectedMemo) return;
    memoRepository.update(selectedMemo.id, patch);
    setMemos(memoRepository.list());
  };

  const handleCreateMemo = () => {
    const memo = memoRepository.create({ title: '未命名 Memo', summary: '' });
    setMemos(memoRepository.list());
    setSelectedId(memo.id);
    setTab('memos');
  };

  const handleDeleteMemo = async (id: string) => {
    if (!window.confirm('確定要刪除這則 memo 嗎？刪除後無法復原。')) return;
    await memoRepository.remove(id);
    setMemos(memoRepository.list());
    if (selectedId === id) setSelectedId(null);
  };

  /** Also attaches whatever the assistant last looked at, so the memo keeps its evidence. */
  const handleAttachLastScreenshot = async () => {
    if (!selectedMemo || !lastScreenshotRef.current) return;
    const id = await saveScreenshot(lastScreenshotRef.current);
    memoRepository.update(selectedMemo.id, {
      screenshotIds: [...selectedMemo.screenshotIds, id]
    });
    setMemos(memoRepository.list());
  };

  const handleExport = () => {
    const markdown = buildMarkdownReport(filteredMemos, '工作摘要');
    setReport({ title: '工作摘要', markdown });
    setTab('report');
  };

  const longTerm = useMemo(() => memoryRepository.listLongTerm(), [memoryVersion]);
  const shortTerm = useMemo(() => memoryRepository.listShortTerm(), [memoryVersion]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      <CaptureControlBar
        capturing={capturing}
        observing={observing}
        voiceActive={voiceActive}
        pipOpen={pipState.open}
        pipPending={pipState.pending}
        pipSupported={pipState.supported}
        captureSupported={isCaptureSupported()}
        lastObservedAt={lastObservedAt}
        onToggleCapture={toggleCapture}
        onToggleObserver={toggleObserver}
        onToggleVoice={toggleVoice}
        onOpenPip={handleOpenPip}
      />

      {notice && (
        <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          <span className="material-symbols-outlined text-[16px]">info</span>
          <span className="flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-amber-600 hover:underline">
            關閉
          </button>
        </div>
      )}

      <nav className="flex gap-1 border-b border-slate-200 bg-white px-3">
        {TABS.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
              tab === item.id
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="px-3 pt-3">
        <GoogleAuthBanner onOpenSettings={() => setTab('settings')} />
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === 'memos' && (
          <div className="flex h-full min-h-0 flex-col md:flex-row">
            <div className="h-56 shrink-0 md:h-full md:w-72 lg:w-80">
              <MemoListPanel
                memos={filteredMemos}
                selectedId={selectedId}
                query={query}
                activeTag={activeTag}
                allTags={memoRepository.allTags()}
                onQueryChange={setQuery}
                onTagChange={setActiveTag}
                onSelect={setSelectedId}
                onCreate={handleCreateMemo}
                onDelete={handleDeleteMemo}
                onExport={handleExport}
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto bg-white">
              {selectedMemo ? (
                <>
                  <div className="flex items-center justify-end gap-2 border-b border-slate-200 px-4 py-2">
                    <button
                      type="button"
                      onClick={handleAttachLastScreenshot}
                      disabled={!lastScreenshotRef.current}
                      className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <span className="material-symbols-outlined text-[15px]">add_photo_alternate</span>
                      附加最近一次截圖
                    </button>
                  </div>
                  <MemoEditor memo={selectedMemo} onChange={handleMemoChange} />
                </>
              ) : (
                <p className="px-6 py-16 text-center text-sm text-slate-400">
                  從左側選一則 memo 開始編輯。
                </p>
              )}
            </div>
          </div>
        )}

        {tab === 'knowledge' && (
          <div className="h-full overflow-y-auto bg-white">
            <KnowledgeViewer
              longTerm={longTerm}
              shortTerm={shortTerm}
              onForgetLongTerm={id => {
                memoryRepository.deleteLongTerm(id);
                setMemoryVersion(version => version + 1);
              }}
              onClearShortTerm={() => {
                memoryRepository.clearShortTerm();
                setMemoryVersion(version => version + 1);
              }}
            />
          </div>
        )}

        {tab === 'settings' && (
          <div className="h-full overflow-y-auto bg-white">
            <AssistantSettingsPanel
              settings={assistantSettings}
              onChange={patch => setAssistantSettings(current => ({ ...current, ...patch }))}
            />
          </div>
        )}

        {tab === 'report' && (
          <div className="flex h-full min-h-0 flex-col bg-white">
            {report ? (
              <>
                <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2">
                  <span className="flex-1 truncate text-sm font-medium text-slate-800">{report.title}</span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(report.markdown)}
                    className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    <span className="material-symbols-outlined text-[15px]">content_copy</span>
                    複製
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadMarkdown(report.markdown, report.title)}
                    className="inline-flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1 text-xs text-white hover:bg-blue-700"
                  >
                    <span className="material-symbols-outlined text-[15px]">download</span>
                    下載 .md
                  </button>
                </div>
                <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap px-4 py-3 font-mono text-[13px] leading-relaxed text-slate-700">
                  {report.markdown}
                </pre>
              </>
            ) : (
              <p className="px-6 py-16 text-center text-sm text-slate-400">
                還沒有報告。在 Memo 分頁按「匯出 Markdown 工作摘要」，或直接請助理幫你產生。
              </p>
            )}
          </div>
        )}
      </div>

      <PipHost
        micActive={voiceActive}
        onToggleMic={toggleVoice}
        onReply={handlePipReply}
        modelUrl={assistantSettings.avatarModelUrl}
        cameraView={assistantSettings.avatarCameraView}
        liveTranscript={liveTranscript}
      />
    </div>
  );
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
