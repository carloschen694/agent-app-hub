import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchContacts } from './googleContactsService';
import { createCalendarEvent } from './googleCalendarService';
import { sendEmail } from './googleGmailService';
import { setMockTokenForTesting, revokeGoogleScope } from './googleAuthService';

describe('Google API Services', () => {
  beforeEach(() => {
    revokeGoogleScope('contacts');
    revokeGoogleScope('calendar');
    revokeGoogleScope('gmail');
    vi.restoreAllMocks();
  });

  it('returns UNAUTHORIZED when no token is present', async () => {
    const res = await searchContacts('test');
    expect(res.success).toBe(false);
    expect(res.reason).toBe('UNAUTHORIZED');
  });

  it('returns TOKEN_EXPIRED when token is expired', async () => {
    setMockTokenForTesting('contacts', 'expired_token', Date.now() - 1000);
    const res = await searchContacts('test');
    expect(res.success).toBe(false);
    expect(res.reason).toBe('TOKEN_EXPIRED');
  });

  it('calls People API fetch with bearer token when authorized', async () => {
    setMockTokenForTesting('contacts', 'valid_token_abc', Date.now() + 3600000);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        connections: [
          { names: [{ displayName: 'John Doe' }], emailAddresses: [{ value: 'john@example.com' }] }
        ]
      })
    } as any);

    const res = await searchContacts('John');
    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('people.googleapis.com'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer valid_token_abc' })
      })
    );
  });

  it('creates calendar event when authorized', async () => {
    setMockTokenForTesting('calendar', 'cal_token_123', Date.now() + 3600000);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'evt_999', summary: 'Team Sync' })
    } as any);

    const res = await createCalendarEvent({
      summary: 'Team Sync',
      startDateTime: '2026-08-13T10:00:00Z',
      endDateTime: '2026-08-13T11:00:00Z'
    });
    expect(res.success).toBe(true);
    expect(res.data.id).toBe('evt_999');
  });

  it('sends email when authorized', async () => {
    setMockTokenForTesting('gmail', 'gmail_token_123', Date.now() + 3600000);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'msg_001' })
    } as any);

    const res = await sendEmail({
      to: 'recipient@example.com',
      subject: 'Hello',
      body: 'Test body'
    });
    expect(res.success).toBe(true);
    expect(res.data.id).toBe('msg_001');
  });
});
