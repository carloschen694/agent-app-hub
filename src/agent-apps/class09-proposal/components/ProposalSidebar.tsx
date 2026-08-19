import React from 'react';
import type { ProposalDoc } from '../types';

interface Props {
  doc: ProposalDoc;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export const ProposalSidebar: React.FC<Props> = ({ doc, canUndo, canRedo, onUndo, onRedo }) => {
  const scrollTo = (sectionId: string) => {
    document.getElementById(`sec-${sectionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 print:hidden overflow-hidden">
      {/* Section list header */}
      <div className="px-3 py-2.5 border-b border-gray-200">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">章節</span>
      </div>

      {/* Section list */}
      <div className="flex-1 overflow-y-auto py-1">
        {doc.sections.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6 px-3 leading-relaxed">
            尚無章節，請在右側對話框向 AI 描述需求
          </p>
        ) : (
          doc.sections.map((section, i) => (
            <button
              key={section.id}
              onClick={() => scrollTo(section.id)}
              className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-white hover:shadow-sm rounded mx-1 transition-all group"
              style={{ width: 'calc(100% - 8px)' }}
            >
              <span className="shrink-0 text-xs text-gray-400 w-5 mt-0.5 text-right">{i + 1}.</span>
              <span className="flex-1 text-xs text-gray-700 group-hover:text-blue-700 leading-snug line-clamp-2">
                {section.title}
              </span>
              <span className="shrink-0 text-xs mt-0.5">
                {section.isComplete
                  ? <span className="text-green-500">✓</span>
                  : <span className="text-gray-300">○</span>
                }
              </span>
            </button>
          ))
        )}
      </div>

      {/* Undo / Redo */}
      <div className="border-t border-gray-200 flex items-center justify-center gap-3 px-3 py-2">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="text-xs text-gray-500 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
          title="復原 (Ctrl+Z)"
        >
          ↩ 復原
        </button>
        <span className="text-gray-200">|</span>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="text-xs text-gray-500 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
          title="重做 (Ctrl+Y)"
        >
          重做 ↪
        </button>
      </div>
    </div>
  );
};
