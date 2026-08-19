import { useAgent } from './useAgent';

export const useAgentUiState = () => {
  const { uiState, setUiState, toggleOpen } = useAgent();

  return {
    isOpened: uiState.isOpened,
    zoomState: uiState.zoomState,
    isSettingsPanelOpen: uiState.isSettingsPanelOpen,
    isSessionsListOpen: uiState.isSessionsListOpen,
    setUiState,
    toggleOpen
  };
};
