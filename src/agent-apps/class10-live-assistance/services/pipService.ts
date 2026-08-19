import type { PipContentPayload, PipNotification, PipState, PipUserReply } from '../types/pip';

/**
 * Document Picture-in-Picture overlay.
 *
 * The window itself can only be opened from a user gesture — the agent
 * cannot conjure it. So showContent() before the window exists marks the
 * request "pending" and the main view nudges the user to open the overlay;
 * from then on the agent fully controls size, content, and visibility.
 * hide() collapses the content rather than closing the window, because
 * closing would cost another user gesture to recover.
 *
 * Only one PiP window may exist per tab.
 */

const DEFAULT_WIDTH = 380;
const DEFAULT_HEIGHT = 460;

type StateListener = (state: PipState) => void;
type ReplyListener = (reply: PipUserReply) => void;

let pipWindow: Window | null = null;
let mountNode: HTMLElement | null = null;
/** Content held back behind a badge until the user dismisses what is shown. */
let queuedContent: PipContentPayload | null = null;

let state: PipState = {
  supported: typeof window !== 'undefined' && 'documentPictureInPicture' in window,
  open: false,
  pending: false,
  hasBadge: false,
  content: null,
  notifications: [],
  activeNotificationId: null,
  width: DEFAULT_WIDTH,
  height: DEFAULT_HEIGHT
};

const stateListeners = new Set<StateListener>();
const replyListeners = new Set<ReplyListener>();

const setState = (patch: Partial<PipState>) => {
  state = { ...state, ...patch };
  stateListeners.forEach(listener => listener(state));
};

export const getPipState = (): PipState => state;

export function subscribePip(listener: StateListener): () => void {
  stateListeners.add(listener);
  listener(state);
  return () => stateListeners.delete(listener);
}

/** Fires when the user answers a Layout #2 prompt. */
export function subscribePipReply(listener: ReplyListener): () => void {
  replyListeners.add(listener);
  return () => replyListeners.delete(listener);
}

export function emitPipReply(reply: PipUserReply): void {
  replyListeners.forEach(listener => listener(reply));
}

export const getPipMountNode = (): HTMLElement | null => mountNode;

function copyStyles(target: Window): void {
  for (const styleSheet of Array.from(document.styleSheets)) {
    try {
      const cssText = Array.from(styleSheet.cssRules)
        .map(rule => rule.cssText)
        .join('\n');
      const style = target.document.createElement('style');
      style.textContent = cssText;
      target.document.head.appendChild(style);
    } catch {
      // Cross-origin sheets cannot be read; link them instead.
      const link = target.document.createElement('link');
      link.rel = 'stylesheet';
      if (styleSheet.href) {
        link.href = styleSheet.href;
        target.document.head.appendChild(link);
      }
    }
  }
}

/** Must be called from a user gesture (click), per the Document PiP spec. */
export async function openPipWindow(): Promise<boolean> {
  if (!state.supported) return false;
  if (pipWindow && !pipWindow.closed) {
    pipWindow.focus();
    return true;
  }

  pipWindow = await (window as any).documentPictureInPicture.requestWindow({
    width: state.width,
    height: state.height
  });
  if (!pipWindow) return false;

  copyStyles(pipWindow);
  pipWindow.document.body.style.margin = '0';
  const node = pipWindow.document.createElement('div');
  node.id = 'class10-pip-root';
  pipWindow.document.body.appendChild(node);
  mountNode = node;

  pipWindow.addEventListener('pagehide', () => {
    pipWindow = null;
    mountNode = null;
    setState({ open: false, hasBadge: false });
  });

  // A request that arrived before the window existed gets shown now.
  setState({ open: true, pending: false });
  return true;
}

export function closePipWindow(): void {
  pipWindow?.close();
  pipWindow = null;
  mountNode = null;
  setState({ open: false, hasBadge: false });
}

export function resizePipWindow(width: number, height: number): void {
  const nextWidth = Math.max(240, Math.min(Math.round(width), 800));
  const nextHeight = Math.max(200, Math.min(Math.round(height), 900));
  setState({ width: nextWidth, height: nextHeight });
  try {
    pipWindow?.resizeTo(nextWidth, nextHeight);
  } catch {
    // Some browsers refuse programmatic resize; the state still records intent.
  }
}

function extractTitleAndSummary(payload: PipContentPayload): { title: string; summary: string } {
  if (payload.layout === 'prompt') {
    const title = payload.title || '助理提問';
    const summary = payload.message || '請回答助理的問題';
    return { title, summary };
  }

  let text = '';
  if (payload.html) {
    text = payload.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  let title = payload.title || '助理通知';
  if (!payload.title) {
    if (text.includes('主動提示')) {
      title = '主動提示';
    } else if (text.includes('翻譯')) {
      title = '翻譯結果';
    } else if (text.includes('搜尋')) {
      title = '搜尋結果';
    }
  }

  const summary = text.slice(0, 60) || '無內文摘要';
  return { title, summary };
}

/**
 * Shows content in the overlay.
 *
 * `replace: false` is the low-interruption path from the spec: when
 * something is already on screen, the existing content is left alone and a
 * red badge appears instead, so the agent never yanks away what the user is
 * still reading.
 */
export function showPipContent(
  content: Omit<PipContentPayload, 'updatedAt'>,
  options: { replace?: boolean } = {}
): { shown: boolean; badged: boolean; pending: boolean } {
  const replace = options.replace ?? true;
  const payload: PipContentPayload = { ...content, updatedAt: Date.now() };

  const { title, summary } = extractTitleAndSummary(payload);
  const notifId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  
  const newNotif: PipNotification = {
    id: notifId,
    title,
    summary,
    content: payload,
    createdAt: payload.updatedAt,
    read: false
  };

  if (!state.open) {
    queuedContent = payload;
    const notifications = [newNotif, ...state.notifications];
    setState({
      pending: true,
      content: payload,
      notifications,
      activeNotificationId: notifId,
      hasBadge: true
    });
    return { shown: false, badged: false, pending: true };
  }

  if (!replace && state.content) {
    queuedContent = payload;
    const notifications = [newNotif, ...state.notifications];
    setState({
      notifications,
      hasBadge: true
    });
    return { shown: false, badged: true, pending: false };
  }

  queuedContent = null;
  newNotif.read = true;
  const notifications = [newNotif, ...state.notifications];
  const hasUnread = notifications.some(n => !n.read);

  setState({
    content: payload,
    activeNotificationId: notifId,
    notifications,
    hasBadge: hasUnread
  });
  return { shown: true, badged: false, pending: false };
}

export const getQueuedContent = (): PipContentPayload | null => queuedContent;

export function setActiveNotification(id: string): void {
  const target = state.notifications.find(n => n.id === id);
  if (!target) return;

  const notifications = state.notifications.map(n =>
    n.id === id ? { ...n, read: true } : n
  );
  const hasUnread = notifications.some(n => !n.read);

  setState({
    content: target.content,
    activeNotificationId: id,
    notifications,
    hasBadge: hasUnread
  });
}

export function removeNotification(id: string): void {
  const notifications = state.notifications.filter(n => n.id !== id);
  let nextContent = state.content;
  let nextActiveId = state.activeNotificationId;

  if (state.activeNotificationId === id) {
    if (notifications.length > 0) {
      const next = notifications[0];
      next.read = true;
      nextContent = next.content;
      nextActiveId = next.id;
    } else {
      nextContent = null;
      nextActiveId = null;
      queuedContent = null;
    }
  }

  const hasUnread = notifications.some(n => !n.read);

  setState({
    content: nextContent,
    activeNotificationId: nextActiveId,
    notifications,
    hasBadge: hasUnread
  });
}

export function clearAllNotifications(): void {
  queuedContent = null;
  setState({
    content: null,
    activeNotificationId: null,
    notifications: [],
    hasBadge: false
  });
}

/**
 * The user pressed DISMISS. If something was queued behind the badge it
 * takes over now; otherwise the overlay goes blank but stays open.
 */
export function dismissPipContent(): void {
  if (state.activeNotificationId) {
    removeNotification(state.activeNotificationId);
    return;
  }
  if (queuedContent) {
    const next = queuedContent;
    queuedContent = null;
    setState({ content: next, hasBadge: false });
    return;
  }
  setState({ content: null, hasBadge: false });
}

export function clearPipBadge(): void {
  setState({ hasBadge: false });
}

export function hidePipContent(): void {
  clearAllNotifications();
}

/** Test seam: drops all module state between test cases. */
export function __resetPipForTests(): void {
  pipWindow = null;
  mountNode = null;
  queuedContent = null;
  stateListeners.clear();
  replyListeners.clear();
  state = {
    supported: typeof window !== 'undefined' && 'documentPictureInPicture' in window,
    open: false,
    pending: false,
    hasBadge: false,
    content: null,
    notifications: [],
    activeNotificationId: null,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT
  };
}
