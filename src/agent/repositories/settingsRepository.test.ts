import { beforeEach, describe, expect, it, vi } from 'vitest';
import { settingsRepository } from './settingsRepository';

describe('settingsRepository Live API key', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
  });

  it('defaults the Live API key to empty without copying the chat key', () => {
    localStorage.setItem('agent_hub_settings', JSON.stringify({ apiKey: 'sk-chat-key' }));
    expect(settingsRepository.getSettings()).toMatchObject({
      apiKey: 'sk-chat-key',
      liveApiKey: '',
    });
  });

  it('retains an explicitly saved Live API key', () => {
    localStorage.setItem('agent_hub_settings', JSON.stringify({
      apiKey: 'sk-chat-key',
      liveApiKey: 'AIzaSy-live-key',
    }));
    expect(settingsRepository.getSettings()).toMatchObject({
      liveApiKey: 'AIzaSy-live-key',
    });
  });
});
