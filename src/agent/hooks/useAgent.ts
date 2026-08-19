import { useContext } from 'react';
import { AgentContext } from '../context/AgentContext';

export const useAgent = () => {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error('useAgent must be used within an AgentProvider');
  }
  return context;
};
