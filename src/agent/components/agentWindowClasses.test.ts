import { describe, expect, it } from 'vitest';
import { getAgentWindowClasses } from './agentWindowClasses';
import type { ZoomState } from '../context/AgentContext';

const NON_FULLSCREEN_STATES: ZoomState[] = ['small', 'large', 'panel', 'drawer'];

describe('getAgentWindowClasses', () => {
  it('gives every mode except fullscreen a mobile bottom sheet, not a hard full-page block', () => {
    for (const zoomState of NON_FULLSCREEN_STATES) {
      const classes = getAgentWindowClasses(zoomState);
      expect(classes).toContain('bottom-0');
      expect(classes).toContain('rounded-t-2xl');
      // The old behavior forced the entire viewport height below `sm:` — that must be gone.
      expect(classes).not.toContain('inset-0 h-[100dvh] w-screen rounded-none border-0');
    }
  });

  it('keeps fullscreen as a true full-page takeover at every width, mobile included', () => {
    const classes = getAgentWindowClasses('fullscreen');
    expect(classes).toContain('fixed inset-0 h-[100dvh] w-screen rounded-none border-0');
  });

  it('docks the panel mode starting at the md: breakpoint', () => {
    expect(getAgentWindowClasses('panel')).toContain('md:fixed md:right-0');
  });

  it('docks small/large modes starting at the xl: breakpoint, floating below that', () => {
    for (const zoomState of ['small', 'large'] as ZoomState[]) {
      const classes = getAgentWindowClasses(zoomState);
      expect(classes).toContain('xl:fixed xl:right-0');
      expect(classes).toContain('sm:inset-auto sm:bottom-6 sm:right-6');
    }
  });

  it('falls back to the small-equivalent layout for an unrecognized zoom state', () => {
    const classes = getAgentWindowClasses('unknown' as ZoomState);
    expect(classes).toContain('xl:fixed xl:right-0');
    expect(classes).not.toContain('inset-0 h-[100dvh] w-screen rounded-none border-0');
  });
});
