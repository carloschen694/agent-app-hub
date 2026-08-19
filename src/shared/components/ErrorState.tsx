import React from 'react';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = '發生錯誤',
  message,
  onRetry,
  className = ''
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center ${className}`}>
      <span className="material-symbols-outlined text-4xl text-red-500 mb-2">
        error
      </span>
      <h3 className="text-base font-semibold text-slate-800 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 max-w-md mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="bg-red-100 hover:bg-red-200 text-red-700 font-medium rounded px-4 py-2 text-sm transition-all"
        >
          重試
        </button>
      )}
    </div>
  );
};
