import React, { useState } from 'react';
import type { AgentTaskPlan, AgentTaskStatus } from '../types/task';

interface AgentTaskListProps {
  plan: AgentTaskPlan;
}

const STATUS_ICON: Record<AgentTaskStatus, { icon: string; className: string }> = {
  pending: { icon: 'radio_button_unchecked', className: 'text-slate-300' },
  running: { icon: 'progress_activity', className: 'animate-spin text-blue-600' },
  done: { icon: 'check_circle', className: 'text-emerald-600' },
  failed: { icon: 'error', className: 'text-red-500' }
};

export const AgentTaskList: React.FC<AgentTaskListProps> = ({ plan }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const finishedCount = plan.tasks.filter(
    task => task.status === 'done' || task.status === 'failed'
  ).length;
  const progressPercent =
    plan.tasks.length > 0 ? Math.round((finishedCount / plan.tasks.length) * 100) : 0;

  const planStatusLabel =
    plan.status === 'running'
      ? '執行子任務中'
      : plan.status === 'aggregating'
        ? '彙整結果中'
        : plan.status === 'completed'
          ? '已完成'
          : '部分失敗';

  return (
    <div className="border-t border-slate-200 bg-slate-50/90 px-3 py-2 text-[11px] text-slate-600">
      <button
        type="button"
        onClick={() => setIsCollapsed(prev => !prev)}
        className="flex w-full items-center justify-between gap-2 text-left"
        title={isCollapsed ? '展開任務清單' : '收合任務清單'}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="material-symbols-outlined text-sm text-slate-500">checklist</span>
          <span className="font-semibold text-slate-700">長任務計畫</span>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
              plan.status === 'completed'
                ? 'bg-emerald-50 text-emerald-700'
                : plan.status === 'failed'
                  ? 'bg-red-50 text-red-600'
                  : 'bg-blue-50 text-blue-700'
            }`}
          >
            {planStatusLabel}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="tabular-nums text-slate-400">
            {finishedCount}/{plan.tasks.length}
          </span>
          <span className="material-symbols-outlined text-base text-slate-400">
            {isCollapsed ? 'expand_more' : 'expand_less'}
          </span>
        </div>
      </button>

      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            plan.status === 'failed' ? 'bg-red-400' : 'bg-blue-500'
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {!isCollapsed && (
      <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto pr-1">
        {plan.tasks.map((task, index) => {
          const statusIcon = STATUS_ICON[task.status];
          return (
            <li key={task.id} className="flex items-start gap-1.5">
              <span
                className={`material-symbols-outlined mt-px text-[14px] ${statusIcon.className}`}
              >
                {statusIcon.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div
                  className={`truncate ${
                    task.status === 'running'
                      ? 'font-semibold text-slate-800'
                      : task.status === 'pending'
                        ? 'text-slate-400'
                        : 'text-slate-600'
                  }`}
                >
                  {index + 1}. {task.title}
                </div>
                {task.resultSummary && task.status !== 'running' && (
                  <div className="truncate text-[10px] text-slate-400">{task.resultSummary}</div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      )}
    </div>
  );
};
