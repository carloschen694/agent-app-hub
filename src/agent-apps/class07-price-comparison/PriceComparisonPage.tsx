import React, { useState, useEffect, useRef } from 'react';
import { FileManager } from './components/FileManager';
import { SandboxPanel } from './components/SandboxPanel';
import { reportRepository } from './repositories/reportRepository';
import type { ComparisonReport } from './repositories/reportRepository';
import { useAgentTools } from '../../agent/hooks/useAgentTools';
import { CollapsibleSidebar, SidebarToggleButton, useCollapsibleSidebar } from '../../shared/components/CollapsibleSidebar';

export const PriceComparisonPage: React.FC = () => {
  const [reports, setReports] = useState<ComparisonReport[]>(() => reportRepository.getReports());
  const [selectedReportId, setSelectedReportId] = useState<string | null>(() => {
    const list = reportRepository.getReports();
    return list.length > 0 ? list[0].id : null;
  });

  const { registerToolHandlers, setRuntimeContext } = useAgentTools();
  const sidebar = useCollapsibleSidebar();
  
  // Track selectedReportId in a ref to avoid stale closure issues in tool handlers
  const selectedReportIdRef = useRef(selectedReportId);
  useEffect(() => {
    selectedReportIdRef.current = selectedReportId;
  }, [selectedReportId]);

  // Register the generatePriceReport tool handler
  useEffect(() => {
    registerToolHandlers({
      generatePriceReport: (args: { html: string }) => {
        const currentId = selectedReportIdRef.current;
        let activeId = currentId;
        
        if (currentId) {
          reportRepository.addReportVersion(currentId, args.html, 'AI 生成報告');
        } else {
          // If no report is selected or exists, create a new one
          const newReport = reportRepository.createReport('AI 比價報告', args.html, 'AI 生成報告');
          activeId = newReport.id;
          setSelectedReportId(newReport.id);
        }
        
        setReports(reportRepository.getReports());
        return { 
          status: 'success', 
          message: '比價報告已成功寫入沙盒預覽區。',
          reportId: activeId
        };
      }
    });

    return () => {
      registerToolHandlers({});
    };
  }, [registerToolHandlers]);

  const activeReport = reports.find(r => r.id === selectedReportId) || null;
  const activeVersion = activeReport?.versions.find(v => v.id === activeReport.currentVersionId) || null;

  // Sync runtime context with AI Agent
  useEffect(() => {
    if (activeReport && activeVersion) {
      setRuntimeContext(`
目前頁面：比價助手。
目前選取的比價報告名稱為 "${activeReport.name}"，當前版本為 "${activeVersion.description}"。
你可以呼叫 "generatePriceReport" 工具，並傳入 HTML 內容來更新此報告，這會新增一個版本紀錄。
請盡量使用豐富、美觀的 CSS 樣式，並用表格、卡片或顏色（例如綠色標記最低價，紅色標記最高價）來視覺化比較結果。
`);
    } else {
      setRuntimeContext(`
目前頁面：比價助手。
目前尚未選取或建立任何比價報告。你可以主動為使用者建立一份比價報告，或者請使用者點擊「新增報告」按鈕。
`);
    }
  }, [activeReport, activeVersion, setRuntimeContext]);

  const handleUpdateReports = () => {
    setReports(reportRepository.getReports());
  };



  return (
    <div className="flex h-[calc(100vh-100px)] min-h-[500px] flex-col select-none">
      <div className="flex shrink-0 items-center px-1 py-1.5">
        <SidebarToggleButton collapsed={sidebar.toggleButtonState} onToggle={sidebar.toggle} />
      </div>
      <div className="flex flex-1 min-h-0 gap-6">
        <CollapsibleSidebar
          label="比價報告"
          icon="folder"
          widthPx={280}
          collapsed={sidebar.collapsed}
          mobileOpen={sidebar.mobileOpen}
          onMobileOpenChange={sidebar.setMobileOpen}
          className="border-r border-slate-200 bg-slate-50"
        >
          <FileManager
            reports={reports}
            selectedReportId={selectedReportId}
            onSelectReport={setSelectedReportId}
            onUpdateReports={handleUpdateReports}
          />
        </CollapsibleSidebar>
        <div className="min-w-0 flex-1">
          <SandboxPanel
            html={activeVersion?.html || ''}
            reportId={selectedReportId}
          />
        </div>
      </div>
    </div>
  );
};
