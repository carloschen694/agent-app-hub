import React from 'react';
import type { ProposalDoc, ProposalBlock } from '../types';
import { CoverPage } from './CoverPage';
import { TableOfContents } from './TableOfContents';
import { DocumentBlock } from './DocumentBlock';

interface Props {
  doc: ProposalDoc;
  zoom: number;
  onUpdateBlock: (sectionId: string, updated: ProposalBlock) => void;
  onDeleteBlock: (sectionId: string, blockId: string) => void;
  onAiRewrite: (sectionId: string, block: ProposalBlock, userPrompt: string) => void;
}

export const DocumentCanvas: React.FC<Props> = ({ doc, zoom, onUpdateBlock, onDeleteBlock, onAiRewrite }) => {
  return (
    <div
      className="mx-auto bg-white shadow-xl print:shadow-none"
      style={{
        width: `${210 * (zoom / 100)}mm`,
        minHeight: `${297 * (zoom / 100)}mm`,
        fontSize: `${zoom}%`,
        transformOrigin: 'top center',
      }}
    >
      {/* Cover page */}
      <CoverPage doc={doc} />

      {/* Table of contents */}
      <TableOfContents sections={doc.sections} />

      {/* Sections */}
      {doc.sections.map((section, index) => (
        <div
          key={section.id}
          id={`sec-${section.id}`}
          className="py-8 px-12 border-b border-gray-100 last:border-b-0 break-before-page"
        >
          {/* Section header */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
              {String(index + 1).padStart(2, '0')}
            </span>
            <h2 className="text-2xl font-bold text-gray-900 flex-1">{section.title}</h2>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                section.isComplete
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-600'
              }`}
            >
              {section.isComplete ? '已完成' : '待填入'}
            </span>
          </div>

          {/* Placeholder when no content */}
          {section.content.length === 0 && (
            <p className="text-sm text-gray-400 italic py-4 text-center border border-dashed border-gray-200 rounded">
              {section.description || '此節尚無內容，請告知 AI Agent 開始撰寫'}
            </p>
          )}

          {/* Blocks */}
          <div>
            {section.content.map(block => (
              <DocumentBlock
                key={block.id}
                block={block}
                onUpdate={updated => onUpdateBlock(section.id, updated)}
                onDelete={() => onDeleteBlock(section.id, block.id)}
                onAiRewrite={prompt => onAiRewrite(section.id, block, prompt)}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Empty state */}
      {doc.sections.length === 0 && (
        <div className="py-24 px-12 text-center text-gray-400">
          <p className="text-lg mb-2">尚無任何段落</p>
          <p className="text-sm">在右側對話框告訴 AI Agent 你需要什麼樣的企劃書，它會自動規劃大綱並撰寫內容。</p>
        </div>
      )}
    </div>
  );
};
