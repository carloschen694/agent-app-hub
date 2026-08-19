import React from 'react';
import { HashRouter, Link, useLocation, useRoutes, type RouteObject } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { agentAppRegistry } from '../config/agentAppRegistry';

export const AppRouter: React.FC = () => {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  );
};

export const hubRouteObjects: RouteObject[] = [{
  path: '/',
  element: <AppLayout />,
  children: [
    ...agentAppRegistry.map((app): RouteObject => app.route === '/'
      ? { index: true, element: <app.MainView /> }
      : { path: app.route.replace(/^\//, ''), caseSensitive: true, element: <app.MainView /> }),
    { path: '*', element: <RouteNotFoundPage /> },
  ],
}];

export const AppRoutes: React.FC = () => useRoutes(hubRouteObjects);

function RouteNotFoundPage() {
  const location = useLocation();
  return <NotFoundPage pathname={location.pathname} />;
}

export const NotFoundPage: React.FC<{ pathname: string }> = ({ pathname }) => {
  return (
    <main className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="route-not-found-title">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">404 · Route</p>
      <h1 id="route-not-found-title" className="mt-2 text-xl font-bold text-slate-900">找不到此頁面</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        路由需完全符合小寫網址。「{pathname}」不是有效的路由，請回到應用大廳選擇您有權限使用的工具。
      </p>
      <Link to="/" className="mt-5 inline-flex rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500">
        返回應用大廳
      </Link>
    </main>
  );
};
