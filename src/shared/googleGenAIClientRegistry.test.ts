import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearStandardGoogleGenAI, getStandardGoogleGenAI } from './googleGenAIClientRegistry';

describe('standard GoogleGenAI client registry', () => {
  beforeEach(() => clearStandardGoogleGenAI());

  it('reuses the standard client for one credential identity', () => {
    const GoogleGenAICtor = createConstructor();
    const first = getStandardGoogleGenAI({
      apiKey: 'sk-a',
      baseUrl: 'https://hub',
      apiVersion: 'v1beta',
      GoogleGenAICtor,
    });
    const second = getStandardGoogleGenAI({
      apiKey: 'sk-a',
      baseUrl: 'https://hub',
      apiVersion: 'v1beta',
      GoogleGenAICtor,
    });
    expect(second).toBe(first);
    expect(GoogleGenAICtor).toHaveBeenCalledTimes(1);
  });

  it('replaces the single entry when key, base URL, or API version changes', () => {
    const GoogleGenAICtor = createConstructor();
    const base = { apiKey: 'sk-a', baseUrl: 'https://hub', apiVersion: 'v1beta', GoogleGenAICtor };
    const clients = [
      getStandardGoogleGenAI(base),
      getStandardGoogleGenAI({ ...base, apiKey: 'sk-b' }),
      getStandardGoogleGenAI({ ...base, apiKey: 'sk-b', baseUrl: 'https://other' }),
      getStandardGoogleGenAI({ ...base, apiKey: 'sk-b', baseUrl: 'https://other', apiVersion: 'v1alpha' }),
    ];
    expect(new Set(clients).size).toBe(4);
    expect(GoogleGenAICtor).toHaveBeenCalledTimes(4);
  });

  it('passes only configured HTTP options to the SDK', () => {
    const GoogleGenAICtor = createConstructor();
    getStandardGoogleGenAI({ apiKey: 'real-key', GoogleGenAICtor });
    getStandardGoogleGenAI({ apiKey: 'sk-key', baseUrl: 'https://hub', GoogleGenAICtor });
    expect(GoogleGenAICtor).toHaveBeenNthCalledWith(1, { apiKey: 'real-key' });
    expect(GoogleGenAICtor).toHaveBeenNthCalledWith(2, {
      apiKey: 'sk-key',
      httpOptions: { baseUrl: 'https://hub' },
    });
  });
});

function createConstructor() {
  return vi.fn(function FakeGoogleGenAI(this: any, options: unknown) {
    this.options = options;
  }) as any;
}
