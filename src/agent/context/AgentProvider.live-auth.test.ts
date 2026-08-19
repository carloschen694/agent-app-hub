import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./AgentProvider.tsx', import.meta.url), 'utf8');

describe('AgentProvider Live credential boundary', () => {
  it('reads the explicit Live API key setting directly, without any credential acquisition step', () => {
    const start = source.indexOf('await startLiveInteraction({');
    expect(start).toBeGreaterThan(-1);
    const startBlock = source.slice(start, start + 300);
    expect(startBlock).toContain('apiKey: settings.liveApiKey');
    expect(source).not.toContain('acquireLiveCredential');
  });

  it('requires a Live API key before starting a session', () => {
    const functionStart = source.indexOf('const startRealtimeVoice');
    const functionEnd = source.indexOf('const stopRealtimeVoice', functionStart);
    const liveFunction = source.slice(functionStart, functionEnd);
    expect(liveFunction).toContain('!settings.liveApiKey');
  });

  it('guards session start as a singleton operation', () => {
    expect(source).toContain('liveStartInFlightRef.current');
  });
});
