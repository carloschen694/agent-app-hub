import { describe, expect, it } from 'vitest';
import { isFullPageRoute } from './fullPageRoute';
import type { AgentAppManifest } from '../agent/types/agent';

const fakeApp = (route: string, fullPage?: boolean): AgentAppManifest =>
  ({ route, fullPage }) as AgentAppManifest;

describe('isFullPageRoute', () => {
  it('is true for a route whose manifest opts into fullPage', () => {
    const registry = [fakeApp('/live-board', true), fakeApp('/class08-data-analysis')];
    expect(isFullPageRoute('/live-board', registry)).toBe(true);
  });

  it('is false for a registered route that does not opt in', () => {
    const registry = [fakeApp('/live-board', true), fakeApp('/class08-data-analysis')];
    expect(isFullPageRoute('/class08-data-analysis', registry)).toBe(false);
  });

  it('is false for a path with no matching manifest', () => {
    const registry = [fakeApp('/live-board', true)];
    expect(isFullPageRoute('/does-not-exist', registry)).toBe(false);
  });
});
