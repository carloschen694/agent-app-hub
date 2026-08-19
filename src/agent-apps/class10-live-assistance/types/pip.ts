/**
 * Layout #1 — a toolbar, one single-column HTML viewer, and a DISMISS bar.
 * Layout #2 — a message plus an input box and option buttons, for when the
 * agent needs an answer from the user.
 */
export type PipLayout = 'content' | 'prompt';

export interface PipPromptOption {
  label: string;
  /** Sent back to the agent verbatim when the user picks this option. */
  value: string;
}

export interface PipContentPayload {
  layout: PipLayout;
  /** Optional title for the content frame or notification header. */
  title?: string;
  /** Agent-authored HTML5 (+ script), rendered in a sandboxed iframe. */
  html?: string;
  /** Layout #2 only. */
  message?: string;
  options?: PipPromptOption[];
  inputPlaceholder?: string;
  showInput?: boolean;
  updatedAt: number;
}

export interface PipNotification {
  id: string;
  title: string;
  summary: string;
  content: PipContentPayload;
  createdAt: number;
  read: boolean;
}

export interface PipState {
  supported: boolean;
  open: boolean;
  /** True when the agent asked to show something before the window existed. */
  pending: boolean;
  /** Unread indicator: new content arrived while something was still shown. */
  hasBadge: boolean;
  content: PipContentPayload | null;
  notifications: PipNotification[];
  activeNotificationId: string | null;
  width: number;
  height: number;
}

export interface PipUserReply {
  /** Which option was clicked, if any. */
  value?: string;
  /** Free text the user typed. */
  text?: string;
}
