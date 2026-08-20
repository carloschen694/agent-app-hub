import React from 'react';
import { Link } from 'react-router-dom';
import { agentAppRegistry } from '../config/agentAppRegistry';
import { appVisibilityRepository } from '../shared/repositories/appVisibilityRepository';
import { useHiddenAppIds } from '../shared/hooks/useHiddenAppIds';

export const AppVisibilityPage: React.FC = () => {
  const hiddenAppIds = useHiddenAppIds();
  const apps = agentAppRegistry.filter((app) => app.agentAppId !== 'dashboard');

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="border-l-4 border-blue-600 pl-4 py-1">
        <h1 className="text-xl font-bold text-gray-900 font-heading">Agent App 顯示設定</h1>
        <p className="mt-1 text-xs text-gray-500">
          選擇要在導覽選單與首頁大廳顯示的 App。設定只存在這台瀏覽器（localStorage），不影響其他使用者。首頁大廳一律顯示，無法隱藏。
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => appVisibilityRepository.setHiddenAppIds([])}
          disabled={hiddenAppIds.size === 0}
          className="text-xs font-semibold text-blue-600 hover:underline disabled:cursor-not-allowed disabled:text-gray-300 disabled:no-underline"
        >
          全部顯示
        </button>
      </div>

      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="material-symbols-outlined shrink-0 text-lg text-blue-600">dashboard</span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-gray-800">首頁大廳</div>
              <div className="truncate text-[11px] text-gray-400">dashboard</div>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-gray-500">
            一律顯示
          </span>
        </div>

        {apps.map((app) => {
          const hidden = hiddenAppIds.has(app.agentAppId);
          return (
            <div key={app.agentAppId} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="material-symbols-outlined shrink-0 text-lg text-blue-600">
                  {app.icon ?? 'apps'}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-gray-800">{app.agentAppName}</div>
                  <div className="truncate text-[11px] text-gray-400">{app.agentAppId}</div>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={!hidden}
                aria-label={`是否顯示「${app.agentAppName}」`}
                onClick={() => appVisibilityRepository.setAppHidden(app.agentAppId, !hidden)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                  hidden ? 'bg-slate-200' : 'bg-blue-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    hidden ? 'translate-x-1' : 'translate-x-6'
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>

      <Link to="/" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline">
        <span className="material-symbols-outlined text-sm">arrow_back</span>
        返回大廳
      </Link>
    </div>
  );
};
