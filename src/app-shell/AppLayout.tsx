import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navigation } from './Navigation';
import { AgentLauncher } from '../agent/components/AgentLauncher';
import { AgentWindow } from '../agent/components/AgentWindow';
import { useAgent } from '../agent/hooks/useAgent';
import { agentAppRegistry } from '../config/agentAppRegistry';
import { isFullPageRoute } from './fullPageRoute';

export const AppLayout: React.FC = () => {
  const location = useLocation();
  const {
    uiState,
    setActiveAppId,
    setActiveAppManifest,
    setActiveTools,
    setActiveSystemPrompt,
    setRuntimeContext
  } = useAgent();

  useEffect(() => {
    // Synchronize agent app context with router path
    const currentApp = agentAppRegistry.find(app => app.route === location.pathname);
    if (currentApp) {
      setActiveAppId(currentApp.agentAppId);
      setActiveAppManifest(currentApp);
      setActiveTools(currentApp.availableTools);
      setActiveSystemPrompt(currentApp.systemPrompt);
      setRuntimeContext(`目前頁面：${currentApp.agentAppName}，網址為 ${currentApp.route}。`);
    } else {
      // Fallback
      setActiveAppId('dashboard');
      setActiveAppManifest(null);
      setActiveTools([]);
      setActiveSystemPrompt('');
      setRuntimeContext('目前頁面：大廳首頁。');
    }
  }, [
    location.pathname,
    setActiveAppId,
    setActiveAppManifest,
    setActiveTools,
    setActiveSystemPrompt,
    setRuntimeContext
  ]);

  // The docked chat panel reserves space at a breakpoint that depends on which
  // zoomState is active: 'panel' docks starting at md:, 'small'/'large' dock at xl:
  // (see AgentWindow.tsx's getWindowClasses). 'drawer'/'fullscreen' overlay the
  // page instead of docking beside it, so no reserved padding is needed.
  const dockedPadClass = !uiState.isOpened
    ? ''
    : uiState.zoomState === 'panel'
      ? 'md:pr-[420px]'
      : uiState.zoomState === 'small' || uiState.zoomState === 'large'
        ? 'xl:pr-[420px]'
        : '';

  const isFullPageApp = isFullPageRoute(location.pathname, agentAppRegistry);

  return (
    <div className={`w-full bg-slate-50 flex flex-col font-sans ${isFullPageApp ? 'h-screen overflow-hidden' : 'min-h-screen overflow-x-hidden'}`}>
      <Navigation />
      
      {/* The docked agent reserves space on this full-width wrapper, so the
          centered max-w container re-centers within the remaining space
          instead of keeping a dead margin next to the chat panel. */}
      <div
        className={`flex min-h-0 flex-1 w-full transition-[padding] duration-300 ${dockedPadClass}`}
      >
        <main className={isFullPageApp ? 'flex-1 min-h-0 w-full overflow-hidden' : 'w-full max-w-7xl mx-auto px-3 py-4 box-border sm:px-4 md:px-6 md:py-6'}>
          <Outlet />
        </main>
      </div>

      {/* Global Floating Agent */}
      <AgentLauncher />
      <AgentWindow />
    </div>
  );
};
