import React, { useState } from 'react';
import type { ComparisonReport } from '../repositories/reportRepository';
import { reportRepository } from '../repositories/reportRepository';
import { Button } from '../../../shared/components/Button';

interface FileManagerProps {
  reports: ComparisonReport[];
  selectedReportId: string | null;
  onSelectReport: (id: string) => void;
  onUpdateReports: () => void;
}

export const FileManager: React.FC<FileManagerProps> = ({
  reports,
  selectedReportId,
  onSelectReport,
  onUpdateReports
}) => {
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [editNameInput, setEditNameInput] = useState('');



  const handleCreateNew = () => {
    const defaultHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 40px; text-align: center; color: #475569; background: #f8fafc; }
    .card { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; max-width: 480px; margin: 0 auto; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    h2 { color: #1e293b; margin-top: 0; }
    p { font-size: 14px; line-height: 1.5; color: #64748b; }
    .prompt { background: #f1f5f9; padding: 12px; border-radius: 6px; font-style: italic; margin-top: 16px; font-size: 13px; color: #334155; }
  </style>
</head>
<body>
  <div class="card">
    <h2>🛒 新增比價任務</h2>
    <p>這是一份全新的比價報告。請點擊右下角對話按鈕，向 AI 助理描述您的採購目標。</p>
    <div class="prompt">「我想買 32 吋 4K 螢幕，預算 12000 元以下，幫我搜尋 Momo 和 PChome」</div>
  </div>
</body>
</html>
    `;
    const newReport = reportRepository.createReport('未命名比價報告', defaultHtml, '初始化');
    onUpdateReports();
    onSelectReport(newReport.id);
  };

  const handleStartRename = (r: ComparisonReport, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingReportId(r.id);
    setEditNameInput(r.name);
  };

  const handleSaveRename = (id: string, e: React.FormEvent) => {
    e.preventDefault();
    if (editNameInput.trim()) {
      reportRepository.renameReport(id, editNameInput.trim());
      onUpdateReports();
    }
    setEditingReportId(null);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm('確定要刪除這份比價報告與所有歷史版本嗎？')) {
      reportRepository.deleteReport(id);
      onUpdateReports();
      if (selectedReportId === id) {
        const remaining = reportRepository.getReports();
        onSelectReport(remaining.length > 0 ? remaining[0].id : '');
      }
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${m}/${day} ${h}:${min}`;
  };

  return (
    <div className="flex flex-col bg-white border border-slate-200 rounded-lg shadow-sm h-full overflow-hidden text-gray-700">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 flex-shrink-0">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-lg text-blue-600">folder</span>
          比價任務清單
        </h3>
        <Button
          size="sm"
          onClick={handleCreateNew}
          className="flex items-center gap-0.5 px-2 py-1 text-xs"
        >
          <span className="material-symbols-outlined text-sm font-bold">add</span>
          新增報告
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {reports.length === 0 ? (
          <div className="text-center text-gray-400 py-12 text-xs">
            <span className="material-symbols-outlined text-3xl mb-1 text-slate-300 block">inventory_2</span>
            目前無任何報告，請點擊上方按鈕新增。
          </div>
        ) : (
          reports.map((r) => {
            const isSelected = r.id === selectedReportId;
            const isEditing = editingReportId === r.id;

            return (
              <div
                key={r.id}
                onClick={() => !isEditing && onSelectReport(r.id)}
                className={`p-3 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-blue-300 bg-blue-50/40 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {isEditing ? (
                  <form
                    onSubmit={(e) => handleSaveRename(r.id, e)}
                    onClick={(e) => e.stopPropagation()}
                    className="flex gap-1"
                  >
                    <input
                      type="text"
                      value={editNameInput}
                      onChange={(e) => setEditNameInput(e.target.value)}
                      className="flex-1 px-2 py-1 border border-blue-400 rounded text-xs focus:outline-none bg-white text-gray-800"
                      autoFocus
                      onBlur={() => setTimeout(() => setEditingReportId(null), 200)}
                    />
                    <button
                      type="submit"
                      className="bg-blue-600 text-white rounded px-2 text-xs flex items-center justify-center"
                    >
                      儲存
                    </button>
                  </form>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-xs text-gray-800 line-clamp-1 flex-1">
                        {r.name}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleStartRename(r, e)}
                          className="text-slate-500 hover:text-blue-600 p-0.5"
                          title="重命名"
                        >
                          <span className="material-symbols-outlined text-base">edit</span>
                        </button>
                        <button
                          onClick={(e) => handleDelete(r.id, e)}
                          className="text-slate-500 hover:text-red-600 p-0.5"
                          title="刪除報告"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center text-[10px] text-gray-400">
                      <span>版本數: {r.versions.length} 版</span>
                      <span>更新: {formatTime(r.updatedAt)}</span>
                    </div>

                    {/* Versions Sub-list (only show if selected) */}
                    {isSelected && (
                      <div className="mt-3 pt-2.5 border-t border-slate-200/60 space-y-1.5" onClick={e => e.stopPropagation()}>
                        <div className="text-[10px] font-semibold text-slate-500 flex items-center gap-0.5 mb-1.5">
                          <span className="material-symbols-outlined text-xs">history</span>
                          <span>版本歷史紀錄</span>
                        </div>
                        <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                          {r.versions.slice().reverse().map((v) => {
                            const isCurrentVer = r.currentVersionId === v.id;
                            return (
                              <div
                                key={v.id}
                                onClick={() => reportRepository.switchVersion(r.id, v.id) && onUpdateReports()}
                                className={`px-2 py-1.5 rounded flex items-center justify-between text-[10px] border transition-colors ${
                                  isCurrentVer
                                    ? 'bg-orange-50 border-orange-200 text-orange-700 font-semibold'
                                    : 'bg-white border-slate-100 hover:bg-slate-50 text-slate-600'
                                }`}
                              >
                                <span className="truncate max-w-[90px]">{v.description}</span>
                                <span className="opacity-75">{formatTime(v.timestamp)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
