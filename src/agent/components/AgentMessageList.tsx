import React, { useEffect, useRef } from 'react';
import type { Message } from '../types/message';
import type { AgentActivity } from '../types/agent';
import type { LiveInteractionStatus } from '../services/liveInteractionService';
import { AgentMessageBubble } from './AgentMessageBubble';
import { AgentActivityIndicator } from './AgentActivityIndicator';

interface AgentMessageListProps {
  messages: Message[];
  onFollowupClick: (actionText: string) => void;
  isLoading?: boolean;
  activity: AgentActivity;
  liveStatus: LiveInteractionStatus;
}

export const AgentMessageList: React.FC<AgentMessageListProps> = ({
  messages,
  onFollowupClick,
  isLoading,
  activity,
  liveStatus
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevMessagesLength = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const isNewMessage = messages.length > prevMessagesLength.current;
    prevMessagesLength.current = messages.length;

    if (isNewMessage) {
      const threshold = 120;
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;

      if (isNearBottom || messages.length === 1) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [messages]);

  useEffect(() => {
    if (isLoading && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [isLoading]);

  // Keep the activity block in view when the agent starts a new phase,
  // but only if the user is already near the bottom.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || activity.state === 'idle') return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 120;
    if (isNearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [activity]);

  return (
    <div
      ref={containerRef}
      className="flex-1 space-y-1 overflow-y-auto bg-gradient-to-b from-white to-slate-50/80 p-4 scroll-smooth"
    >
      {messages.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center px-6 text-center text-xs text-slate-400">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-900/10">
            <span className="material-symbols-outlined text-2xl">auto_awesome</span>
          </div>
          <p className="font-semibold text-slate-800">Start a conversation</p>
          <p className="mt-1 max-w-[240px] leading-relaxed">
            Ask about this app, attach context, or use tools and Google Search from the same chat.
          </p>
        </div>
      ) : (
        messages.map((msg) => (
          <AgentMessageBubble key={msg.id} message={msg} onFollowupClick={onFollowupClick} />
        ))
      )}

      {(messages.length > 0 || activity.state !== 'idle' || liveStatus !== 'idle') && (
        <AgentActivityIndicator activity={activity} liveStatus={liveStatus} />
      )}
    </div>
  );
};
