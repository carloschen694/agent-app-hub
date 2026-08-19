import React from 'react';
import type { ProposalDoc, VersionSnapshot } from '../types';
import { loadVersions } from '../services/storageService';

interface Props {
  doc: ProposalDoc;
  onClose: () => void;
  onRestore: (snapshot: VersionSnapshot) => void;
}

export const VersionHistoryModal: React.FC<Props> = ({ doc, onClose, onRestore }) => {
  const snapshots = loadVersions(doc.id).slice().reverse();

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleString('zh-TW', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 print:hidden">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-base font-semibold text-gray-800">版本紀錄</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Published versions */}
        <div className="px-6 py-4 max-h-96 overflow-y-auto">
          {doc.publishedVersions.length === 0 && snapshots.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              尚未發布任何版本。在對話框中告訴 AI「發布新版本」即可記錄目前進度。
            </p>
          ) : (
            <ul className="space-y-3">
              {doc.publishedVersions.slice().reverse().map((log, i) => {
                const snap = snapshots.find(s => s.name === log.version);
                return (
                  <li key={i} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200">
                    <span className="shrink-0 mt-0.5 inline-block px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded">
                      v{log.version}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 mb-0.5">{formatDate(log.timestamp)}</p>
                      <p className="text-sm text-gray-700 leading-snug">{log.changes}</p>
                    </div>
                    {snap && (
                      <button
                        onClick={() => {
                          if (confirm(`確定還原至 v${log.version}？目前未儲存的變更將會遺失。`)) {
                            onRestore(snap);
                          }
                        }}
                        className="shrink-0 text-xs text-blue-600 hover:text-blue-800 underline mt-0.5"
                      >
                        還原
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t bg-gray-50 text-xs text-gray-400">
          在對話窗中說「幫我發布新版本」，AI 會自動分析變更幅度並建立版本紀錄。
        </div>
      </div>
    </div>
  );
};
