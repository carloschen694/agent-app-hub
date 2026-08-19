import { useAgent } from './useAgent';

export const useAgentSession = () => {
  const {
    sessions,
    currentSession,
    createNewSession,
    switchSession,
    deleteSession,
    renameSession,
    clearAllSessions
  } = useAgent();

  return {
    sessions,
    currentSession,
    createNewSession,
    switchSession,
    deleteSession,
    renameSession,
    clearAllSessions
  };
};
