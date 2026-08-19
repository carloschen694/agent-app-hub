import React from 'react';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'folder_open',
  title,
  description,
  action,
  className = ''
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center text-slate-500 ${className}`}>
      <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">
        {icon}
      </span>
      <h3 className="text-base font-semibold text-slate-700 mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-400 max-w-sm mb-4">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  );
};
