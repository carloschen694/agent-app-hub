import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { agentAppRegistry } from '../config/agentAppRegistry';

export function visibleNavigationApps() {
  return agentAppRegistry.filter((app) => app.agentAppId !== 'dashboard');
}

export const Navigation: React.FC = () => {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const apps = visibleNavigationApps();
  const activeApp = agentAppRegistry.find((app) => app.route === location.pathname);

  return (
    <nav className="sticky top-0 z-40 h-14 border-b border-slate-200 bg-white px-3 shadow-sm select-none sm:px-4 md:px-6">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-3">
        <Link
          to="/"
          onClick={() => setIsMenuOpen(false)}
          className="flex min-w-0 items-center gap-2 text-blue-600 hover:opacity-90"
        >
          <span className="material-symbols-outlined shrink-0 text-2xl font-bold">hub</span>
          <span className="hidden font-heading text-base font-bold leading-tight sm:inline lg:text-lg">
            AIBuildGo
          </span>
          <span className="font-heading text-sm font-bold leading-tight sm:hidden">
            AIBuildGo
          </span>
        </Link>

        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-xs font-semibold text-slate-800 sm:text-sm">
            {activeApp?.agentAppName ?? 'AI 代理人應用大廳'}
          </div>
          {activeApp?.courseId && (
            <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">
              {activeApp.courseId}
            </div>
          )}
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            className="flex h-9 items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:px-3"
            aria-expanded={isMenuOpen}
            aria-haspopup="menu"
          >
            <span className="material-symbols-outlined text-[20px]">apps</span>
            <span className="hidden sm:inline">切換應用</span>
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-11 z-50 w-[min(88vw,340px)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
              <div className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Agent Apps
              </div>
              <Link
                to="/"
                onClick={() => setIsMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2.5 text-sm transition-colors ${
                  location.pathname === '/'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">dashboard</span>
                <span className="font-medium">AI 代理人應用大廳</span>
              </Link>

              <div className="max-h-[70vh] overflow-y-auto py-1">
                {apps.map((app) => {
                  const isActive = location.pathname === app.route;
                  return (
                    <Link
                      key={app.agentAppId}
                      to={app.route}
                      onClick={() => setIsMenuOpen(false)}
                      className={`flex items-start gap-2 px-3 py-2.5 text-sm transition-colors ${
                        isActive
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-slate-700 hover:bg-slate-50 hover:text-slate-950'
                      }`}
                    >
                      <span className="material-symbols-outlined mt-0.5 text-[18px]">
                        {app.icon ?? 'apps'}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{app.agentAppName}</span>
                        <span className="block truncate text-[11px] text-slate-400">
                          {app.courseId ? `${app.courseId} · ` : ''}{app.slideDeck ?? app.agentAppId}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};
