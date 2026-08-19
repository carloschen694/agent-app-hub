import React, { useState, useEffect, useRef } from 'react';
import { Button } from './Button';

/**
 * Reusable sandboxed HTML viewer for AI-generated content (reports, docs,
 * dashboards). Generic shared component — it knows nothing about any
 * specific AgentApp. Apps compose it and provide their own behavior via
 * props (e.g. what to do when the user asks AI to edit a selected block).
 */
export interface SandboxHtmlViewerProps {
  html: string;
  /** Changing this key clears element selection (e.g. switching reports). */
  contentKey?: string | null;
  /** Toolbar title. */
  title?: string;
  /**
   * Enables the "AI edit selection" mode. Called with the selected element's
   * outerHTML and the user's edit instruction. Omit to hide the edit mode.
   */
  onEditRequest?: (selectedElementHtml: string, editPrompt: string) => void | Promise<void>;
  /** Rendered when html is empty. */
  emptyState?: React.ReactNode;
}

export const SandboxHtmlViewer: React.FC<SandboxHtmlViewerProps> = ({
  html,
  contentKey,
  title = '沙盒預覽區',
  onEditRequest,
  emptyState
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Mode state: 'view' allows user interaction (links, details, tooltips),
  // 'edit' allows element selection for AI edit.
  const [interactiveMode, setInteractiveMode] = useState<'view' | 'edit'>('view');

  const [selectedElementHtml, setSelectedElementHtml] = useState<string | null>(null);
  const [floatingBtnCoords, setFloatingBtnCoords] = useState<{ top: number; left: number } | null>(null);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');

  const supportsEdit = Boolean(onEditRequest);

  const clearSelection = () => {
    setSelectedElementHtml(null);
    setFloatingBtnCoords(null);
    const iframe = iframeRef.current;
    if (iframe) {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        const selected = doc.querySelectorAll('.ai-selected-highlight');
        selected.forEach(el => el.classList.remove('ai-selected-highlight'));
        const hovered = doc.querySelectorAll('.ai-hover-highlight');
        hovered.forEach(el => el.classList.remove('ai-hover-highlight'));
      }
    }
  };

  const handlePrint = () => {
    const iframe = iframeRef.current;
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        console.error('Print failed', e);
        alert('請先點擊內容區域，再手動按 Ctrl+P (或 Cmd+P) 進行列印。');
      }
    }
  };

  const handleFullscreen = () => {
    const iframe = iframeRef.current;
    if (iframe) {
      if (iframe.requestFullscreen) {
        iframe.requestFullscreen();
      } else if ((iframe as any).webkitRequestFullscreen) { /* Safari */
        (iframe as any).webkitRequestFullscreen();
      } else if ((iframe as any).msRequestFullscreen) { /* IE11 */
        (iframe as any).msRequestFullscreen();
      }
    }
  };

  const handleSubmitEdit = async () => {
    if (!editPrompt.trim() || !selectedElementHtml || !onEditRequest) return;
    const selected = selectedElementHtml;
    const prompt = editPrompt;

    setShowPromptModal(false);
    setEditPrompt('');
    clearSelection();

    try {
      await onEditRequest(selected, prompt);
    } catch (e) {
      console.error('Edit request failed', e);
    }
  };

  // Set up click/hover listeners inside the iframe
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !html) return;

    if (interactiveMode === 'view') {
      clearSelection();
      // External links inside the sandboxed iframe can't navigate normally,
      // so intercept clicks from the parent and open them in a new tab.
      const handleViewLoad = () => {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) return;
        const onLinkClick = (e: MouseEvent) => {
          const anchor = (e.target as HTMLElement | null)?.closest?.(
            'a[href]'
          ) as HTMLAnchorElement | null;
          if (!anchor) return;
          const href = anchor.getAttribute('href') ?? '';
          // Keep in-page anchors (#section) working inside the content.
          if (!/^https?:/i.test(href)) return;
          e.preventDefault();
          e.stopPropagation();
          window.open(href, '_blank', 'noopener,noreferrer');
        };
        doc.addEventListener('click', onLinkClick, true);
        return () => doc.removeEventListener('click', onLinkClick, true);
      };

      iframe.addEventListener('load', handleViewLoad);
      const viewDoc = iframe.contentDocument || iframe.contentWindow?.document;
      let viewCleanup: (() => void) | undefined;
      if (viewDoc && viewDoc.readyState === 'complete') {
        viewCleanup = handleViewLoad();
      }
      return () => {
        iframe.removeEventListener('load', handleViewLoad);
        if (viewCleanup) viewCleanup();
      };
    }

    const handleIframeLoad = () => {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) return;

      // Add a style tag to the iframe to handle highlights cleanly
      const styleId = 'sandbox-highlight-styles';
      if (!doc.getElementById(styleId)) {
        const style = doc.createElement('style');
        style.id = styleId;
        style.textContent = `
          .ai-hover-highlight {
            outline: 2px dashed #2563EB !important;
            cursor: pointer !important;
            outline-offset: -1px;
          }
          .ai-selected-highlight {
            outline: 2px solid #F97316 !important;
            outline-offset: -1px;
          }
        `;
        doc.head.appendChild(style);
      }

      let hoveredEl: HTMLElement | null = null;
      let selectedEl: HTMLElement | null = null;

      const onMouseOver = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target === doc.body || target === doc.documentElement) return;
        if (hoveredEl) hoveredEl.classList.remove('ai-hover-highlight');
        hoveredEl = target;
        target.classList.add('ai-hover-highlight');
      };

      const onMouseOut = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        target.classList.remove('ai-hover-highlight');
      };

      const onClick = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const target = e.target as HTMLElement;
        if (target === doc.body || target === doc.documentElement) return;

        if (selectedEl) {
          selectedEl.classList.remove('ai-selected-highlight');
        }

        selectedEl = target;
        selectedEl.classList.add('ai-selected-highlight');

        // Extract clean outerHTML (remove our highlight classes first)
        const cloned = target.cloneNode(true) as HTMLElement;
        cloned.classList.remove('ai-hover-highlight');
        cloned.classList.remove('ai-selected-highlight');

        setSelectedElementHtml(cloned.outerHTML);

        // Get coordinates of the clicked element relative to the iframe
        const rect = target.getBoundingClientRect();

        // Position the floating button inside the parent container (accounting for p-3 padding of 12px)
        setFloatingBtnCoords({
          top: rect.top + 12 - 16,
          left: rect.right + 12 - 16
        });
      };

      doc.addEventListener('mouseover', onMouseOver);
      doc.addEventListener('mouseout', onMouseOut);
      doc.addEventListener('click', onClick);

      return () => {
        doc.removeEventListener('mouseover', onMouseOver);
        doc.removeEventListener('mouseout', onMouseOut);
        doc.removeEventListener('click', onClick);
      };
    };

    iframe.addEventListener('load', handleIframeLoad);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    let cleanupFn: (() => void) | undefined;
    if (doc && doc.readyState === 'complete') {
      cleanupFn = handleIframeLoad();
    }

    return () => {
      iframe.removeEventListener('load', handleIframeLoad);
      if (cleanupFn) cleanupFn();
    };
  }, [html, interactiveMode]);

  // Clear selections when switching content
  useEffect(() => {
    clearSelection();
    setShowPromptModal(false);
  }, [contentKey]);

  return (
    <div className="flex flex-col bg-white border border-slate-200 rounded-lg shadow-sm h-full overflow-hidden text-gray-700">
      {/* Toolbar */}
      <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50 flex-shrink-0 select-none">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-lg text-orange-500">wysiwyg</span>
            <span className="text-xs font-semibold text-gray-800">{title}</span>
          </div>

          {/* View Mode / AI Edit Mode Segmented Control */}
          {html && supportsEdit && (
            <div className="flex items-center bg-slate-200/70 p-0.5 rounded-md gap-0.5 text-[10px]">
              <button
                type="button"
                onClick={() => {
                  setInteractiveMode('view');
                  clearSelection();
                }}
                className={`px-3 py-1 rounded-sm font-medium transition-all duration-150 cursor-pointer ${
                  interactiveMode === 'view'
                    ? 'bg-white text-slate-800 shadow-sm font-semibold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className="flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-[13px]">visibility</span>
                  <span>瀏覽互動模式</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setInteractiveMode('edit')}
                className={`px-3 py-1 rounded-sm font-medium transition-all duration-150 cursor-pointer ${
                  interactiveMode === 'edit'
                    ? 'bg-white text-blue-600 shadow-sm font-semibold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className="flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-[13px]">auto_awesome</span>
                  <span>AI 編輯選取模式</span>
                </span>
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {selectedElementHtml && (
            <Button
              size="sm"
              variant="secondary"
              onClick={clearSelection}
              className="flex items-center gap-0.5 px-2 py-1 text-xs text-red-600 border-red-200 hover:bg-red-50"
            >
              <span className="material-symbols-outlined text-sm">cancel</span>
              取消選取
            </Button>
          )}

          <Button
            size="sm"
            variant="secondary"
            onClick={handlePrint}
            disabled={!html}
            className="flex items-center gap-0.5 px-2 py-1 text-xs disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-sm">print</span>
            匯出 PDF
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={handleFullscreen}
            disabled={!html}
            className="flex items-center gap-0.5 px-2 py-1 text-xs disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-sm">fullscreen</span>
            全螢幕提報
          </Button>
        </div>
      </div>

      {/* Content Sandbox Display */}
      <div className="flex-1 bg-slate-100 p-3 overflow-hidden relative">
        {html ? (
          <>
            <iframe
              ref={iframeRef}
              srcDoc={html}
              title="sandbox-html-viewer"
              sandbox="allow-scripts allow-modals allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              className="w-full h-full border border-slate-200 rounded-md bg-white shadow-inner"
            />

            {/* Floating AI Edit Button */}
            {interactiveMode === 'edit' && floatingBtnCoords && (
              <button
                style={{
                  position: 'absolute',
                  top: `${Math.max(12, floatingBtnCoords.top)}px`,
                  left: `${Math.max(12, floatingBtnCoords.left)}px`,
                  zIndex: 20
                }}
                onClick={() => setShowPromptModal(true)}
                className="bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white rounded-full p-2.5 shadow-lg flex items-center justify-center focus:outline-none border-2 border-white cursor-pointer transform hover:scale-115 transition-all duration-150 animate-bounce"
                title="要求 AI 修改此區塊"
              >
                <span className="material-symbols-outlined text-base font-bold">smart_toy</span>
              </button>
            )}
          </>
        ) : (
          emptyState ?? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs gap-1.5 p-6 select-none">
              <span className="material-symbols-outlined text-4xl text-slate-300">analytics</span>
              <p className="font-semibold text-slate-500">目前尚無內容</p>
            </div>
          )
        )}

        {/* Ask AI Dialog Modal overlay */}
        {showPromptModal && (
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs z-30 flex items-center justify-center p-4 select-none">
            <div className="bg-white rounded-lg shadow-xl border border-slate-200 p-4 max-w-sm w-full space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-gray-800 flex items-center gap-1 font-heading">
                  <span className="material-symbols-outlined text-sm text-orange-500">smart_toy</span>
                  要求 AI 修改此區塊
                </h4>
                <button
                  onClick={() => {
                    setShowPromptModal(false);
                    setEditPrompt('');
                  }}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded p-2 text-[9px] text-slate-500 max-h-20 overflow-y-auto font-mono select-text">
                <div className="font-semibold text-[8px] text-slate-400 mb-0.5">選取區塊：</div>
                {selectedElementHtml}
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-semibold text-slate-600">修改指令：</label>
                <textarea
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  placeholder="請輸入您的修改指示，例如：將此列背景標記為淡綠色，或者字體改為紅色粗體..."
                  className="w-full h-16 p-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white resize-none text-slate-800 select-text"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-1.5 pt-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowPromptModal(false);
                    setEditPrompt('');
                  }}
                  className="text-xs text-gray-500 hover:bg-slate-50"
                >
                  取消
                </Button>
                <Button
                  size="sm"
                  onClick={() => void handleSubmitEdit()}
                  disabled={!editPrompt.trim()}
                  className="bg-orange-500 hover:bg-orange-600 text-white text-xs px-3 font-semibold"
                >
                  傳送指令
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
