import React from 'react';
import type { ProposalSection } from '../types';

interface Props {
  sections: ProposalSection[];
}

export const TableOfContents: React.FC<Props> = ({ sections }) => {
  if (sections.length === 0) return null;

  const scrollTo = (sectionId: string) => {
    document.getElementById(`sec-${sectionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="py-10 px-12 border-b border-gray-200">
      <h2 className="text-xl font-bold text-gray-800 mb-6 tracking-wide">目　錄</h2>
      <ol className="space-y-2">
        {sections.map((section, index) => (
          <li key={section.id} className="flex items-baseline gap-2">
            <span className="text-gray-400 text-sm w-6 shrink-0">{index + 1}.</span>
            <button
              onClick={() => scrollTo(section.id)}
              className="flex-1 text-left text-gray-700 hover:text-blue-600 transition-colors text-sm leading-relaxed"
            >
              {section.title}
            </button>
            <span className="shrink-0 text-gray-300 text-xs">
              {section.isComplete ? '✓' : '○'}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
};
