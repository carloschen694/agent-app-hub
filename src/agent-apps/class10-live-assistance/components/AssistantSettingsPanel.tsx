import React from 'react';
import {
  PERSONALITY_LIST,
  VOICE_OPTIONS,
  type PersonalityId,
  type PersonalityProfile
} from '../prompts/personalityPrompts';
import { intervalForProactiveness } from '../services/observerService';
import {
  getServiceAuthInfo,
  requestGoogleScope,
  revokeGoogleScope
} from '../services/googleAuthService';

export interface AssistantSettings {
  personalityId: PersonalityId;
  voiceName: string;
  userName?: string;
  proactiveVoice?: boolean;
  avatarEnabled?: boolean;
  avatarModelUrl?: string;
  avatarCameraView?: 'head' | 'upper' | 'full';
}

export interface AssistantSettingsPanelProps {
  settings: AssistantSettings;
  onChange: (patch: Partial<AssistantSettings>) => void;
}

const VERBOSITY_LABELS = { terse: '精簡', balanced: '適中', detailed: '詳細' } as const;
const EMOTION_LABELS = { none: '中性', light: '輕度', expressive: '鮮明' } as const;

const ParameterRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between gap-2">
    <span className="text-slate-400">{label}</span>
    <span className="text-right text-slate-600">{value}</span>
  </div>
);

const describe = (profile: PersonalityProfile) => (
  <div className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-[11px]">
    <ParameterRow
      label="主動介入"
      value={`${profile.proactiveness}/5．約 ${Math.round(
        intervalForProactiveness(profile.proactiveness) / 1000
      )} 秒觀察一次`}
    />
    <ParameterRow label="答覆字數" value={VERBOSITY_LABELS[profile.verbosity]} />
    <ParameterRow label="情緒標註" value={EMOTION_LABELS[profile.emotionMarkup]} />
  </div>
);

export const AssistantSettingsPanel: React.FC<AssistantSettingsPanelProps> = ({
  settings,
  onChange
}) => (
  <div className="space-y-6 p-4">
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
        <span className="material-symbols-outlined text-blue-600 text-lg">badge</span>
        稱呼偏好 (User Addressing)
      </h3>
      <div className="rounded border border-slate-200 bg-white p-3 space-y-1.5">
        <label className="block text-xs font-medium text-slate-700">
          助理對您的稱呼 (預設為「主人」，亦可自訂如 "CK"、"陳先生" 或自 Google 帳號自動帶入)
        </label>
        <input
          type="text"
          value={settings.userName ?? ''}
          onChange={e => onChange({ userName: e.target.value })}
          placeholder="例如：CK 或 主人"
          className="w-full rounded border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
        />
      </div>
    </section>
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-800">個性</h3>
      <p className="text-[11px] text-slate-400">
        個性同時決定助理的態度、主動介入的積極度、回覆長度與情緒標註方式，也直接影響主動觀察的頻率。
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {PERSONALITY_LIST.map(profile => {
          const active = settings.personalityId === profile.id;
          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => onChange({ personalityId: profile.id })}
              className={`rounded border px-3 py-2.5 text-left transition-colors ${active
                ? 'border-blue-600 bg-blue-50'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
            >
              <span className="flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${active ? 'bg-blue-600' : 'bg-slate-300'}`}
                />
                <span className="text-sm font-medium text-slate-800">{profile.name}</span>
              </span>
              <span className="mt-1 block text-[11px] leading-relaxed text-slate-500">
                {profile.attitude}
              </span>
              {describe(profile)}
            </button>
          );
        })}
      </div>
    </section>

    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-800">主動語音播報</h3>
      <label className="flex items-center gap-3 cursor-pointer rounded border border-slate-200 bg-white p-3 transition-colors hover:bg-slate-50">
        <input
          type="checkbox"
          checked={settings.proactiveVoice !== false}
          onChange={e => onChange({ proactiveVoice: e.target.checked })}
          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <div className="flex-1">
          <span className="block text-sm font-medium text-slate-800">主動觀察時用語音向您提問/提醒</span>
          <span className="block text-[11px] leading-relaxed text-slate-500">
            連線 Live 語音時直接透過選定人聲提問；未連線時使用在地語音播報，並寫入對話短程記憶。
          </span>
        </div>
      </label>
    </section>

    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
        <span className="material-symbols-outlined text-blue-600 text-lg">person_play</span>
        3D 虛擬人像 (TalkingHead Avatar)
      </h3>
      <label className="flex items-center gap-3 cursor-pointer rounded border border-slate-200 bg-white p-3 transition-colors hover:bg-slate-50">
        <input
          type="checkbox"
          checked={settings.avatarEnabled !== false}
          onChange={e => onChange({ avatarEnabled: e.target.checked })}
          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <div className="flex-1">
          <span className="block text-sm font-medium text-slate-800">啟用 3D 浮動人像</span>
          <span className="block text-[11px] leading-relaxed text-slate-500">
            助理開口講話時，畫面右下角顯示 3D 虛擬人像並即時動態對嘴與肢體動作。
          </span>
        </div>
      </label>

      {settings.avatarEnabled !== false && (
        <div className="mt-2 space-y-2 rounded border border-slate-100 bg-slate-50/70 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] font-medium text-slate-700 mb-1">預設 3D 人像角色模型</label>
              <select
                value={settings.avatarModelUrl || new URL('../assets/avatars/avaturn.glb', import.meta.url).href}
                onChange={e => onChange({ avatarModelUrl: e.target.value })}
                className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              >
                <option value={new URL('../assets/avatars/avaturn.glb', import.meta.url).href}>Avaturn (官方預設)</option>
                <option value={new URL('../assets/avatars/brunette.glb', import.meta.url).href}>Brunette (經典棕髮人像)</option>
                <option value={new URL('../assets/avatars/brunette-t.glb', import.meta.url).href}>Brunette-T (T-Pose 骨架版)</option>
                <option value={new URL('../assets/avatars/avatarsdk.glb', import.meta.url).href}>AvatarSDK (SDK 擬真人像)</option>
                <option value={new URL('../assets/avatars/mpfb.glb', import.meta.url).href}>MPFB (MakeHuman 模型)</option>
                <option value={new URL('../assets/avatars/vroid.glb', import.meta.url).href}>VRoid (二次元動漫風格)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-700 mb-1">運鏡視角</label>
              <select
                value={settings.avatarCameraView || 'head'}
                onChange={e => onChange({ avatarCameraView: e.target.value as any })}
                className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              >
                <option value="head">特寫頭部 (Head)</option>
                <option value="upper">上半身 (Upper Body)</option>
                <option value="full">全身視角 (Full Body)</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium pt-1 border-t border-slate-200/60">
            <span className="material-symbols-outlined text-[14px]">check_circle</span>
            已設定並儲存至本機，下次開啟應用將自動載入您指定的角色與視角。
          </div>
        </div>
      )}
    </section>

    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-800">聲音模型</h3>
      <p className="text-[11px] text-slate-400">
        語音由殼層的 Live 連線負責，這裡的選擇會透過殼層開放的覆寫介面套用到下一次語音對談。
      </p>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {VOICE_OPTIONS.map(voice => {
          const active = settings.voiceName === voice.name;
          return (
            <button
              key={voice.name}
              type="button"
              onClick={() => onChange({ voiceName: voice.name })}
              className={`flex items-center gap-2 rounded border px-3 py-2 text-left transition-colors ${active
                ? 'border-blue-600 bg-blue-50'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
            >
              <span className="material-symbols-outlined text-[16px] text-slate-400">
                {voice.gender === '男聲' ? 'man' : 'woman'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-slate-800">{voice.name}</span>
                <span className="block text-[11px] text-slate-500">
                  {voice.gender}．{voice.note}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>

    <GoogleAuthSection />

  </div>
);

const GoogleAuthSection: React.FC = () => {
  const [authStates, setAuthStates] = React.useState({
    contacts: getServiceAuthInfo('contacts'),
    calendar: getServiceAuthInfo('calendar'),
    gmail: getServiceAuthInfo('gmail')
  });

  const refreshStates = () => {
    setAuthStates({
      contacts: getServiceAuthInfo('contacts'),
      calendar: getServiceAuthInfo('calendar'),
      gmail: getServiceAuthInfo('gmail')
    });
  };

  const handleToggle = async (service: 'contacts' | 'calendar' | 'gmail') => {
    const current = authStates[service];
    if (current.status === 'authorized') {
      revokeGoogleScope(service);
      refreshStates();
    } else {
      await requestGoogleScope(service);
      refreshStates();
    }
  };

  const services: Array<{ key: 'contacts' | 'calendar' | 'gmail'; label: string; icon: string; desc: string }> = [
    { key: 'contacts', label: 'Google 聯絡人', icon: 'contacts', desc: '允許助理記錄、搜尋與維護聯絡人資料' },
    { key: 'calendar', label: 'Google 行事曆', icon: 'calendar_month', desc: '允許助理查詢行程、排定開會與待辦事項' },
    { key: 'gmail', label: 'Gmail 電子郵件', icon: 'mail', desc: '允許助理檢查重要郵件提醒與協助撰寫/發送信件' }
  ];

  return (
    <section className="space-y-2 pt-4 border-t border-slate-200">
      <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
        <span className="material-symbols-outlined text-blue-600 text-lg">lock_open</span>
        Google 工作服務授權 (Individual OAuth Scopes)
      </h3>
      <p className="text-[11px] text-slate-400">
        您可以自由開啟或停用個別服務。開啟時將向 Google 請求對應範圍授權；1 小時 Token 過期時可進行一鍵續約。
      </p>
      <div className="space-y-2">
        {services.map(s => {
          const state = authStates[s.key];
          const isAuthorized = state.status === 'authorized';
          const needsRenewal = state.status === 'needs_renewal';

          return (
            <div key={s.key} className="flex items-center justify-between gap-3 rounded border border-slate-200 bg-white p-3">
              <div className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-slate-600 text-xl mt-0.5">{s.icon}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-800">{s.label}</span>
                    {isAuthorized && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> 已授權
                      </span>
                    )}
                    {needsRenewal && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" /> 授權需續約
                      </span>
                    )}
                    {!isAuthorized && !needsRenewal && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                        未授權
                      </span>
                    )}
                  </div>
                  <span className="block text-[11px] text-slate-500 mt-0.5">{s.desc}</span>
                </div>
              </div>
              <div>
                {needsRenewal ? (
                  <button
                    type="button"
                    onClick={() => handleToggle(s.key)}
                    className="rounded bg-amber-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm hover:bg-amber-700 transition-colors"
                  >
                    一鍵續約
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleToggle(s.key)}
                    className={`rounded px-3 py-1 text-xs font-medium transition-colors ${isAuthorized
                      ? 'border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                  >
                    {isAuthorized ? '解除授權' : '開啟授權'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
