import React from 'react';
import type { CardWidgetProps } from '../../agent/types/agent';
import { Card } from '../../shared/components/Card';
import { Button } from '../../shared/components/Button';

export const PriceComparisonCard: React.FC<CardWidgetProps> = ({ manifest, onOpen }) => {
  return (
    <Card
      className="flex flex-col h-[220px] justify-between hover:-translate-y-1 hover:border-blue-500/50 hover:shadow-lg transition-all duration-300 border border-slate-200/80 bg-white rounded-xl p-5"
    >
      <div className="space-y-3">
        {/* Icon and Name Row */}
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-600 shrink-0">
              <span className="material-symbols-outlined text-lg font-semibold">compare_arrows</span>
            </div>
            <h3 className="text-sm font-bold text-gray-800 line-clamp-1">
              {manifest.agentAppName}
            </h3>
          </div>
          <span className="text-[9px] text-orange-650 font-semibold bg-orange-50 px-2 py-0.5 rounded border border-orange-100/50 shrink-0 uppercase tracking-wider">
            官方精選
          </span>
        </div>

        {/* Course ID Badge */}
        <div>
          <div className="inline-flex items-center rounded-md bg-blue-50/80 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-100/50 uppercase tracking-wider">
            {manifest.courseId || 'course07'}
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">
          {manifest.description}
        </p>
      </div>
      
      {/* Action Row */}
      <div className="flex justify-between items-center pt-3 mt-auto border-t border-slate-50">
        <span className="text-[9px] text-slate-400 font-medium">版本: v1.0.0</span>
        <Button
          size="sm"
          onClick={onOpen}
          className="flex items-center gap-1 text-xs font-semibold cursor-pointer"
        >
          <span>開始比價</span>
          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
        </Button>
      </div>
    </Card>
  );
};
