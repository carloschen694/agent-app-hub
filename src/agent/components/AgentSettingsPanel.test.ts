import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./AgentSettingsPanel.tsx', import.meta.url), 'utf8');

describe('AgentSettingsPanel Live API key contract', () => {
  it('exposes a single explicit Live chat API key field with no auth-mode switch', () => {
    expect(source).toContain('Live chat API Key');
    expect(source).toContain('liveKeyInput');
    expect(source).not.toContain('Realtime authentication');
    expect(source).not.toContain('liveAuthMode');
  });

  it('rejects the platform virtual key for the Live field before saving', () => {
    expect(source).toMatch(/liveKeyInput.*startsWith\('sk-'\)|trimmedLiveKey.*startsWith\('sk-'\)/s);
    expect(source).toContain('liveKeyError');
  });
});
