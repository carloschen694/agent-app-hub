import { useAgent } from './useAgent';

export const useAgentTools = () => {
  const {
    activeTools,
    setActiveTools,
    registerToolHandlers,
    toolHandlers,
    runtimeContext,
    setRuntimeContext,
    setActiveAppId,
    setActiveAppManifest,
    setActiveSystemPrompt
  } = useAgent();

  return {
    activeTools,
    setActiveTools,
    registerToolHandlers,
    toolHandlers,
    runtimeContext,
    setRuntimeContext,
    setActiveAppId,
    setActiveAppManifest,
    setActiveSystemPrompt
  };
};
