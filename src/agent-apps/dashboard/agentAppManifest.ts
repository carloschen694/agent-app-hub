import type { AgentAppManifest } from '../../agent/types/agent';
import { DashboardPage } from './DashboardPage';

export const dashboardAppManifest: AgentAppManifest = {
  agentAppId: 'dashboard',
  agentAppName: '首頁大廳',
  description: 'AI 代理人應用大廳，展示並啟動您的 Agent 應用程式。',
  route: '/',
  systemPrompt: '您是 Agent App Hub 的大廳引導助理。請向使用者說明目前已安裝的應用（例如：比價助手），指引用戶如何啟動或使用這些工具。',
  availableTools: [],
  supportedUploads: {
    files: true,
    images: true
  },
  supportsRealtimeVoice: false,
  supportsVisionStream: false,
  supportsScreenStream: false,
  MainView: DashboardPage
};
