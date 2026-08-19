import { useRef, useState } from 'react';

interface Props {
  html: string;
  renderKey: number;
}

export function SandboxPanel({ html, renderKey }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handlePrint = () => {
    iframeRef.current?.contentWindow?.print();
  };

  const handleFullscreen = () => {
    iframeRef.current?.requestFullscreen?.();
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  if (!html) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50">
        <span className="material-symbols-outlined text-5xl text-gray-300 mb-3">bar_chart</span>
        <p className="text-sm font-medium text-gray-500">尚無報告</p>
        <p className="text-xs text-gray-400 mt-1">與 AI 對話後，報告將顯示於此</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="shrink-0 flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-200">
        <span className="text-xs font-medium text-gray-500 flex items-center gap-1">
          <span className="material-symbols-outlined text-blue-400" style={{ fontSize: 14 }}>analytics</span>
          報告預覽
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleRefresh}
            title="重新載入報告"
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-600 hover:bg-gray-200 transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>refresh</span>
            <span className="hidden sm:inline">重新載入</span>
          </button>
          <button
            onClick={handlePrint}
            title="列印 / 匯出 PDF"
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-600 hover:bg-gray-200 transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>print</span>
            <span className="hidden sm:inline">列印 / PDF</span>
          </button>
          <button
            onClick={handleFullscreen}
            title="全螢幕展示"
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-600 hover:bg-gray-200 transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>fullscreen</span>
            <span className="hidden sm:inline">全螢幕</span>
          </button>
        </div>
      </div>
      <iframe
        key={`${renderKey}-${refreshKey}`}
        ref={iframeRef}
        srcDoc={html}
        sandbox="allow-scripts allow-same-origin allow-modals"
        allowFullScreen
        className="block flex-1 min-h-0 w-full overflow-auto border-none"
        scrolling="yes"
        title="分析報告"
      />
    </div>
  );
}
