import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./AgentLauncher.tsx', import.meta.url), 'utf8');

describe('AgentLauncher Live authentication availability', () => {
  it('requires an explicit Live API key, independent of the standard chat key', () => {
    expect(source).toContain('Boolean(settings.liveApiKey)');
    expect(source).not.toContain('Boolean(settings.apiKey)');
    expect(source).not.toContain('liveAuthMode');
  });
});
