import type { ZoomState } from '../context/AgentContext';

// Below `sm:` (640px) every zoom mode used to fall back to a hard full-screen block
// (`inset-0 h-[100dvh]`), including the mode literally named "drawer" — so on an actual
// phone there was never a way to see the agent-app page and the chat at once. A bottom
// sheet that leaves a sliver of the page visible above it reads as an overlay you can
// dismiss, not a full-page takeover, and costs nothing on larger screens since every
// `sm:`/`md:`/`xl:` variant below already overrides it.
const mobileSheet =
  'fixed inset-x-0 bottom-0 top-auto h-[88dvh] w-full rounded-t-2xl border-x-0 border-b-0';

export function getAgentWindowClasses(zoomState: ZoomState): string {
  const docked =
    'xl:fixed xl:right-0 xl:top-14 xl:bottom-0 xl:h-[calc(100vh-56px)] xl:w-[420px] xl:rounded-none xl:border-y-0 xl:border-r-0 xl:shadow-none';
  const base =
    'z-50 flex max-w-[100vw] flex-col overflow-hidden border border-slate-200 bg-white/95 shadow-2xl shadow-slate-900/10 backdrop-blur transition-all duration-300 ';

  switch (zoomState) {
    case 'small':
      return `${base} ${mobileSheet} sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[540px] sm:w-[360px] sm:rounded-2xl sm:border md:w-[390px] ${docked}`;
    case 'large':
      return `${base} ${mobileSheet} sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[82vh] sm:w-[92vw] sm:rounded-2xl sm:border md:w-[680px] ${docked}`;
    case 'panel':
      // Slots underneath the top Navigation bar (assuming height h-14 / 56px)
      return `${base} ${mobileSheet} md:fixed md:right-0 md:top-14 md:bottom-0 md:left-auto md:h-[calc(100vh-56px)] md:w-[420px] md:rounded-none md:border-l`;
    case 'drawer':
      return `${base} ${mobileSheet} sm:bottom-0 sm:left-0 sm:right-0 sm:top-auto sm:h-[70vh] sm:w-full sm:rounded-t-2xl sm:border-t`;
    case 'fullscreen':
      // The one mode the user explicitly picks to maximize — stays true full-screen at
      // every width, mobile included.
      return `${base} fixed inset-0 h-[100dvh] w-screen rounded-none border-0`;
    default:
      return `${base} ${mobileSheet} sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[540px] sm:w-[390px] sm:rounded-2xl sm:border ${docked}`;
  }
}
