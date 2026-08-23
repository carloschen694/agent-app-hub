export interface AgentSettings {
  apiKey: string;
  model: string;
  /** The Gemini API key used to start a realtime voice session. */
  liveApiKey: string;
  liveModel: string;
  liveVoice: string;
  imageModel: string;
  systemPrompt: string;
  /**
   * Deprecated: Google Search is always enabled by the Gemini service.
   * Kept only so old localStorage payloads can be read without breaking.
   */
  webSearch?: boolean;
}

const SETTINGS_KEY = 'agent_hub_settings';

const DEFAULT_SETTINGS: AgentSettings = {
  apiKey: '',
  model: 'gemini-3.6-flash',
  liveApiKey: '',
  liveModel: 'gemini-3.1-flash-live-preview',
  liveVoice: 'Puck',
  imageModel: 'gemini-3.1-flash-image',
  systemPrompt: 'You are a helpful assistant. Provide detailed and accurate responses.',
  webSearch: true
};

export const settingsRepository = {
  getSettings(): AgentSettings {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (e) {
      console.error('Error reading settings from localStorage', e);
    }
    // Also try reading from environment variables
    const envApiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
    if (envApiKey) {
      return { ...DEFAULT_SETTINGS, apiKey: envApiKey };
    }
    return DEFAULT_SETTINGS;
  },

  saveSettings(settings: AgentSettings): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Error saving settings to localStorage', e);
    }
  },

  clearSettings(): void {
    localStorage.removeItem(SETTINGS_KEY);
  }
};
