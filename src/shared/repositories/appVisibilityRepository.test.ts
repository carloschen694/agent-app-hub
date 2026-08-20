import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appVisibilityRepository } from './appVisibilityRepository';

describe('appVisibilityRepository', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  });

  it('starts with nothing hidden', () => {
    expect(appVisibilityRepository.getHiddenAppIds()).toEqual([]);
  });

  it('hides and un-hides an app via setAppHidden', () => {
    appVisibilityRepository.setAppHidden('class02-ai-chat-assistant', true);
    expect(appVisibilityRepository.getHiddenAppIds()).toEqual(['class02-ai-chat-assistant']);
    expect(appVisibilityRepository.isHidden('class02-ai-chat-assistant')).toBe(true);

    appVisibilityRepository.setAppHidden('class02-ai-chat-assistant', false);
    expect(appVisibilityRepository.getHiddenAppIds()).toEqual([]);
    expect(appVisibilityRepository.isHidden('class02-ai-chat-assistant')).toBe(false);
  });

  it('never allows dashboard to be hidden, even via setHiddenAppIds', () => {
    appVisibilityRepository.setHiddenAppIds(['dashboard', 'class07-price-comparison']);
    expect(appVisibilityRepository.getHiddenAppIds()).toEqual(['class07-price-comparison']);
    expect(appVisibilityRepository.isHidden('dashboard')).toBe(false);

    appVisibilityRepository.setAppHidden('dashboard', true);
    expect(appVisibilityRepository.isHidden('dashboard')).toBe(false);
  });

  it('de-duplicates ids passed to setHiddenAppIds', () => {
    appVisibilityRepository.setHiddenAppIds(['class09-proposal', 'class09-proposal']);
    expect(appVisibilityRepository.getHiddenAppIds()).toEqual(['class09-proposal']);
  });
});
