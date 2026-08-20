import { useEffect, useState } from 'react';
import { appVisibilityRepository, APP_VISIBILITY_CHANGE_EVENT } from '../repositories/appVisibilityRepository';

/** Reactive read of the hidden-app-id set, kept in sync across the settings page, Navigation, and Dashboard. */
export function useHiddenAppIds(): Set<string> {
  const [hiddenAppIds, setHiddenAppIds] = useState<Set<string>>(
    () => new Set(appVisibilityRepository.getHiddenAppIds())
  );

  useEffect(() => {
    const sync = () => setHiddenAppIds(new Set(appVisibilityRepository.getHiddenAppIds()));
    window.addEventListener(APP_VISIBILITY_CHANGE_EVENT, sync);
    // Also react to changes made in another browser tab.
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(APP_VISIBILITY_CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return hiddenAppIds;
}
