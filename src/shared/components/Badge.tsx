import React from 'react';

const toneClasses: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-600 border-blue-100',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  orange: 'bg-orange-50 text-orange-700 border-orange-100',
  gray: 'bg-slate-50 text-slate-600 border-slate-200',
};

export const Badge: React.FC<{ tone?: keyof typeof toneClasses; children: React.ReactNode }> = ({
  tone = 'gray',
  children,
}) => (
  <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium ${toneClasses[tone]}`}>
    {children}
  </span>
);
