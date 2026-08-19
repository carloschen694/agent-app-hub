import { getApiBaseUrl } from '../../../shared/auth';

export type GoogleServiceKey = 'contacts' | 'calendar' | 'gmail';
export type TokenStatus = 'authorized' | 'needs_renewal' | 'unauthorized';

export interface ServiceAuthInfo {
  status: TokenStatus;
  token: string | null;
  expiresAt: number | null;
}

const SCOPES: Record<GoogleServiceKey, string> = {
  contacts: 'https://www.googleapis.com/auth/contacts',
  calendar: 'https://www.googleapis.com/auth/calendar',
  gmail: 'https://www.googleapis.com/auth/gmail.modify'
};

const STORAGE_KEY = 'class10_google_tokens';

interface TokenRecord {
  token: string;
  expiresAt: number;
}

let memoryStore: Record<string, TokenRecord> = {};

function loadTokens(): Record<string, TokenRecord> {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // fallback
    }
  }
  return memoryStore;
}

function saveTokens(records: Record<string, TokenRecord>): void {
  memoryStore = { ...records };
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch {
      // fallback
    }
  }
}

export function getServiceAuthInfo(service: GoogleServiceKey): ServiceAuthInfo {
  const records = loadTokens();
  const rec = records[service];
  if (!rec || !rec.token) {
    return { status: 'unauthorized', token: null, expiresAt: null };
  }
  if (Date.now() >= rec.expiresAt) {
    return { status: 'needs_renewal', token: rec.token, expiresAt: rec.expiresAt };
  }
  return { status: 'authorized', token: rec.token, expiresAt: rec.expiresAt };
}

export function revokeGoogleScope(service: GoogleServiceKey): void {
  const records = loadTokens();
  delete records[service];
  saveTokens(records);
}

export function setMockTokenForTesting(service: GoogleServiceKey, token: string, expiresAt: number): void {
  const records = loadTokens();
  records[service] = { token, expiresAt };
  saveTokens(records);
}

let cachedClientId: string | null = null;

export async function fetchGoogleClientId(): Promise<string> {
  if (cachedClientId) return cachedClientId;
  if (typeof window === 'undefined') return '';

  const envClientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
  if (typeof envClientId === 'string' && envClientId) {
    cachedClientId = envClientId;
    return envClientId;
  }

  try {
    const apiBase = getApiBaseUrl();
    const res = await fetch(`${apiBase}/api/auth/config`);
    if (res.ok) {
      const data = await res.json();
      if (typeof data.googleClientId === 'string' && data.googleClientId) {
        cachedClientId = data.googleClientId;
        return data.googleClientId;
      }
    }
  } catch (err) {
    console.error('Failed to fetch googleClientId config', err);
  }
  return '';
}

export async function requestGoogleScope(service: GoogleServiceKey, clientId?: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const mainWin = (window.opener as Window) || window.top || window;
  const g = (mainWin as any).google || (window as any).google;

  if (!g?.accounts?.oauth2) {
    console.error('Google Identity Services SDK not loaded');
    if (typeof alert !== 'undefined') {
      alert('Google 授權 SDK (gsi/client) 尚未載入完成，請確認主頁面已載入或重新整理主頁面。');
    }
    return false;
  }

  const effectiveClientId = clientId || (await fetchGoogleClientId()) || '';
  if (!effectiveClientId) {
    console.warn('Google Client ID not configured, cannot initiate OAuth flow.');
    if (typeof alert !== 'undefined') {
      alert('無法觸發授權：尚未取得有效的 Google Client ID。請確認後端服務運作中或設定 VITE_GOOGLE_CLIENT_ID。');
    }
    return false;
  }

  return new Promise((resolve) => {
    const client = g.accounts.oauth2.initTokenClient({
      client_id: effectiveClientId,
      scope: SCOPES[service],
      callback: (response: any) => {
        if (response.access_token) {
          const expiresInMs = (parseInt(response.expires_in, 10) || 3600) * 1000;
          const records = loadTokens();
          records[service] = {
            token: response.access_token,
            expiresAt: Date.now() + expiresInMs
          };
          saveTokens(records);
          resolve(true);
        } else {
          resolve(false);
        }
      },
      error_callback: (err: any) => {
        console.error('GIS token error:', err);
        resolve(false);
      }
    });
    client.requestAccessToken();
  });
}

export async function getValidAccessToken(service: GoogleServiceKey): Promise<string | null> {
  const info = getServiceAuthInfo(service);
  if (info.status === 'authorized') {
    return info.token;
  }
  return null;
}
