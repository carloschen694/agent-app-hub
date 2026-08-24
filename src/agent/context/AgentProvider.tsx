import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AgentContext } from './AgentContext';
import type { AgentUiState, LiveOverrides } from './AgentContext';
import { settingsRepository } from '../repositories/settingsRepository';
import type { AgentSettings } from '../repositories/settingsRepository';
import { sessionRepository } from '../repositories/sessionRepository';
import type { Session } from '../types/session';
import type { Message, MessageAttachment } from '../types/message';
import type { AgentActivity, AgentActivityState, AgentAppManifest, ToolDefinition } from '../types/agent';
import { sendChatMessage, parseGeminiError } from '../services/geminiService';
import type { AgentTask, AgentTaskPlan } from '../types/task';
import {
  PLAN_LONG_TASKS_TOOL,
  LONG_TASK_PROTOCOL_PROMPT,
  MAX_PLANNED_TASKS,
  buildTaskExecutionPrompt,
  buildAggregationPrompt
} from '../services/longTaskService';
import {
  isLiveModel,
  startLiveInteraction,
  LIVE_VOICE_STYLE_PROMPT,
  POST_CHAT_MESSAGE_TOOL,
  type LiveInteractionSession,
  type LiveInteractionStatus
} from '../services/liveInteractionService';
import { getScopeBlock } from './systemPromptScope';

export const AgentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Settings State
  const [settings, setSettings] = useState<AgentSettings>(() => settingsRepository.getSettings());
  
  // UI State
  const [uiState, setUiStateInternal] = useState<AgentUiState>({
    isOpened: false,
    zoomState: 'small',
    isSettingsPanelOpen: false,
    isSessionsListOpen: false,
    isLoading: false
  });

  // Sessions State
  const [sessions, setSessions] = useState<Session[]>(() => sessionRepository.getSessions());
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => {
    const list = sessionRepository.getSessions();
    return list.length > 0 ? list[0].id : null;
  });

  // Active App Context
  const [activeAppId, setActiveAppId] = useState<string>('dashboard');
  const [activeAppManifest, setActiveAppManifest] = useState<AgentAppManifest | null>(null);
  const [activeTools, setActiveTools] = useState<ToolDefinition[]>([]);
  const [activeSystemPrompt, setActiveSystemPrompt] = useState<string>('');
  const [runtimeContext, setRuntimeContext] = useState<string>('');
  const [agentActivity, setAgentActivity] = useState<AgentActivity>({
    state: 'idle',
    since: Date.now()
  });
  const [taskPlan, setTaskPlan] = useState<AgentTaskPlan | null>(null);
  const [liveStatus, setLiveStatus] = useState<LiveInteractionStatus>('idle');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [liveError, setLiveError] = useState<string | null>(null);

  // Tool Handlers reference
  const toolHandlersRef = useRef<Record<string, (args: any) => Promise<any> | any>>({});
  const liveSessionRef = useRef<LiveInteractionSession | null>(null);
  const liveStartInFlightRef = useRef(false);
  const liveOverridesRef = useRef<LiveOverrides | null>(null);

  const setUiState = (newUiState: Partial<AgentUiState>) => {
    setUiStateInternal(prev => ({ ...prev, ...newUiState }));
  };

  const reportActivity = (state: AgentActivityState, detail?: string) => {
    setAgentActivity(prev =>
      prev.state === state && prev.detail === detail
        ? prev
        : { state, detail, since: Date.now() }
    );
  };

  const toggleOpen = () => {
    setUiState({ isOpened: !uiState.isOpened });
  };

  // Sync API Key from environment if settings doesn't have it
  useEffect(() => {
    const envApiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
    if (envApiKey && !settings.apiKey) {
      setSettings(prev => {
        const next = { ...prev, apiKey: envApiKey };
        settingsRepository.saveSettings(next);
        return next;
      });
    }
  }, [settings.apiKey]);

  const updateSettings = (newSettings: Partial<AgentSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...newSettings };
      settingsRepository.saveSettings(next);
      return next;
    });
  };

  const resetAllSettings = () => {
    settingsRepository.clearSettings();
    const defaults = settingsRepository.getSettings();
    setSettings(defaults);
  };

  const createNewSession = (appId?: string) => {
    const id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newSession: Session = {
      id,
      title: 'New chat',
      messages: [],
      activeAppId: appId || activeAppId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    sessionRepository.saveSession(newSession);
    setSessions(sessionRepository.getSessions());
    setCurrentSessionId(id);
    return id;
  };

  const switchSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    // Sync the active app context to the session's registered appId
    const session = sessionRepository.getSessionById(sessionId);
    if (session) {
      setActiveAppId(session.activeAppId);
    }
  };

  const deleteSession = (sessionId: string) => {
    sessionRepository.deleteSession(sessionId);
    const updated = sessionRepository.getSessions();
    setSessions(updated);
    if (currentSessionId === sessionId) {
      setCurrentSessionId(updated.length > 0 ? updated[0].id : null);
    }
  };

  const renameSession = (sessionId: string, newTitle: string) => {
    const session = sessionRepository.getSessionById(sessionId);
    if (session) {
      const updated = { ...session, title: newTitle };
      sessionRepository.saveSession(updated);
      setSessions(sessionRepository.getSessions());
    }
  };

  const clearAllSessions = () => {
    sessionRepository.clearAll();
    setSessions([]);
    setCurrentSessionId(null);
  };

  const registerToolHandlers = (handlers: Record<string, (args: any) => Promise<any> | any>) => {
    toolHandlersRef.current = handlers;
  };

  const getCurrentSession = (): Session | null => {
    if (!currentSessionId) return null;
    return sessions.find(s => s.id === currentSessionId) || null;
  };

  const buildFullSystemPrompt = () => {
    const scopeBlock = getScopeBlock(activeAppId, activeAppManifest?.agentAppName);

    return `
${settings.systemPrompt}

---
CURRENT CONTEXT APP: ${activeAppId}
${activeSystemPrompt}

---
AI TEACHER PROTOCOL:
- You are a friendly, encouraging AI Teacher helping a beginner learn Gemini API development.
${scopeBlock}
- Tone: Keep your language simple, clear, and beginner-friendly. Avoid unexplained complex jargon.

---
RUNTIME CONTEXT:
${runtimeContext}
${LONG_TASK_PROTOCOL_PROMPT}
`;
  };

  const buildPreparedFullSystemPrompt = async () => {
    const basePrompt = buildFullSystemPrompt();
    if (!activeAppManifest?.prepareSystemPrompt) return basePrompt;
    return await activeAppManifest.prepareSystemPrompt(basePrompt);
  };

  const activateAgentApp = (manifest: AgentAppManifest, nextRuntimeContext = '') => {
    setActiveAppId(manifest.agentAppId);
    setActiveAppManifest(manifest);
    setActiveTools(manifest.availableTools);
    setActiveSystemPrompt(manifest.systemPrompt);
    setRuntimeContext(nextRuntimeContext);
  };

  const updatePlanTask = (index: number, patch: Partial<AgentTask>) => {
    setTaskPlan(prev =>
      prev
        ? {
            ...prev,
            tasks: prev.tasks.map((task, i) => (i === index ? { ...task, ...patch } : task))
          }
        : prev
    );
  };

  /**
   * Executes a long-task plan: runs each sub-task as its own bounded API
   * call, then aggregates all results into one final chat message. Used by
   * both the text-chat path (awaited) and the live-voice path (background).
   * Never throws — failures are reported into the chat and the plan status.
   */
  const executeTaskPlan = async (
    objective: string,
    plannedTasks: Array<{ title: string; description?: string }>,
    appendMessage: (message: Message) => void
  ) => {
    const planCreatedAt = Date.now();
    const tasks: AgentTask[] = plannedTasks.map((task, index) => ({
      id: `task_${planCreatedAt}_${index}`,
      title: task.title,
      description: task.description,
      status: 'pending'
    }));
    setTaskPlan({ objective, tasks, status: 'running', createdAt: planCreatedAt });

    const taskResults: Array<{ title: string; result: string; failed?: boolean }> = [];
    for (let i = 0; i < tasks.length; i += 1) {
      updatePlanTask(i, { status: 'running' });
      reportActivity('task', `正在執行任務 ${i + 1}/${tasks.length}：${tasks[i].title}`);
      try {
        const taskResult = await sendChatMessage({
          apiKey: settings.apiKey,
          modelName: settings.model,
          systemPrompt: buildFullSystemPrompt(),
          // Each sub-task call carries its own bounded context instead of
          // the whole chat history, so one call stays within token limits.
          history: [],
          messageText: buildTaskExecutionPrompt(
            objective,
            tasks[i],
            i,
            tasks.length,
            taskResults.filter(item => !item.failed)
          ),
          tools: [...activeTools],
          toolHandlers: {
            ...toolHandlersRef.current
          },
          onActivity: (_state, detail) =>
            reportActivity('task', `任務 ${i + 1}/${tasks.length}：${detail}`),
          enableGoogleSearch: activeAppManifest?.enableGoogleSearch
        });
        taskResults.push({ title: tasks[i].title, result: taskResult.content });
        updatePlanTask(i, {
          status: 'done',
          resultSummary: taskResult.content.slice(0, 80)
        });
      } catch (taskError: any) {
        console.error(`Long task step ${i + 1} failed`, taskError);
        const reason = taskError instanceof Error ? taskError.message : String(taskError);
        taskResults.push({
          title: tasks[i].title,
          result: `（此子任務執行失敗：${reason}）`,
          failed: true
        });
        updatePlanTask(i, { status: 'failed', resultSummary: reason.slice(0, 80) });
      }
    }

    try {
      setTaskPlan(prev => (prev ? { ...prev, status: 'aggregating' } : prev));
      reportActivity('task', '所有子任務完成，正在彙整最終結果…');
      const finalResult = await sendChatMessage({
        apiKey: settings.apiKey,
        modelName: settings.model,
        systemPrompt: buildFullSystemPrompt(),
        history: [],
        messageText: buildAggregationPrompt(objective, taskResults),
        tools: [],
        toolHandlers: {},
        onActivity: reportActivity,
        enableGoogleSearch: activeAppManifest?.enableGoogleSearch
      });

      appendMessage({
        id: `msg_${Date.now()}_a_final`,
        sender: 'agent',
        content: finalResult.content,
        timestamp: Date.now(),
        groundingMetadata: finalResult.groundingMetadata
      });

      const hasFailure = taskResults.some(item => item.failed);
      setTaskPlan(prev =>
        prev ? { ...prev, status: hasFailure ? 'failed' : 'completed' } : prev
      );
    } catch (error: any) {
      console.error('Long task aggregation failed', error);
      appendMessage({
        id: `msg_${Date.now()}_err`,
        sender: 'agent',
        content: '',
        timestamp: Date.now(),
        error: parseGeminiError(error)
      });
      setTaskPlan(prev => (prev ? { ...prev, status: 'failed' } : prev));
    } finally {
      reportActivity('idle');
    }
  };

  const appendMessageToCurrentSession = (message: Message) => {
    let targetSessionId = currentSessionId;
    if (!targetSessionId) {
      targetSessionId = createNewSession();
    }

    const session = sessionRepository.getSessionById(targetSessionId!);
    if (!session) return;

    const finalSession: Session = {
      ...session,
      messages: [...session.messages, message],
      activeAppId,
      updatedAt: Date.now()
    };
    sessionRepository.saveSession(finalSession);
    setSessions(sessionRepository.getSessions());
  };

  const sendMessageText = async (text: string, attachments: MessageAttachment[] = []) => {
    if (!text.trim() && attachments.length === 0) return;

    let targetSessionId = currentSessionId;
    if (!targetSessionId) {
      targetSessionId = createNewSession();
    }

    const session = sessionRepository.getSessionById(targetSessionId!);
    if (!session) return;

    // 1. Create User Message
    const userMsg: Message = {
      id: `msg_${Date.now()}_u`,
      sender: 'user',
      content: text,
      attachments,
      timestamp: Date.now()
    };

    const updatedMessages = [...session.messages, userMsg];
    
    // Auto-rename session if it was a new empty chat.
    let sessionTitle = session.title;
    if (sessionTitle === 'New chat') {
      const titleSeed = text.trim() || attachments[0]?.name || 'Attachment chat';
      sessionTitle = titleSeed.length > 15 ? titleSeed.substring(0, 15) + '...' : titleSeed;
    }

    const updatedSession: Session = {
      ...session,
      title: sessionTitle,
      messages: updatedMessages,
      activeAppId, // update active app ID context
      updatedAt: Date.now()
    };

    sessionRepository.saveSession(updatedSession);
    setSessions(sessionRepository.getSessions());

    // Set loading state
    setUiState({ isLoading: true });
    // A new user turn starts a fresh interaction; drop the previous plan display.
    setTaskPlan(null);
    reportActivity('thinking', '正在思考與推理回應內容…');

    let workingSession = updatedSession;
    const appendAgentMessage = (message: Message) => {
      workingSession = {
        ...workingSession,
        messages: [...workingSession.messages, message],
        updatedAt: Date.now()
      };
      sessionRepository.saveSession(workingSession);
      setSessions(sessionRepository.getSessions());
    };

    try {
      // 3. Send message to Gemini API. The model may call planLongTasks when
      // the request is too large for a single response.
      let capturedTasks: Array<{ title: string; description?: string }> | null = null;
      const preparedSystemPrompt = await buildPreparedFullSystemPrompt();

      const result = await sendChatMessage({
        apiKey: settings.apiKey,
        modelName: settings.model,
        systemPrompt: preparedSystemPrompt,
        history: session.messages,
        messageText: text,
        attachments,
        tools: [...activeTools, PLAN_LONG_TASKS_TOOL],
        toolHandlers: {
          ...toolHandlersRef.current,
          [PLAN_LONG_TASKS_TOOL.name]: (args: any) => {
            const tasks = Array.isArray(args?.tasks)
              ? args.tasks
                  .filter((task: any) => typeof task?.title === 'string' && task.title.trim())
                  .slice(0, MAX_PLANNED_TASKS)
              : [];
            if (tasks.length === 0) {
              return { accepted: false, reason: 'tasks 必須是至少含一個 title 的陣列。' };
            }
            capturedTasks = tasks;
            return {
              accepted: true,
              taskCount: tasks.length,
              note: '子任務已登錄，系統會依序執行並在最後要求你彙整。請簡短告知使用者拆分計畫即可。'
            };
          }
        },
        onActivity: reportActivity,
        enableGoogleSearch: activeAppManifest?.enableGoogleSearch
      });

      if (capturedTasks) {
        // ---- Long-task path: execute sub-tasks sequentially, then aggregate.
        const plannedTasks = capturedTasks as Array<{ title: string; description?: string }>;

        appendAgentMessage({
          id: `msg_${Date.now()}_a_plan`,
          sender: 'agent',
          content: result.content || `這個任務較大，我已拆分為 ${plannedTasks.length} 個子任務，開始逐一執行。`,
          timestamp: Date.now(),
          toolCallsInfo: result.toolCallsInfo
        });

        await executeTaskPlan(text, plannedTasks, appendAgentMessage);
      } else {
        // ---- Normal single-response path.
        const agentMsg: Message = {
          id: `msg_${Date.now()}_a`,
          sender: 'agent',
          content: result.content,
          timestamp: Date.now(),
          groundingMetadata: result.groundingMetadata,
          // Enrich tool calls with app-declared display notes from the manifest.
          toolCallsInfo: result.toolCallsInfo?.map(tc => ({
            ...tc,
            displayNote: activeAppManifest?.toolDisplayNotes?.[tc.name]
          }))
        };

        // Followups are declared per-tool by the AgentApp manifest.
        const followups =
          result.toolCallsInfo?.flatMap(
            tc => activeAppManifest?.toolFollowups?.[tc.name] ?? []
          ) ?? [];
        if (followups.length > 0) {
          agentMsg.followups = followups;
        }

        appendAgentMessage(agentMsg);
      }

    } catch (error: any) {
      console.error('Error sending message to Gemini', error);
      
      const parsedError = parseGeminiError(error);
      appendAgentMessage({
        id: `msg_${Date.now()}_err`,
        sender: 'agent',
        content: '',
        timestamp: Date.now(),
        error: parsedError
      });
      setTaskPlan(prev =>
        prev && prev.status !== 'completed' ? { ...prev, status: 'failed' } : prev
      );
    } finally {
      setUiState({ isLoading: false });
      reportActivity('idle');
    }
  };

  const startRealtimeVoice = async () => {
    if (!settings.liveApiKey || !activeAppManifest?.supportsRealtimeVoice || !isLiveModel(settings.liveModel)) {
      setLiveStatus('error');
      setLiveError('目前無法使用即時語音，請確認已填寫 Live API Key、選擇的模型與目前 App 都支援即時語音。');
      return;
    }

    if (liveSessionRef.current || liveStartInFlightRef.current) return;
    liveStartInFlightRef.current = true;

    try {
      setLiveError(null);
      setLiveStatus('connecting');
      const overrides = liveOverridesRef.current;
      const session = await startLiveInteraction({
        apiKey: settings.liveApiKey,
        // Live ephemeral tokens (generated on the API Key Manager page) are
        // `auth_tokens/...` strings and require v1alpha; a real Gemini API
        // key uses the default API version.
        apiVersion: settings.liveApiKey.startsWith('auth_tokens/') ? 'v1alpha' : undefined,
        model: settings.liveModel,
        voiceName: overrides?.voiceName || settings.liveVoice,
        mediaResolution: overrides?.mediaResolution,
        systemPrompt:
          buildFullSystemPrompt() +
          LIVE_VOICE_STYLE_PROMPT +
          (overrides?.systemPromptSuffix ? `\n${overrides.systemPromptSuffix}` : ''),
        tools: [...activeTools, POST_CHAT_MESSAGE_TOOL, PLAN_LONG_TASKS_TOOL],
        toolHandlers: {
          ...toolHandlersRef.current,
          [PLAN_LONG_TASKS_TOOL.name]: (args: any) => {
            const tasks = Array.isArray(args?.tasks)
              ? args.tasks
                  .filter((task: any) => typeof task?.title === 'string' && task.title.trim())
                  .slice(0, MAX_PLANNED_TASKS)
              : [];
            if (tasks.length === 0) {
              return { accepted: false, reason: 'tasks 必須是至少含一個 title 的陣列。' };
            }
            const objective =
              typeof args?.objective === 'string' && args.objective.trim()
                ? args.objective.trim()
                : `語音對談中提出的長任務（共 ${tasks.length} 個子任務）`;
            appendMessageToCurrentSession({
              id: `msg_${Date.now()}_live_plan`,
              sender: 'agent',
              content: `🎙️ 已將語音請求拆分為 ${tasks.length} 個子任務並在背景執行：${objective}\n\n進度請見下方任務清單，完成後結果會發佈在此。`,
              timestamp: Date.now()
            });
            // Run in the background; the voice conversation stays responsive
            // and the task panel in the chat view tracks progress.
            void executeTaskPlan(objective, tasks, appendMessageToCurrentSession);
            return {
              accepted: true,
              taskCount: tasks.length,
              note: '子任務已在背景開始執行，進度顯示於聊天視窗的任務清單，完成後結果會發佈到聊天視窗。請用一兩句話口頭告知使用者即可，不要嘗試自己執行內容。'
            };
          },
          [POST_CHAT_MESSAGE_TOOL.name]: (args: any) => {
            const content = typeof args?.content === 'string' ? args.content.trim() : '';
            if (!content) {
              return { posted: false, reason: 'content 不可為空。' };
            }
            appendMessageToCurrentSession({
              id: `msg_${Date.now()}_live_report`,
              sender: 'agent',
              content:
                typeof args?.title === 'string' && args.title.trim()
                  ? `**${args.title.trim()}**\n\n${content}`
                  : content,
              timestamp: Date.now()
            });
            return {
              posted: true,
              note: '內容已發佈到聊天視窗。請用一兩句話口頭總結重點，並告訴使用者到聊天視窗查看。'
            };
          }
        },
        callbacks: {
          onStatusChange: (status) => {
            setLiveStatus(status);
            if (status === 'idle' || status === 'error') {
              liveSessionRef.current = null;
            }
          },
          onInputTranscript: (text) => {
            setLiveTranscript(text);
            appendMessageToCurrentSession({
              id: `msg_${Date.now()}_live_u`,
              sender: 'user',
              content: text,
              timestamp: Date.now(),
              isLiveTranscript: true
            });
          },
          onOutputTranscript: (text) => {
            setLiveTranscript(text);
          },
          onInterrupted: () => {
            appendMessageToCurrentSession({
              id: `msg_${Date.now()}_live_i`,
              sender: 'system',
              content: 'Agent 上一段語音回覆被使用者打斷，使用者可能沒有聽完全部內容。',
              timestamp: Date.now(),
              wasInterrupted: true
            });
          },
          onError: (error) => {
            console.error('Live interaction error', error);
            liveSessionRef.current = null;
            setLiveError(error instanceof Error ? error.message : String(error));
          }
        },
        enableGoogleSearch: activeAppManifest?.enableGoogleSearch
      });
      liveSessionRef.current = session;
      session.sendText('請用繁體中文、一句話告知使用者即時語音已開始，然後安靜等待使用者發問。不要自我介紹或寒暄。');
    } catch (error) {
      console.error('Failed to start realtime voice', error);
      liveSessionRef.current = null;
      setLiveStatus('error');
      setLiveError(error instanceof Error ? error.message : String(error));
    } finally {
      liveStartInFlightRef.current = false;
    }
  };

  const stopRealtimeVoice = useCallback(() => {
    liveSessionRef.current?.stop();
    liveSessionRef.current = null;
    setLiveStatus('idle');
    setLiveTranscript('');
    setLiveError(null);
  }, []);

  const sendLiveVideoFrame = (base64Jpeg: string): boolean =>
    liveSessionRef.current?.sendVideoFrame(base64Jpeg) ?? false;

  const sendLiveText = (text: string): boolean => {
    if (liveSessionRef.current) {
      liveSessionRef.current.sendText(text);
      return true;
    }
    return false;
  };

  const setLiveOverrides = useCallback((overrides: LiveOverrides | null) => {
    liveOverridesRef.current = overrides;
  }, []);

  return (
    <AgentContext.Provider
      value={{
        settings,
        updateSettings,
        resetAllSettings,
        uiState,
        setUiState,
        toggleOpen,
        sessions,
        currentSession: getCurrentSession(),
        createNewSession,
        switchSession,
        deleteSession,
        renameSession,
        clearAllSessions,
        activeAppId,
        setActiveAppId,
        activeAppManifest,
        setActiveAppManifest,
        activeTools,
        setActiveTools,
        activeSystemPrompt,
        setActiveSystemPrompt,
        runtimeContext,
        setRuntimeContext,
        sendMessageText,
        agentActivity,
        taskPlan,
        liveStatus,
        liveTranscript,
        liveError,
        startRealtimeVoice,
        stopRealtimeVoice,
        sendLiveVideoFrame,
        sendLiveText,
        setLiveOverrides,
        activateAgentApp,
        registerToolHandlers,
        toolHandlers: toolHandlersRef.current
      }}
    >
      {children}
    </AgentContext.Provider>
  );
};
