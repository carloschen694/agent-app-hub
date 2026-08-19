import React from 'react';
import type { FollowupButton } from '../types/message';

interface AgentFollowupButtonsProps {
  buttons: FollowupButton[];
  onButtonClick: (actionText: string) => void;
}

export const AgentFollowupButtons: React.FC<AgentFollowupButtonsProps> = ({ buttons, onButtonClick }) => {
  if (!buttons || buttons.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2 px-1">
      {buttons.map((btn, index) => (
        <button
          key={index}
          onClick={() => onButtonClick(btn.action)}
          className="bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 text-xs rounded px-2.5 py-1 transition-all duration-200 shadow-sm cursor-pointer active:bg-orange-200 font-medium"
        >
          {btn.label}
        </button>
      ))}
    </div>
  );
};
