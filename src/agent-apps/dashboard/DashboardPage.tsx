import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { agentAppRegistry } from '../../config/agentAppRegistry';
import { Card } from '../../shared/components/Card';
import { Button } from '../../shared/components/Button';
import { useHiddenAppIds } from '../../shared/hooks/useHiddenAppIds';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const hiddenAppIds = useHiddenAppIds();

  // Filter out the dashboard app itself and any app the user hid in settings
  const allApps = agentAppRegistry.filter(app => app.agentAppId !== 'dashboard');
  const apps = allApps.filter(app => !hiddenAppIds.has(app.agentAppId));

  return (
    <div className="space-y-6">
      <div className="border-l-4 border-blue-600 pl-4 py-1">
        <h1 className="text-xl font-bold text-gray-900 font-heading">AIBuildGo 代理人應用大廳</h1>
        <p className="text-xs text-gray-500 mt-1">
          歡迎使用 AIBuildGo。請在下方選擇您想啟動的 AI 協作工具，或點擊右下角 AI 助理進行對話。
        </p>
      </div>

      {apps.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-slate-500">
          <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">widgets</span>
          {allApps.length === 0 ? (
            <p className="text-xs font-medium">目前尚未註冊任何 Agent 應用程式。</p>
          ) : (
            <>
              <p className="text-xs font-medium">目前所有 App 都已在顯示設定中隱藏。</p>
              <Link to="/settings/apps" className="mt-2 inline-block text-xs font-semibold text-blue-600 hover:underline">
                前往顯示設定
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {apps.map((app) => {
            const handleOpen = () => navigate(app.route);

            // Render custom CardWidget if provided by the AgentApp manifest
            if (app.CardWidget) {
              const CustomCard = app.CardWidget;
              return (
                <CustomCard
                  key={app.agentAppId}
                  manifest={app}
                  onOpen={handleOpen}
                />
              );
            }

            // Fallback default card
            return (
              <Card
                key={app.agentAppId}
                className="flex flex-col h-[220px] justify-between hover:-translate-y-1 hover:border-blue-500/50 hover:shadow-lg transition-all duration-300 border border-slate-200/80 bg-white rounded-xl p-5"
              >
                <div className="space-y-3">
                  {/* Icon and Name Row */}
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-600 shrink-0">
                      <span className="material-symbols-outlined text-lg font-semibold">
                        {app.icon || 'extension'}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-gray-800 line-clamp-1">
                      {app.agentAppName}
                    </h3>
                  </div>

                  {/* Course ID Badge */}
                  <div>
                    {app.courseId ? (
                      <div className="inline-flex items-center rounded-md bg-blue-50/80 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-100/50 uppercase tracking-wider">
                        {app.courseId}
                      </div>
                    ) : (
                      <div className="inline-flex items-center rounded-md bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500 border border-slate-100 uppercase tracking-wider">
                        System Utility
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">
                    {app.description}
                  </p>
                </div>

                {/* Action Row */}
                <div className="flex justify-end pt-3 mt-auto border-t border-slate-50">
                  <Button
                    size="sm"
                    onClick={handleOpen}
                    className="flex items-center gap-1 text-xs font-semibold cursor-pointer"
                  >
                    <span>啟動應用</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
