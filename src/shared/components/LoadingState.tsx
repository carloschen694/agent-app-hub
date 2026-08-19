import React from 'react';

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ message = '載入中...', className = '' }) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-slate-500 ${className}`}>
      <span className="material-symbols-outlined animate-spin text-3xl text-blue-600 mb-2">
        sync
      </span>
      <p className="text-sm">{message}</p>
    </div>
  );
};
