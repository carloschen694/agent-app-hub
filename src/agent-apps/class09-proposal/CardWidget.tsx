import React from 'react';
import type { CardWidgetProps } from '../../agent/types/agent';
import { Card } from '../../shared/components/Card';
import { Button } from '../../shared/components/Button';

export const ProposalCard: React.FC<CardWidgetProps> = ({ manifest, onOpen }) => {
  return (
    <Card
      className="flex flex-col h-[220px] justify-between hover:-translate-y-1 hover:border-blue-500/50 hover:shadow-lg transition-all duration-300 border border-slate-200/80 bg-white rounded-xl p-5 cursor-pointer"
      onClick={onOpen}
    >
      <div className="space-y-3 min-h-0 flex-1">
        {/* Icon and Name Row */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-xl shrink-0">
            <span>📋</span>
          </div>
          <h3 className="text-sm font-bold text-gray-800 line-clamp-1">
            {manifest.agentAppName}
          </h3>
        </div>

        {/* Course ID Badge */}
        <div>
          <div className="inline-flex items-center rounded-md bg-blue-50/80 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-100/50 uppercase tracking-wider">
            {manifest.courseId || 'course09'}
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
          {manifest.description}
        </p>

        {/* Example Questions (Custom Element) */}
        {manifest.exampleQuestions && manifest.exampleQuestions.length > 0 && (
          <div className="text-[10px] text-slate-400 truncate italic">
            💡 {manifest.exampleQuestions[0]}
          </div>
        )}
      </div>

      {/* Action Row */}
      <div className="flex justify-end pt-2 mt-auto border-t border-slate-50">
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation(); // Avoid double open since wrapper has onClick
            onOpen();
          }}
          className="flex items-center gap-1 text-xs font-semibold cursor-pointer"
        >
          <span>啟動應用</span>
          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
        </Button>
      </div>
    </Card>
  );
};
