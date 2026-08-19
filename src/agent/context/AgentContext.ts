import { createContext } from 'react';
import type { Session } from '../types/session';
import type { AgentSettings } from '../repositories/settingsRepository';
import type { AgentActivity, AgentAppManifest, ToolDefinition } from '../types/agent';
import type { AgentTaskPlan } from '../types/task';
import type { MessageAttachment } from '../types/message';
import type { LiveInteractionStatus } from '../services/liveInteractionService';

export type ZoomState = 'small' | 'large' | 'panel' | 'drawer' | 'fullscreen';

/**
 * Per-AgentApp overrides for the shell-owned realtime voice session. The
 * voice machinery lives in the shell, so an AgentApp that needs its own
 * persona or voice declares it here instead of opening a second live
 * connection. Applied on the next startRealtimeVoice() call.
 */
export interface LiveOverrides {
  voiceName?: string;
  /** Appended after the shell's own voice style rules. */
  systemPromptSuffix?: string;
  mediaResolution?: string;
}

export interface AgentUiState {
  isOpened: boolean;
  zoomState: ZoomState;
  isSettingsPanelOpen: boolean;
  isSessionsListOpen: boolean;
  isLoading: boolean;
}

export interface AgentContextType {
  // Settings
  settings: AgentSettings;
  updateSettings: (newSettings: Partial<AgentSettings>) => void;
  resetAllSettings: () => void;
  
  // UI State
  uiState: AgentUiState;
  setUiState: (newUiState: Partial<AgentUiState>) => void;
  toggleOpen: () => void;
  
  // Sessions
  sessions: Session[];
  currentSession: Session | null;
  createNewSession: (appId?: string) => string;
  switchSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  renameSession: (sessionId: string, newTitle: string) => void;
  clearAllSessions: () => void;

  // Active App Context
  activeAppId: string;
  setActiveAppId: (appId: string) => void;
  activeAppManifest: AgentAppManifest | null;
  setActiveAppManifest: (manifest: AgentAppManifest | null) => void;
  activeTools: ToolDefinition[];
  setActiveTools: (tools: ToolDefinition[]) => void;
  activeSystemPrompt: string;
  setActiveSystemPrompt: (prompt: string) => void;
  runtimeContext: string;
  setRuntimeContext: (context: string) => void;
  activateAgentApp: (manifest: AgentAppManifest, runtimeContext?: string) => void;

  // Chat Actions
  sendMessageText: (text: string, attachments?: MessageAttachment[]) => Promise<void>;
  agentActivity: AgentActivity;
  taskPlan: AgentTaskPlan | null;
  liveStatus: LiveInteractionStatus;
  liveTranscript: string;
  liveError: string | null;
  startRealtimeVoice: () => Promise<void>;
  stopRealtimeVoice: () => void;
  /**
   * Pushes a screen/camera frame (base64 JPEG or data URL) into the running
   * live session. Returns false when there is no session or the 1 fps limit
   * would be exceeded.
   */
  sendLiveVideoFrame: (base64Jpeg: string) => boolean;
  /**
   * Sends realtime text input to the active Live session (e.g. system instructions
   * or observer prompts). Returns whether text was sent.
   */
  sendLiveText: (text: string) => boolean;
  /** Pass null to clear. Takes effect on the next voice session. */
  setLiveOverrides: (overrides: LiveOverrides | null) => void;
  registerToolHandlers: (handlers: Record<string, (args: any) => Promise<any> | any>) => void;
  toolHandlers: Record<string, (args: any) => Promise<any> | any>;
}

export const AgentContext = createContext<AgentContextType | undefined>(undefined);
