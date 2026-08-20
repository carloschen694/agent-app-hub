const STORAGE_KEY = 'agent_hub_hidden_apps';

/** Fired whenever the hidden-app list changes, so open tabs/components can re-read it. */
export const APP_VISIBILITY_CHANGE_EVENT = 'app-visibility-change';

/** The shell's own home view can never be hidden — there would be no way back in. */
const ALWAYS_VISIBLE_APP_ID = 'dashboard';

function readHiddenIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string' && id !== ALWAYS_VISIBLE_APP_ID);
  } catch (e) {
    console.error('Error reading app visibility settings from localStorage', e);
    return [];
  }
}

export const appVisibilityRepository = {
  getHiddenAppIds(): string[] {
    return readHiddenIds();
  },

  isHidden(appId: string): boolean {
    if (appId === ALWAYS_VISIBLE_APP_ID) return false;
    return readHiddenIds().includes(appId);
  },

  setHiddenAppIds(appIds: string[]): void {
    const sanitized = Array.from(new Set(appIds.filter((id) => id !== ALWAYS_VISIBLE_APP_ID)));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    } catch (e) {
      console.error('Error saving app visibility settings to localStorage', e);
    }
    window.dispatchEvent(new Event(APP_VISIBILITY_CHANGE_EVENT));
  },

  setAppHidden(appId: string, hidden: boolean): void {
    const current = new Set(readHiddenIds());
    if (hidden) {
      current.add(appId);
    } else {
      current.delete(appId);
    }
    appVisibilityRepository.setHiddenAppIds(Array.from(current));
  }
};
