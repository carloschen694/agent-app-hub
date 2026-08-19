import type { AgentAppManifest } from '../../agent/types/agent';
import { settingsRepository } from '../../agent/repositories/settingsRepository';
import { MainPage } from './MainPage';
import { productTools } from './tools/productTools';
import { createPolicyTools } from './tools/policyTools';
import { campingAssistantSystemPrompt } from './prompts/systemPrompt';

// RAG 檢索工具需要即時取得目前設定的 API Key 才能呼叫 Embedding API，
// 因此透過 settingsRepository 在每次呼叫當下讀取，而非在 manifest 建立時固定寫死。
const policyTools = createPolicyTools(() => settingsRepository.getSettings().apiKey);

export const campingAssistantManifest: AgentAppManifest = {
  agentAppId: 'class04-camping-tools-rag',
  agentAppName: '露營裝備租賃 AI 小助手',
  description: '露營裝備出租商商品瀏覽與服務規章查詢，結合 Function Calling 查商品、RAG 語意檢索查規章。',
  route: '/class04/camping-tools-rag',
  systemPrompt: campingAssistantSystemPrompt,
  availableTools: [...productTools, ...policyTools],
  MainView: MainPage,
  icon: 'hiking',
  category: 'RAG / Function Calling',
  exampleQuestions: [
    '有哪些帳篷可以租借？',
    'The Two 輕量雙人帳租 4 天要多少錢？',
    '如果颱風天，可以取消訂單並退費嗎？',
    '我想租 The Two 四天，如果颱風可以退費嗎？',
  ],
  appVersion: '1.0.0',
  courseId: 'course04',
  slideDeck: 'class04/slides/slide.md',
  slideNotes: '對應 Course 04：正式示範 Tool Calling 查商品與 RAG 語意檢索查服務規章。',
  sortOrder: 50,
};
