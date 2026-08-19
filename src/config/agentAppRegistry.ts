import type { AgentAppManifest } from '../agent/types/agent';

// Force HMR re-glob update for new AgentApps
const modules = import.meta.glob<{ [key: string]: AgentAppManifest }>('../agent-apps/**/agentAppManifest.ts', {
  eager: true,
});

function uniqueById(apps: AgentAppManifest[]) {
  const seen = new Set<string>();
  return apps.filter((app) => {
    if (seen.has(app.agentAppId)) return false;
    seen.add(app.agentAppId);
    return true;
  });
}

export const agentAppRegistry: AgentAppManifest[] = uniqueById(
  Object.values(modules)
    .flatMap((mod) => Object.values(mod))
    .filter((value): value is AgentAppManifest => Boolean(value?.agentAppId))
).sort((a, b) => {
  // 'dashboard' is the shell's own home view, not a folder-registered app in the ordering
  // sense — it's always pinned first regardless of sortOrder.
  if (a.agentAppId === 'dashboard') return -1;
  if (b.agentAppId === 'dashboard') return 1;

  return (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || a.agentAppName.localeCompare(b.agentAppName, 'zh-Hant');
});
