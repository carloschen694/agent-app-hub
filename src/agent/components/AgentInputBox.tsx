import React, { useEffect, useRef, useState } from 'react';
import type { MessageAttachment } from '../types/message';
import { filesToAttachments, formatFileSize, isImageAttachment } from '../services/fileService';

interface AgentInputBoxProps {
  onSend: (text: string, attachments?: MessageAttachment[]) => void | Promise<void>;
  disabled?: boolean;
  supportedUploads?: {
    files?: boolean;
    images?: boolean;
  };
}

export const AgentInputBox: React.FC<AgentInputBoxProps> = ({
  onSend,
  disabled,
  supportedUploads
}) => {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [isSpeechActive, setIsSpeechActive] = useState(false);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const isComposingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const speechRunIdRef = useRef(0);
  const speechBaseTextRef = useRef('');

  const canUploadFiles = supportedUploads?.files ?? true;
  const canUploadImages = supportedUploads?.images ?? true;
  const canSend = (text.trim().length > 0 || attachments.length > 0) && !disabled;

  const stopSpeechInput = () => {
    speechRunIdRef.current += 1;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsSpeechActive(false);
  };

  const handleSend = async () => {
    if (!canSend) return;

    const messageText = text.trim();
    const messageAttachments = attachments;
    stopSpeechInput();
    setIsAttachMenuOpen(false);
    setText('');
    setAttachments([]);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    await onSend(messageText, messageAttachments);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (e.keyCode === 229 || isComposingRef.current) return;
      e.preventDefault();
      void handleSend();
    }
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || disabled) return;
    const selectedFiles = Array.from(files).filter(file => {
      if (isImageAttachment(file)) return canUploadImages;
      return canUploadFiles;
    });
    const nextAttachments = await filesToAttachments(selectedFiles);
    setAttachments(prev => [...prev, ...nextAttachments]);
    setIsAttachMenuOpen(false);
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(item => item.id !== id));
  };

  const toggleSpeechInput = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setText(prev => `${prev}${prev ? '\n' : ''}Speech input is not supported by this browser.`);
      return;
    }

    if (isSpeechActive) {
      stopSpeechInput();
      return;
    }

    const runId = speechRunIdRef.current + 1;
    speechRunIdRef.current = runId;
    speechBaseTextRef.current = text.trimEnd();

    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || 'zh-TW';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event: any) => {
      if (speechRunIdRef.current !== runId) return;
      const transcript = Array.from(event.results)
        .map((result: any) => result[0]?.transcript ?? '')
        .join('')
        .trim();
      const base = speechBaseTextRef.current;
      setText(`${base}${base && transcript ? ' ' : ''}${transcript}`);
    };
    recognition.onend = () => {
      if (speechRunIdRef.current === runId) setIsSpeechActive(false);
    };
    recognition.onerror = () => {
      if (speechRunIdRef.current === runId) setIsSpeechActive(false);
    };
    recognitionRef.current = recognition;
    setIsSpeechActive(true);
    recognition.start();
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 132)}px`;
  }, [text]);

  useEffect(() => stopSpeechInput, []);

  return (
    <div className="border-t border-slate-200 bg-white p-3 text-xs">
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {attachments.map(attachment => (
            <div
              key={attachment.id}
              className="flex max-w-[210px] items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] text-slate-600"
            >
              <span className="material-symbols-outlined text-xs">
                {attachment.mimeType.startsWith('image/') ? 'image' : 'attach_file'}
              </span>
              <span className="truncate">{attachment.name}</span>
              <span className="text-slate-400">{formatFileSize(attachment.size)}</span>
              <button
                type="button"
                onClick={() => removeAttachment(attachment.id)}
                className="ml-0.5 text-slate-400 hover:text-red-500"
                title="Remove attachment"
              >
                <span className="material-symbols-outlined text-xs">close</span>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative rounded-2xl border border-slate-200 bg-slate-50 p-1.5 shadow-inner shadow-slate-200/40 focus-within:border-blue-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            void handleFilesSelected(event.target.files);
            event.target.value = '';
          }}
        />
        <input
          ref={imageInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            void handleFilesSelected(event.target.files);
            event.target.value = '';
          }}
        />

        {isAttachMenuOpen && (
          <div className="absolute bottom-full left-1 mb-2 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl shadow-slate-900/10">
            {canUploadImages && (
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
              >
                <span className="material-symbols-outlined text-base text-slate-500">image</span>
                Upload photo
              </button>
            )}
            {canUploadFiles && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
              >
                <span className="material-symbols-outlined text-base text-slate-500">attach_file</span>
                Upload file
              </button>
            )}
          </div>
        )}

        <div className="flex items-end gap-1">
          {(canUploadFiles || canUploadImages) && (
            <button
              type="button"
              onClick={() => setIsAttachMenuOpen(prev => !prev)}
              disabled={disabled}
              className={`mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${
                isAttachMenuOpen
                  ? 'bg-slate-200 text-slate-900'
                  : 'text-slate-500 hover:bg-slate-200 hover:text-slate-900'
              }`}
              title="Attach"
            >
              <span className="material-symbols-outlined text-[19px]">add</span>
            </button>
          )}

          <textarea
            id="chat-input"
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => {
              isComposingRef.current = true;
            }}
            onCompositionEnd={() => {
              setTimeout(() => {
                isComposingRef.current = false;
              }, 0);
            }}
            placeholder={disabled ? 'Waiting for AI response...' : 'Message AI Assistant'}
            disabled={disabled}
            rows={1}
            className="max-h-36 min-h-8 flex-1 resize-none bg-transparent px-1 py-2 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:text-slate-400"
          />

          <button
            type="button"
            onClick={toggleSpeechInput}
            disabled={disabled}
            className={`mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${
              isSpeechActive
                ? 'bg-red-50 text-red-600'
                : 'text-slate-500 hover:bg-slate-200 hover:text-slate-900'
            }`}
            title="Voice input"
          >
            <span className="material-symbols-outlined text-[19px]">
              {isSpeechActive ? 'mic_off' : 'keyboard_voice'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!canSend}
            className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            title="Send"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
          </button>
        </div>
      </div>
    </div>
  );
};
