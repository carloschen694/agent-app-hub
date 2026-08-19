import React, { useState } from 'react';
import type { Message } from '../types/message';
import { AgentFollowupButtons } from './AgentFollowupButtons';
import { marked } from 'marked';
import { formatFileSize } from '../services/fileService';

interface AgentMessageBubbleProps {
  message: Message;
  onFollowupClick: (actionText: string) => void;
}

export const AgentMessageBubble: React.FC<AgentMessageBubbleProps> = ({ message, onFollowupClick }) => {
  const [isErrorDetailsOpen, setIsErrorDetailsOpen] = useState(false);
  const isUser = message.sender === 'user';
  const isSystem = message.sender === 'system';

  // Render marked HTML securely
  const renderMarkdown = (content: string) => {
    try {
      const rawHtml = marked.parse(content) as string;
      return { __html: rawHtml };
    } catch (e) {
      return { __html: content };
    }
  };

  return (
    <div className={`flex flex-col mb-4 ${isUser ? 'items-end' : 'items-start'}`}>
      <div className="flex items-end gap-1.5 max-w-[85%]">
        {/* Agent Avatar */}
        {!isUser && !isSystem && (
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 shadow-sm flex-shrink-0 mb-1">
            <span className="material-symbols-outlined text-sm font-bold">smart_toy</span>
          </div>
        )}

        <div className="flex flex-col">
          {/* Message Content Bubble */}
          <div
            className={`rounded-lg px-3.5 py-2.5 shadow-sm text-sm leading-relaxed ${
              isSystem
                ? 'bg-amber-50 border border-amber-100 text-amber-800'
                : isUser
                ? 'bg-blue-600 text-white rounded-br-none'
                : 'bg-white border border-slate-200 text-slate-900 rounded-bl-none'
            }`}
          >
            {/* 1. Error Card Rendering */}
            {message.error ? (
              <div className="text-red-800 text-xs">
                <div className="flex items-center gap-1 font-bold mb-1">
                  <span className="material-symbols-outlined text-red-500 text-base">warning</span>
                  <span>{message.error.friendlyTitle}</span>
                </div>
                <p className="text-slate-600 mb-2 leading-normal">{message.error.friendlyDesc}</p>
                <button
                  type="button"
                  onClick={() => setIsErrorDetailsOpen(!isErrorDetailsOpen)}
                  className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold underline flex items-center gap-0.5 focus:outline-none cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xs">info</span>
                  {isErrorDetailsOpen ? '隱藏詳細錯誤資訊' : '顯示詳細錯誤資訊'}
                </button>
                {isErrorDetailsOpen && (
                  <pre className="mt-2 p-2 bg-red-50 border border-red-100 rounded overflow-x-auto text-[10px] text-slate-700 max-h-40 whitespace-pre-wrap select-text">
                    <code>{message.error.rawMessage}</code>
                  </pre>
                )}
              </div>
            ) : (
              /* 2. Text / Markdown Rendering */
              <div
                className={`prose prose-slate max-w-none text-xs leading-normal ${
                  isUser ? 'prose-invert text-white' : 'text-slate-800'
                }`}
                dangerouslySetInnerHTML={renderMarkdown(message.content)}
              />
            )}

            {message.attachments && message.attachments.length > 0 && (
              <div className="mt-2 grid gap-1.5">
                {message.attachments.map(attachment => (
                  <div
                    key={attachment.id}
                    className={`overflow-hidden rounded border text-[10px] ${
                      isUser
                        ? 'border-blue-400 bg-blue-500/30 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    {attachment.mimeType.startsWith('image/') && attachment.dataUrl ? (
                      <img
                        src={attachment.dataUrl}
                        alt={attachment.name}
                        className="max-h-32 w-full object-cover"
                      />
                    ) : null}
                    <div className="flex items-center gap-1.5 px-2 py-1">
                      <span className="material-symbols-outlined text-xs">
                        {attachment.mimeType.startsWith('image/') ? 'image' : 'attach_file'}
                      </span>
                      <span className="truncate">{attachment.name}</span>
                      <span className={isUser ? 'text-blue-100' : 'text-slate-400'}>
                        {formatFileSize(attachment.size)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 3. Tool Execution Details */}
            {message.toolCallsInfo && message.toolCallsInfo.length > 0 && (
              <div className="mt-2.5 pt-2 border-t border-slate-100 text-[10px] text-slate-500">
                <div className="font-semibold mb-1 flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-xs">build</span>
                  <span>執行工具：</span>
                </div>
                <div className="space-y-1">
                  {message.toolCallsInfo.map((tc, index) => (
                    <div key={index} className="bg-slate-50 border border-slate-100 rounded p-1.5">
                      <div className="font-mono font-bold text-slate-700">{tc.name}</div>
                      {tc.displayNote && (
                        <div className="text-emerald-600 flex items-center gap-0.5 mt-0.5">
                          <span className="material-symbols-outlined text-xs">check_circle</span>
                          <span>{tc.displayNote}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Grounding Metadata */}
            {message.groundingMetadata && (
              <div className="mt-2.5 pt-2 border-t border-slate-100 text-[10px] text-slate-500">
                {message.groundingMetadata.webSearchQueries && message.groundingMetadata.webSearchQueries.length > 0 && (
                  <div className="mb-1 flex items-center gap-0.5 text-slate-400">
                    <span className="material-symbols-outlined text-xs">search</span>
                    <span>網頁搜尋：</span>
                    <span className="font-medium text-slate-600">
                      {message.groundingMetadata.webSearchQueries.join(', ')}
                    </span>
                  </div>
                )}
                
                {message.groundingMetadata.groundingChunks && message.groundingMetadata.groundingChunks.length > 0 && (
                  <div className="mt-1.5">
                    <div className="font-semibold text-slate-600 mb-1 flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-xs">explore</span>
                      <span>來源與參考資料：</span>
                    </div>
                    <ul className="space-y-1 pl-1">
                      {message.groundingMetadata.groundingChunks.map((chunk, i) => (
                        <li key={i} className="truncate">
                          <a
                            href={chunk.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline flex items-center gap-0.5 font-medium"
                          >
                            <span className="material-symbols-outlined text-[10px]">open_in_new</span>
                            <span>{chunk.title || chunk.uri}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. Followup Buttons */}
      {message.followups && message.followups.length > 0 && (
        <div className="mr-8">
          <AgentFollowupButtons buttons={message.followups} onButtonClick={onFollowupClick} />
        </div>
      )}
    </div>
  );
};
