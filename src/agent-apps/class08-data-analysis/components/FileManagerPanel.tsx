import { useEffect, useState } from 'react';
import { nanoid } from '../../../agent/utils/nanoid';
import { loadReports, saveReports } from '../repositories/reportRepository';
import type { ReportFile } from '../types/report';

interface NewReportSignal {
  html: string;
  title: string;
  key: number;
}

interface Props {
  newReport: NewReportSignal | null;
  onDisplay: (html: string) => void;
}

export function FileManagerPanel({ newReport, onDisplay }: Props) {
  const [reports, setReports] = useState<ReportFile[]>(loadReports);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Save every new AI-generated report as a new version
  useEffect(() => {
    if (!newReport) return;
    const { html, title } = newReport;

    setReports(prev => {
      const existing = prev.find(r => r.name === title);
      if (existing) {
        const nextVersion = existing.currentVersion + 1;
        const updated = prev.map(r =>
          r.id === existing.id
            ? { ...r, currentVersion: nextVersion, versions: [...r.versions, { version: nextVersion, title, html, createdAt: new Date().toISOString() }] }
            : r
        );
        saveReports(updated);
        setSelectedId(existing.id);
        return updated;
      }
      const entry: ReportFile = {
        id: nanoid(),
        name: title,
        currentVersion: 1,
        versions: [{ version: 1, title, html, createdAt: new Date().toISOString() }],
      };
      const updated = [entry, ...prev];
      saveReports(updated);
      setSelectedId(entry.id);
      return updated;
    });
  }, [newReport]);

  const handleSelect = (report: ReportFile, version?: number) => {
    const v = report.versions.find(rv => rv.version === (version ?? report.currentVersion));
    if (!v) return;
    setSelectedId(report.id);
    onDisplay(v.html); // navigate without triggering save
  };

  const handleDelete = (id: string) => {
    setReports(prev => {
      const updated = prev.filter(r => r.id !== id);
      saveReports(updated);
      return updated;
    });
    if (selectedId === id) setSelectedId(null);
  };

  if (reports.length === 0) {
    return (
      <div className="h-full bg-gray-50 flex flex-col items-center justify-center text-gray-400 p-4">
        <span className="material-symbols-outlined text-3xl text-gray-300 mb-2">folder_open</span>
        <p className="text-xs text-center">尚無報告<br />對話後自動儲存</p>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-50 flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-200">
        <h3 className="text-xs font-semibold text-gray-600 flex items-center gap-1">
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>folder</span>
          報告庫
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {reports.map(report => (
          <div
            key={report.id}
            className={`rounded-lg border transition-colors ${selectedId === report.id ? 'border-blue-300 bg-blue-50' : 'border-transparent hover:bg-white hover:border-gray-200'}`}
          >
            <div
              className="flex items-center gap-2 px-2 py-1.5 cursor-pointer"
              onClick={() => handleSelect(report)}
            >
              <span className="material-symbols-outlined text-blue-400 shrink-0" style={{ fontSize: 14 }}>description</span>
              <span className="text-xs text-gray-700 flex-1 truncate">{report.name}</span>
              <button
                onClick={e => { e.stopPropagation(); handleDelete(report.id); }}
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-100 hover:text-red-500 text-gray-400 shrink-0"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>delete</span>
              </button>
            </div>
            {report.versions.length > 1 && (
              <div className="px-6 pb-1 space-y-0.5">
                {[...report.versions].reverse().map(v => (
                  <div
                    key={v.version}
                    onClick={() => handleSelect(report, v.version)}
                    className={`text-xs px-2 py-0.5 rounded cursor-pointer ${report.currentVersion === v.version ? 'text-blue-600 font-medium' : 'text-gray-500 hover:text-blue-500'}`}
                  >
                    v{v.version} — {new Date(v.createdAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
