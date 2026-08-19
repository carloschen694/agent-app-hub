import type { AgentAppManifest } from '../agent/types/agent';

// Whether a route should get the shell's full-viewport, no-padding layout instead of the
// default centered max-width card — driven by the matching app's own manifest, not a
// hardcoded pathname check in AppLayout.tsx.
export function isFullPageRoute(pathname: string, registry: readonly AgentAppManifest[]): boolean {
  return Boolean(registry.find((app) => app.route === pathname)?.fullPage);
}
