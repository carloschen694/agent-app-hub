import React from 'react';
import type { FollowupButton } from './message';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type?: string;
    properties?: Record<string, any>;
    required?: string[];
    [key: string]: any;
  } | Record<string, any>;
}

export type AgentActivityState = 'idle' | 'thinking' | 'tool' | 'task';

export interface AgentActivity {
  state: AgentActivityState;
  /** Human-readable description of what the agent is doing right now. */
  detail?: string;
  /** Timestamp (ms) when the current phase started, for elapsed-time display. */
  since: number;
}

export interface AgentAppManifest {
  agentAppId: string;
  agentAppName: string;
  description: string;
  route: string;
  systemPrompt: string;
  prepareSystemPrompt?: (basePrompt: string) => Promise<string> | string;
  availableTools: ToolDefinition[];
  enableGoogleSearch?: boolean;
  supportedUploads?: {
    files?: boolean;
    images?: boolean;
  };
  supportsRealtimeVoice?: boolean;
  supportsVisionStream?: boolean;
  supportsScreenStream?: boolean;
  /** Followup buttons to attach when the named tool succeeded in a reply. */
  toolFollowups?: Record<string, FollowupButton[]>;
  /** Success note shown in the chat bubble when the named tool was called. */
  toolDisplayNotes?: Record<string, string>;
  MainView: React.ComponentType<any>;
  CardWidget?: React.ComponentType<CardWidgetProps>;
  icon?: string;
  category?: string;
  appVersion?: string;
  courseId?: string;
  slideDeck?: string;
  slideNotes?: string;
  exampleQuestions?: string[];
  /** Opts out of the shell's centered max-width card layout for a full-viewport, no-padding shell (e.g. a live board that must fill the screen). */
  fullPage?: boolean;
  sortOrder?: number;
}

export interface CardWidgetProps {
  manifest: AgentAppManifest;
  onOpen: () => void;
}
