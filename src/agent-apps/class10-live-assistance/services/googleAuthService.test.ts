import { describe, it, expect, beforeEach } from 'vitest';
import {
  getServiceAuthInfo,
  revokeGoogleScope,
  setMockTokenForTesting,
  getValidAccessToken
} from './googleAuthService';

describe('googleAuthService', () => {
  beforeEach(() => {
    revokeGoogleScope('contacts');
    revokeGoogleScope('calendar');
    revokeGoogleScope('gmail');
  });

  it('returns unauthorized status initially', () => {
    const info = getServiceAuthInfo('contacts');
    expect(info.status).toBe('unauthorized');
    expect(info.token).toBeNull();
  });

  it('returns authorized status when token is valid', () => {
    const futureTime = Date.now() + 3600 * 1000;
    setMockTokenForTesting('contacts', 'valid_token_123', futureTime);
    const info = getServiceAuthInfo('contacts');
    expect(info.status).toBe('authorized');
    expect(info.token).toBe('valid_token_123');
  });

  it('returns needs_renewal when token is expired', () => {
    const pastTime = Date.now() - 1000;
    setMockTokenForTesting('calendar', 'expired_token_123', pastTime);
    const info = getServiceAuthInfo('calendar');
    expect(info.status).toBe('needs_renewal');
  });

  it('returns valid token only when authorized', async () => {
    const futureTime = Date.now() + 3600 * 1000;
    setMockTokenForTesting('gmail', 'gmail_token_xyz', futureTime);
    const token = await getValidAccessToken('gmail');
    expect(token).toBe('gmail_token_xyz');

    const unauthorizedToken = await getValidAccessToken('contacts');
    expect(unauthorizedToken).toBeNull();
  });
});
