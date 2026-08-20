import { describe, expect, it } from 'vitest';
import { visibleNavigationApps } from './Navigation';

describe('visibleNavigationApps', () => {
  it('never includes the dashboard (shell home) — it has its own dedicated link', () => {
    const ids = visibleNavigationApps().map((app) => app.agentAppId);
    expect(ids).not.toContain('dashboard');
  });

  it('shows every other registered app when nothing is hidden', () => {
    const ids = visibleNavigationApps().map((app) => app.agentAppId);
    expect(ids).toContain('class08-data-analysis');
  });

  it('excludes apps in the hidden-id set', () => {
    const ids = visibleNavigationApps(new Set(['class08-data-analysis'])).map((app) => app.agentAppId);
    expect(ids).not.toContain('class08-data-analysis');
    expect(ids).toContain('class07-price-comparison');
  });

  it('ignores "dashboard" in the hidden-id set — it is filtered out unconditionally regardless', () => {
    const ids = visibleNavigationApps(new Set(['dashboard'])).map((app) => app.agentAppId);
    expect(ids).not.toContain('dashboard');
  });
});
