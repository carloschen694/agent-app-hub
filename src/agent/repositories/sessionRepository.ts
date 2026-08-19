import type { Session } from '../types/session';

const SESSIONS_KEY = 'agent_hub_sessions';

export const sessionRepository = {
  getSessions(): Session[] {
    try {
      const stored = localStorage.getItem(SESSIONS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error reading sessions from localStorage', e);
    }
    return [];
  },

  saveSessions(sessions: Session[]): void {
    let currentSessions = [...sessions];
    let attempts = 0;
    while (attempts < 6) {
      try {
        localStorage.setItem(SESSIONS_KEY, JSON.stringify(currentSessions));
        return;
      } catch (e: any) {
        const isQuotaError = 
          e.name === 'QuotaExceededError' || 
          e.code === 22 || 
          e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
          String(e).toLowerCase().includes('quota');
        
        if (isQuotaError) {
          console.warn('localStorage quota exceeded for agent_hub_sessions. Attempting to prune session history...', e);
          attempts++;
          
          if (currentSessions.length > 5) {
            // Keep the most recent sessions
            currentSessions = currentSessions.slice(0, Math.max(5, currentSessions.length - 2));
          } else {
            // For the remaining sessions (except the active one), truncate messages list to the last 10 messages
            let modified = false;
            for (let i = 1; i < currentSessions.length; i++) {
              if (currentSessions[i].messages.length > 10) {
                currentSessions[i] = {
                  ...currentSessions[i],
                  messages: currentSessions[i].messages.slice(-10)
                };
                modified = true;
              }
            }
            
            if (!modified) {
              // As a last resort, clear messages for older sessions completely
              for (let i = 1; i < currentSessions.length; i++) {
                if (currentSessions[i].messages.length > 0) {
                  currentSessions[i] = {
                    ...currentSessions[i],
                    messages: []
                  };
                  modified = true;
                }
              }
              
              if (!modified) {
                // If even the active session is too large, truncate the active session's messages list to the last 20
                if (currentSessions[0] && currentSessions[0].messages.length > 20) {
                  currentSessions[0] = {
                    ...currentSessions[0],
                    messages: currentSessions[0].messages.slice(-20)
                  };
                } else {
                  console.error('Cannot prune sessions any further to fit into localStorage quota.');
                  break;
                }
              }
            }
          }
        } else {
          console.error('Error saving sessions to localStorage', e);
          break;
        }
      }
    }
  },

  getSessionById(id: string): Session | undefined {
    const sessions = this.getSessions();
    return sessions.find(s => s.id === id);
  },

  saveSession(session: Session): void {
    const sessions = this.getSessions();
    const index = sessions.findIndex(s => s.id === session.id);
    const updatedSession = {
      ...session,
      updatedAt: Date.now()
    };
    if (index >= 0) {
      sessions[index] = updatedSession;
    } else {
      sessions.unshift(updatedSession);
    }
    // Maintain chronological order: most recently updated first
    sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    this.saveSessions(sessions);
  },

  deleteSession(id: string): void {
    const sessions = this.getSessions();
    const filtered = sessions.filter(s => s.id !== id);
    this.saveSessions(filtered);
  },

  clearAll(): void {
    localStorage.removeItem(SESSIONS_KEY);
  }
};
