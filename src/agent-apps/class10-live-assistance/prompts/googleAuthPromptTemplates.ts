import type { GoogleServiceKey } from '../services/googleAuthService';

const SERVICE_NAMES: Record<GoogleServiceKey, { name: string; icon: string; desc: string }> = {
  contacts: { name: 'Google 聯絡人', icon: 'contacts', desc: '助理需要您的授權以讀取或新增聯絡人資訊。' },
  calendar: { name: 'Google 行事曆', icon: 'calendar_month', desc: '助理需要您的授權以讀取與排定行事曆行程與待辦事項。' },
  gmail: { name: 'Gmail 電子郵件', icon: 'mail', desc: '助理需要您的授權以讀取最新郵件與協助發送信件。' }
};

export function buildStandardAuthPromptHtml(service: GoogleServiceKey, isRenewal: boolean = false): string {
  const meta = SERVICE_NAMES[service];
  const title = isRenewal ? `🔑 ${meta.name} 授權需續約` : `🔒 需要 ${meta.name} 授權`;
  const btnLabel = isRenewal ? `一鍵續約 ${meta.name}` : `立即授權 ${meta.name}`;

  return `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      margin: 0;
      padding: 16px;
      background-color: #ffffff;
      color: #0f172a;
    }
    .card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      background: #f8fafc;
      text-align: center;
    }
    .icon {
      font-size: 32px;
      color: #2563eb;
      margin-bottom: 8px;
    }
    .title {
      font-size: 14px;
      font-weight: 600;
      color: #1e293b;
      margin: 0 0 6px 0;
    }
    .desc {
      font-size: 12px;
      color: #64748b;
      margin: 0 0 16px 0;
      line-height: 1.5;
    }
    .btn {
      display: inline-block;
      width: 100%;
      background-color: ${isRenewal ? '#d97706' : '#2563eb'};
      color: #ffffff;
      border: none;
      border-radius: 6px;
      padding: 10px 16px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      box-sizing: border-box;
      transition: background-color 0.2s;
    }
    .btn:hover {
      background-color: ${isRenewal ? '#b45309' : '#1d4ed8'};
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="title">${title}</div>
    <div class="desc">${meta.desc}</div>
    <button class="btn" onclick="window.reply('authorize:${service}')">${btnLabel}</button>
  </div>
</body>
</html>
`;
}
