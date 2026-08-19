import React from 'react';
import { SandboxHtmlViewer } from '../../../shared/components/SandboxHtmlViewer';
import { useAgent } from '../../../agent/hooks/useAgent';

interface SandboxPanelProps {
  html: string;
  reportId: string | null;
}

/**
 * Class 07 price-comparison report preview: composes the shared SandboxHtmlViewer
 * with this app's AI-edit behavior (sends a generatePriceReport update
 * request through the agent chat).
 */
export const SandboxPanel: React.FC<SandboxPanelProps> = ({ html, reportId }) => {
  const { sendMessageText, setUiState } = useAgent();

  const handleEditRequest = async (selectedElementHtml: string, editPrompt: string) => {
    const fullMessage = `
我想要修改比價報告中選取的這個 HTML 區塊：
\`\`\`html
${selectedElementHtml}
\`\`\`

我的修改要求是：
${editPrompt}

請幫我更新這份比價報告，修改其外觀樣式（Look and feel），並請呼叫 "generatePriceReport" 工具將更新後的完整 HTML 內容寫入沙盒。
`;

    // Automatically open the agent window so user sees the progress
    setUiState({ isOpened: true });
    await sendMessageText(fullMessage);
  };

  return (
    <SandboxHtmlViewer
      html={html}
      contentKey={reportId}
      title="沙盒報告預覽區"
      onEditRequest={handleEditRequest}
      emptyState={
        <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs gap-1.5 p-6 select-none">
          <span className="material-symbols-outlined text-4xl text-slate-300">analytics</span>
          <p className="font-semibold text-slate-500">目前尚無報告內容</p>
          <p className="text-center max-w-[280px] leading-relaxed">
            請從左側任務清單選取報告，或開啟對話讓助理為您搜尋並自動生成比價報告。
          </p>
        </div>
      }
    />
  );
};
