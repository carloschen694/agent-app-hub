import type { AgentAppManifest } from '../../agent/types/agent';
import { DataAnalysisPage } from './DataAnalysisPage';
import { dataAnalysisTools } from './tools/dataAnalysisTools';
import { DATA_ANALYSIS_SYSTEM_PROMPT } from './prompts/dataAnalysisPrompt';

export const dataAnalysisManifest: AgentAppManifest = {
  agentAppId: 'class08-data-analysis',
  agentAppName: '數據分析助理',
  description: '連接 Northwind 資料庫，使用常用報表工具與唯讀 SQL 探索資料，生成 Chart.js 視覺化報告。',
  route: '/class08/data-analysis',
  systemPrompt: DATA_ANALYSIS_SYSTEM_PROMPT,
  availableTools: dataAnalysisTools,
  MainView: DataAnalysisPage,
  courseId: 'course08',
  slideDeck: 'class08/slides/slide.md',
  slideNotes: '對應 Course 08：資料庫連線、營運資料探索與 HTML/Chart.js 分析報告生成。',
  sortOrder: 70,
};
