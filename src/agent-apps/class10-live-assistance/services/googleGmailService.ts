import { getServiceAuthInfo } from './googleAuthService';
import { handleAuthCheck, type ServiceResult } from './googleContactsService';

async function fetchMessageDetail(id: string, token: string) {
  try {
    const url = `https://www.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const data = await res.json();
    const headers = data.payload?.headers || [];
    const subject = headers.find((h: any) => h.name?.toLowerCase() === 'subject')?.value || '';
    const from = headers.find((h: any) => h.name?.toLowerCase() === 'from')?.value || '';
    const date = headers.find((h: any) => h.name?.toLowerCase() === 'date')?.value || '';
    return {
      id: data.id,
      threadId: data.threadId,
      snippet: data.snippet || '',
      subject,
      from,
      date
    };
  } catch {
    return null;
  }
}

export async function listRecentEmails(params: { maxResults?: number; q?: string } = {}): Promise<ServiceResult> {
  const authErr = handleAuthCheck('gmail');
  if (authErr) return authErr;
  const token = getServiceAuthInfo('gmail').token!;
  try {
    const query = params.q ? `&q=${encodeURIComponent(params.q)}` : '';
    const maxResults = params.maxResults || 10;
    const url = `https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}${query}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return { success: false, reason: 'API_ERROR', message: `Gmail API error: ${res.status}` };
    const data = await res.json();
    const rawList = data.messages || [];
    const details = await Promise.all(
      rawList.slice(0, maxResults).map((msg: any) => fetchMessageDetail(msg.id, token))
    );
    return { success: true, data: details.filter(Boolean) };
  } catch (err: any) {
    return { success: false, reason: 'API_ERROR', message: err.message };
  }
}

export async function sendEmail(params: { to: string; subject: string; body: string }): Promise<ServiceResult> {
  const authErr = handleAuthCheck('gmail');
  if (authErr) return authErr;
  const token = getServiceAuthInfo('gmail').token!;
  try {
    const emailText = [`To: ${params.to}`, `Subject: ${params.subject}`, 'Content-Type: text/plain; charset=utf-8', '', params.body].join('\r\n');
    const encodedEmail = btoa(unescape(encodeURIComponent(emailText))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const res = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: encodedEmail })
    });
    const data = await res.json();
    return res.ok ? { success: true, data } : { success: false, reason: 'API_ERROR', message: `Send email failed: ${res.status}` };
  } catch (err: any) {
    return { success: false, reason: 'API_ERROR', message: err.message };
  }
}
