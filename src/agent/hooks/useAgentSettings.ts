import { useAgent } from './useAgent';

export const useAgentSettings = () => {
  const { settings, updateSettings, resetAllSettings } = useAgent();

  return {
    apiKey: settings.apiKey,
    model: settings.model,
    liveApiKey: settings.liveApiKey,
    liveModel: settings.liveModel,
    liveVoice: settings.liveVoice,
    imageModel: settings.imageModel,
    systemPrompt: settings.systemPrompt,
    updateSettings,
    resetAllSettings
  };
};
