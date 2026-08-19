import { useAgent } from './useAgent';

export const useAgentChat = () => {
  const { currentSession, sendMessageText, uiState } = useAgent();
  
  return {
    messages: currentSession?.messages || [],
    sendMessage: sendMessageText,
    isLoading: uiState.isLoading
  };
};
