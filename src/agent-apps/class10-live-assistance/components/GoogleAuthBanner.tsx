import React, { useEffect, useState } from 'react';
import {
  getServiceAuthInfo,
  requestGoogleScope,
  type GoogleServiceKey,
  type TokenStatus
} from '../services/googleAuthService';

interface ServiceItem {
  key: GoogleServiceKey;
  label: string;
  icon: string;
}

const SERVICES: ServiceItem[] = [
  { key: 'contacts', label: '聯絡人', icon: 'contacts' },
  { key: 'calendar', label: '行事曆', icon: 'calendar_month' },
  { key: 'gmail', label: 'Gmail', icon: 'mail' }
];

export interface GoogleAuthBannerProps {
  onOpenSettings?: () => void;
}

export const GoogleAuthBanner: React.FC<GoogleAuthBannerProps> = ({ onOpenSettings }) => {
  const [statuses, setStatuses] = useState<Record<GoogleServiceKey, TokenStatus>>({
    contacts: 'unauthorized',
    calendar: 'unauthorized',
    gmail: 'unauthorized'
  });

  const checkStatuses = () => {
    setStatuses({
      contacts: getServiceAuthInfo('contacts').status,
      calendar: getServiceAuthInfo('calendar').status,
      gmail: getServiceAuthInfo('gmail').status
    });
  };

  useEffect(() => {
    checkStatuses();
    const interval = setInterval(checkStatuses, 3000);
    return () => clearInterval(interval);
  }, []);

  const hasUnauthorized = SERVICES.some(s => statuses[s.key] === 'unauthorized');
  const hasRenewal = SERVICES.some(s => statuses[s.key] === 'needs_renewal');

  if (!hasUnauthorized && !hasRenewal) {
    return null;
  }

  const handleQuickConnect = async (key: GoogleServiceKey) => {
    await requestGoogleScope(key);
    checkStatuses();
  };

  return (
    <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50/80 p-3 shadow-sm transition-all">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-600 text-xl">lock_open</span>
          <div>
            <h4 className="text-xs font-semibold text-slate-800">Google 工作服務整合授權</h4>
            <p className="text-[11px] text-slate-500">
              {hasRenewal ? '部分 Google 服務憑證已過期，請進行一鍵續約' : '開啟授權讓助理幫您處理聯絡人、行事曆與重要郵件'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {SERVICES.map(s => {
            const st = statuses[s.key];
            if (st === 'authorized') return null;
            const isRenewal = st === 'needs_renewal';

            return (
              <button
                key={s.key}
                type="button"
                onClick={() => handleQuickConnect(s.key)}
                className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium transition-colors ${
                  isRenewal
                    ? 'border-amber-300 bg-amber-500 text-white hover:bg-amber-600'
                    : 'border-blue-300 bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <span className="material-symbols-outlined text-sm">{s.icon}</span>
                {isRenewal ? `續約 ${s.label}` : `授權 ${s.label}`}
              </button>
            );
          })}

          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="text-[11px] text-blue-700 underline underline-offset-2 hover:text-blue-900 ml-1"
            >
              開啟完整設定
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
