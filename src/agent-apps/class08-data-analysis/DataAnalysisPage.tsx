import { useEffect, useRef, useState } from 'react';
import { FileManagerPanel } from './components/FileManagerPanel';
import { SandboxPanel } from './components/SandboxPanel';
import { useAgent } from '../../agent/hooks/useAgent';
import { sandboxStore } from './store/sandboxStore';
import { dataAnalysisTools } from './tools/dataAnalysisTools';
import { CollapsibleSidebar, SidebarToggleButton, useCollapsibleSidebar } from '../../shared/components/CollapsibleSidebar';

interface NewReportSignal {
  html: string;
  title: string;
  key: number;
}

function injectBeforeBodyClose(existing: string, addition: string): string {
  const idx = existing.lastIndexOf('</body>');
  if (idx === -1) return existing + addition;
  return existing.slice(0, idx) + addition + existing.slice(idx);
}

export function DataAnalysisPage() {
  const { settings, registerToolHandlers, setRuntimeContext } = useAgent();
  const [displayHtml, setDisplayHtml] = useState('');
  const [displayKey, setDisplayKey] = useState(0);
  const [newReport, setNewReport] = useState<NewReportSignal | null>(null);
  const sidebar = useCollapsibleSidebar();

  // Refs for accumulated state — avoids stale closure in subscribe callback
  const htmlRef = useRef('');
  const titleRef = useRef('分析報告');

  // Keep htmlRef in sync when the user navigates to a different report from FileManagerPanel
  const handleDisplay = (html: string) => {
    htmlRef.current = html;
    setDisplayHtml(html);
    setDisplayKey(prev => prev + 1);
  };

  useEffect(() => {
    setRuntimeContext('目前頁面：class08 數據分析助理。可讀取 Northwind/PostgREST 或內建範例資料，並生成 HTML/Chart.js 分析報告。');
    registerToolHandlers(Object.fromEntries(dataAnalysisTools.map((tool) => [tool.name, tool.handler])));
    return () => registerToolHandlers({});
  }, [registerToolHandlers, setRuntimeContext]);

  useEffect(() => {
    return sandboxStore.subscribe((html, title, mode) => {
      let next: string;
      if (mode === 'append') {
        next = injectBeforeBodyClose(htmlRef.current, html);
      } else {
        next = html;
        titleRef.current = title ?? '分析報告';
      }
      htmlRef.current = next;
      setDisplayHtml(next);
      setDisplayKey(prev => prev + 1);
      setNewReport(prev => ({
        html: next,
        title: titleRef.current,
        key: (prev?.key ?? 0) + 1,
      }));
    });
  }, []); // empty deps — all mutable state accessed via refs

  return (
    <div className="flex h-[calc(100vh-5.5rem)] min-h-0 flex-col overflow-hidden md:h-[calc(100vh-6.5rem)]">
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2">
          <SidebarToggleButton collapsed={sidebar.toggleButtonState} onToggle={sidebar.toggle} />
          <div>
            <h1 className="text-base font-semibold text-gray-800">數據分析助理</h1>
            <p className="text-xs text-gray-500 mt-0.5">Northwind 2023 銷售 × Google Trends — 由 AI 分析並生成視覺化報告</p>
          </div>
        </div>
        {!settings.apiKey && (
          <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
            <span className="material-symbols-outlined text-amber-500" style={{ fontSize: 16 }}>warning</span>
            <span className="text-xs text-amber-700">請先在右下角 Agent 設定 API Key</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <CollapsibleSidebar
          label="報告庫"
          icon="folder"
          collapsed={sidebar.collapsed}
          mobileOpen={sidebar.mobileOpen}
          onMobileOpenChange={sidebar.setMobileOpen}
          className="border-r border-gray-200 bg-gray-50"
        >
          <FileManagerPanel newReport={newReport} onDisplay={handleDisplay} />
        </CollapsibleSidebar>
        <SandboxPanel html={displayHtml} renderKey={displayKey} />
      </div>
    </div>
  );
}
