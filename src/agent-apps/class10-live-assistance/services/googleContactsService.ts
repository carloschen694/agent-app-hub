import { getServiceAuthInfo, type GoogleServiceKey } from './googleAuthService';
import { showPipContent } from './pipService';
import { buildStandardAuthPromptHtml } from '../prompts/googleAuthPromptTemplates';

export interface ServiceResult<T = any> {
  success: boolean;
  reason?: 'UNAUTHORIZED' | 'TOKEN_EXPIRED' | 'API_ERROR';
  data?: T;
  message?: string;
}

export function handleAuthCheck(service: GoogleServiceKey): ServiceResult | null {
  const info = getServiceAuthInfo(service);
  if (info.status === 'unauthorized') {
    showPipContent({ layout: 'content', html: buildStandardAuthPromptHtml(service, false) });
    return { success: false, reason: 'UNAUTHORIZED', message: `使用者尚未授權 Google ${service} 權限` };
  }
  if (info.status === 'needs_renewal') {
    showPipContent({ layout: 'content', html: buildStandardAuthPromptHtml(service, true) });
    return { success: false, reason: 'TOKEN_EXPIRED', message: `Google ${service} 授權已過期，請一鍵續約` };
  }
  return null;
}

export async function searchContacts(query: string): Promise<ServiceResult> {
  const authErr = handleAuthCheck('contacts');
  if (authErr) return authErr;
  const token = getServiceAuthInfo('contacts').token!;

  try {
    const url = `https://people.googleapis.com/v1/people/me/connections?pageSize=100&personFields=names,emailAddresses,phoneNumbers`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return { success: false, reason: 'API_ERROR', message: `Contacts API error: ${res.status}` };
    const data = await res.json();
    const connections = data.connections || [];
    const filtered = connections.filter((person: any) => {
      const name = person.names?.[0]?.displayName || '';
      const email = person.emailAddresses?.[0]?.value || '';
      return name.toLowerCase().includes(query.toLowerCase()) || email.toLowerCase().includes(query.toLowerCase());
    });
    return { success: true, data: filtered };
  } catch (err: any) {
    return { success: false, reason: 'API_ERROR', message: err.message };
  }
}

export async function createContact(params: { name: string; email?: string; phone?: string; note?: string }): Promise<ServiceResult> {
  const authErr = handleAuthCheck('contacts');
  if (authErr) return authErr;
  const token = getServiceAuthInfo('contacts').token!;

  try {
    const body: any = {
      names: [{ givenName: params.name }],
      ...(params.email ? { emailAddresses: [{ value: params.email }] } : {}),
      ...(params.phone ? { phoneNumbers: [{ value: params.phone }] } : {}),
      ...(params.note ? { biography: { value: params.note } } : {})
    };
    const res = await fetch('https://people.googleapis.com/v1/people:createContact', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) return { success: false, reason: 'API_ERROR', message: `Create contact failed: ${res.status}` };
    const data = await res.json();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, reason: 'API_ERROR', message: err.message };
  }
}

export async function updateContact(resourceName: string, params: { name?: string; email?: string; phone?: string; note?: string }): Promise<ServiceResult> {
  const authErr = handleAuthCheck('contacts');
  if (authErr) return authErr;
  const token = getServiceAuthInfo('contacts').token!;
  try {
    const body: any = {
      etag: '*',
      ...(params.name ? { names: [{ givenName: params.name }] } : {}),
      ...(params.email ? { emailAddresses: [{ value: params.email }] } : {}),
      ...(params.phone ? { phoneNumbers: [{ value: params.phone }] } : {})
    };
    const res = await fetch(`https://people.googleapis.com/v1/${resourceName}:updateContact?updatePersonFields=names,emailAddresses,phoneNumbers`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    return res.ok ? { success: true, data } : { success: false, reason: 'API_ERROR', message: `Update contact failed: ${res.status}` };
  } catch (err: any) {
    return { success: false, reason: 'API_ERROR', message: err.message };
  }
}

export async function deleteContact(resourceName: string): Promise<ServiceResult> {
  const authErr = handleAuthCheck('contacts');
  if (authErr) return authErr;
  const token = getServiceAuthInfo('contacts').token!;
  try {
    const res = await fetch(`https://people.googleapis.com/v1/${resourceName}:deleteContact`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.ok ? { success: true } : { success: false, reason: 'API_ERROR', message: `Delete failed: ${res.status}` };
  } catch (err: any) {
    return { success: false, reason: 'API_ERROR', message: err.message };
  }
}
