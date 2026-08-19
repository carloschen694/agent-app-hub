export interface WebSearchSource {
  title?: string;
  uri?: string;
}

export interface WebSearchGroundingMetadata {
  webSearchQueries?: string[];
  groundingChunks?: WebSearchSource[];
}

export interface ErrorDetails {
  friendlyTitle: string;
  friendlyDesc: string;
  type: 'busy' | 'api_key' | 'quota' | 'unknown';
  rawMessage: string;
}

export interface FollowupButton {
  label: string;
  action: string;
}

export interface MessageAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  dataUrl?: string;
  base64Data?: string;
}

export interface Message {
  id: string;
  sender: 'user' | 'agent' | 'system';
  content: string;
  timestamp: number;
  attachments?: MessageAttachment[];
  isLiveTranscript?: boolean;
  wasInterrupted?: boolean;
  error?: ErrorDetails;
  groundingMetadata?: WebSearchGroundingMetadata;
  followups?: FollowupButton[];
  isToolCall?: boolean;
  toolCallsInfo?: Array<{
    name: string;
    args: any;
    result?: any;
    /** App-declared success note (from manifest.toolDisplayNotes). */
    displayNote?: string;
  }>;
}
