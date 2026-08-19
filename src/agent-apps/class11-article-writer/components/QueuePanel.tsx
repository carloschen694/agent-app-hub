import React from 'react';
import type { QueueItem } from '../types';

interface QueuePanelProps {
  queue: QueueItem[];
  onCancelTask: (id: string) => void;
  onRetryTask?: (id: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const QueuePanel: React.FC<QueuePanelProps> = ({
  queue,
  onCancelTask,
  onRetryTask,
  isOpen,
  onToggle,
}) => {
  if (!isOpen) return null;
  const activeCount = queue.filter(item => item.status === 'pending' || item.status === 'processing').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">
              {activeCount > 0 ? 'sync' : 'done_all'}
            </span>
            <span className="font-bold text-slate-800 text-sm">
              生成任務佇列 ({activeCount} 個執行中/待處理)
            </span>
          </div>
          <button 
            onClick={onToggle}
            className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-white rounded-b-2xl">
          {queue.length === 0 ? (
            <div className="text-center text-slate-400 text-xs py-16 flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-4xl text-slate-300">
                hourglass_empty
              </span>
              目前沒有任何生成任務。
            </div>
          ) : (
            queue.map((item) => {
              const getStatusBadge = () => {
                switch (item.status) {
                  case 'processing':
                    return <span className="text-[10px] bg-orange-50 text-orange-600 border border-orange-100 px-1.5 py-0.5 rounded flex items-center gap-0.5"><span className="animate-spin text-[8px] material-symbols-outlined">sync</span>生成中</span>;
                  case 'pending':
                    return <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded">排隊中</span>;
                  case 'completed':
                    return <span className="text-[10px] bg-green-50 text-green-600 border border-green-100 px-1.5 py-0.5 rounded flex items-center gap-0.5"><span className="text-[8px] material-symbols-outlined">done</span>已完成</span>;
                  case 'failed':
                    return <span className="text-[10px] bg-red-50 text-red-600 border border-red-100 px-1.5 py-0.5 rounded flex items-center gap-0.5"><span className="text-[8px] material-symbols-outlined">error</span>失敗</span>;
                  default:
                    return null;
                }
              };

              return (
                <div 
                  key={item.id} 
                  className={`p-3.5 border rounded-xl transition-colors flex flex-col gap-2 ${
                    item.status === 'processing' ? 'border-orange-200 bg-orange-50/10' : 'border-slate-100 bg-white shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-slate-500 text-base">
                        {item.type === 'video' ? 'movie' : 'image'}
                      </span>
                      <span className="text-xs font-semibold text-slate-700 truncate max-w-[200px]">
                        {item.type === 'video' ? '短影片生成' : '插圖封面生成'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {getStatusBadge()}
                      {(item.status === 'pending' || item.status === 'processing') && (
                        <button
                          onClick={() => onCancelTask(item.id)}
                          className="text-slate-400 hover:text-red-500 hover:bg-slate-50 p-1 rounded transition-colors"
                          title="停止任務"
                        >
                          <span className="material-symbols-outlined text-xs font-bold">close</span>
                        </button>
                      )}
                      {(item.status === 'failed' || item.status === 'completed') && onRetryTask && (
                        <button
                          onClick={() => onRetryTask(item.id)}
                          className="text-slate-400 hover:text-blue-500 hover:bg-slate-50 p-1 rounded transition-colors"
                          title="重新生成"
                        >
                          <span className="material-symbols-outlined text-xs font-bold">refresh</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-slate-500 text-[11px] line-clamp-2 leading-relaxed">
                    {item.prompt}
                  </p>

                  {item.status === 'processing' && (
                    <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                      <div 
                        className="bg-orange-500 h-1.5 rounded-full transition-all duration-300 animate-pulse" 
                        style={{ width: `${item.progress ?? 30}%` }}
                      ></div>
                    </div>
                  )}

                  {item.error && (
                    <p className="text-red-500 text-[10px] mt-0.5 bg-red-50 p-1.5 rounded border border-red-100 leading-normal">
                      錯誤: {item.error}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
