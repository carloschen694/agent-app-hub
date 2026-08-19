import { describe, expect, it } from 'vitest';
import { visibleNavigationApps } from './Navigation';

describe('visibleNavigationApps', () => {
  it('never includes the dashboard (shell home) — it has its own dedicated link', () => {
    const ids = visibleNavigationApps().map((app) => app.agentAppId);
    expect(ids).not.toContain('dashboard');
  });

  it('shows every other registered app', () => {
    const ids = visibleNavigationApps().map((app) => app.agentAppId);
    expect(ids).toContain('class08-data-analysis');
  });
});
