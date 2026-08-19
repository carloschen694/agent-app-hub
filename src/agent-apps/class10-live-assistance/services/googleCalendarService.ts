import { getServiceAuthInfo } from './googleAuthService';
import { handleAuthCheck, type ServiceResult } from './googleContactsService';

export async function listCalendarEvents(params: { timeMin?: string; timeMax?: string; maxResults?: number } = {}): Promise<ServiceResult> {
  const authErr = handleAuthCheck('calendar');
  if (authErr) return authErr;
  const token = getServiceAuthInfo('calendar').token!;
  try {
    const timeMinParam = params.timeMin || new Date().toISOString();
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMinParam)}&singleEvents=true&orderBy=startTime&maxResults=${params.maxResults || 25}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return { success: false, reason: 'API_ERROR', message: `Calendar API error: ${res.status}` };
    const data = await res.json();
    return { success: true, data: data.items || [] };
  } catch (err: any) {
    return { success: false, reason: 'API_ERROR', message: err.message };
  }
}

export async function createCalendarEvent(params: { summary: string; description?: string; startDateTime: string; endDateTime: string; location?: string }): Promise<ServiceResult> {
  const authErr = handleAuthCheck('calendar');
  if (authErr) return authErr;
  const token = getServiceAuthInfo('calendar').token!;
  try {
    const body = {
      summary: params.summary,
      description: params.description,
      location: params.location,
      start: { dateTime: params.startDateTime },
      end: { dateTime: params.endDateTime }
    };
    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    return res.ok ? { success: true, data } : { success: false, reason: 'API_ERROR', message: `Create event failed: ${res.status}` };
  } catch (err: any) {
    return { success: false, reason: 'API_ERROR', message: err.message };
  }
}

export async function updateCalendarEvent(eventId: string, params: { summary?: string; description?: string; startDateTime?: string; endDateTime?: string; location?: string }): Promise<ServiceResult> {
  const authErr = handleAuthCheck('calendar');
  if (authErr) return authErr;
  const token = getServiceAuthInfo('calendar').token!;
  try {
    const body: any = {};
    if (params.summary) body.summary = params.summary;
    if (params.description) body.description = params.description;
    if (params.location) body.location = params.location;
    if (params.startDateTime) body.start = { dateTime: params.startDateTime };
    if (params.endDateTime) body.end = { dateTime: params.endDateTime };
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    return res.ok ? { success: true, data } : { success: false, reason: 'API_ERROR', message: `Update event failed: ${res.status}` };
  } catch (err: any) {
    return { success: false, reason: 'API_ERROR', message: err.message };
  }
}

export async function deleteCalendarEvent(eventId: string): Promise<ServiceResult> {
  const authErr = handleAuthCheck('calendar');
  if (authErr) return authErr;
  const token = getServiceAuthInfo('calendar').token!;
  try {
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.ok ? { success: true } : { success: false, reason: 'API_ERROR', message: `Delete event failed: ${res.status}` };
  } catch (err: any) {
    return { success: false, reason: 'API_ERROR', message: err.message };
  }
}
