import type { AgentAppManifest } from '../../agent/types/agent';
import { campingMarkdownSystemPrompt } from './prompts/campingMarkdownPrompt';
import CampingMarkdownMainPage from './MainPage';
import { CampingMarkdownCard } from './CardWidget';

export const campingMarkdownManifest: AgentAppManifest = {
  agentAppId: 'class03-camping-markdown',
  agentAppName: '露營裝備客服（Markdown 商品清單）',
  description: '系統提示詞已包含完整 Markdown 商品清單與客服角色說明，Agent 可正確回答商品資訊問題。',
  route: '/class03/camping-markdown',
  systemPrompt: campingMarkdownSystemPrompt,
  availableTools: [],
  MainView: CampingMarkdownMainPage,
  CardWidget: CampingMarkdownCard,
  exampleQuestions: ['藍山PRO2 輕量雙人帳現在租一天多少錢？', '有沒有 60L 左右的背包可以租？', '你們有沒有登山杖出租？'],
  courseId: 'course03',
  slideDeck: 'class03/slides/slide.md',
  slideNotes: '對應 Course 03：示範把 Markdown 商品清單直接放進 system prompt 的階段。',
  sortOrder: 30,
};
