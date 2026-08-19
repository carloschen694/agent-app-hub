import { describe, expect, it } from 'vitest';
import { sidebarToggleButtonState, sidebarToggleTarget } from './CollapsibleSidebar';

describe('sidebarToggleTarget', () => {
  it('toggles the desktop collapsed-width state on desktop', () => {
    expect(sidebarToggleTarget(true)).toBe('collapsed');
  });

  it('toggles the mobile drawer-open state below the desktop breakpoint', () => {
    expect(sidebarToggleTarget(false)).toBe('mobileOpen');
  });
});

describe('sidebarToggleButtonState', () => {
  it('on desktop, reflects whether the sidebar is collapsed', () => {
    expect(sidebarToggleButtonState(true, true, false)).toBe(true);
    expect(sidebarToggleButtonState(true, false, false)).toBe(false);
  });

  it('on mobile, reflects whether the drawer is closed, independent of the desktop collapsed flag', () => {
    expect(sidebarToggleButtonState(false, false, false)).toBe(true);
    expect(sidebarToggleButtonState(false, true, true)).toBe(false);
  });
});
