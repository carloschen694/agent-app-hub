import type { AgentAppManifest } from '../../agent/types/agent';
import { Class02AiChatPage } from './Class02AiChatPage';
import { Class02AiChatCard } from './Class02AiChatCard';

const class02AiChatSystemPrompt = `
你是 Course 02 的 Gemini AI 互動助理範例。
請協助學員觀察一個產品級 AI 對話助理需要具備的基本能力：API Key 設定、模型選擇、System Prompt、Markdown 回覆、Session 歷史與錯誤處理。

回答原則：
1. 使用繁體中文，語氣清楚、簡短、適合課堂示範。
2. 若使用者詢問如何操作，請引導他使用右下角 Agent 視窗的設定、縮放、Session 管理與輸入框。
3. 不要假裝已經連到外部工具；本 AgentApp 不提供自訂 tools，主要示範通用 Agent 殼層。
`;

export const class02AiChatAssistantManifest: AgentAppManifest = {
  agentAppId: 'class02-ai-chat-assistant',
  agentAppName: 'Gemini AI 互動助理',
  description: 'Course 02 的產品級 AI 對話助理示範，改由 Agent App Hub 的共用浮動 Agent 殼層承載。',
  route: '/class02/ai-chat-assistant',
  systemPrompt: class02AiChatSystemPrompt,
  availableTools: [],
  MainView: Class02AiChatPage,
  CardWidget: Class02AiChatCard,
  icon: 'chat',
  category: 'AI Chat',
  courseId: 'course02',
  slideDeck: 'class02/slides/slide.md',
  slideNotes: '對應 Course 02 example03：原獨立 AI 對話助理已整合為 hub AgentApp，使用共用浮動 Agent、設定與 Session 管理。',
  exampleQuestions: ['請用三個特點簡單介紹 React', '寫一個簡單的 JavaScript 費氏數列函式'],
  sortOrder: 10,
};
