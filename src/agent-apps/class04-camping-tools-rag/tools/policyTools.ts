import type { AgentTool, ToolResult } from '../../../agent/types/tool';
import { policyRetrievalService } from '../services/policyRetrievalService';

/**
 * 建立規章 RAG 檢索 Tool。
 *
 * 因為 embedding 查詢需要即時呼叫 Gemini Embedding API，必須取得目前使用者設定的 API Key，
 * 因此以 factory function 的形式注入 `getApiKey`，由 AgentApp MainPage 依目前 Agent 設定建立。
 */
export function createPolicyTools(getApiKey: () => string): AgentTool[] {
  return [
    {
      name: 'retrieve_policy_chunks',
      description:
        '透過語意檢索（RAG）查詢服務規章相關段落。適用於租期規則、押金規則、取貨與歸還、清潔規範、損壞賠償、取消退款、會員制度、點數制度、優惠方案等問題。會回傳最相關的前 3 個章節（含標題與原文內容）。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '使用者關於服務規章的問題或關鍵字' },
        },
        required: ['query'],
      },
      handler: async (args): Promise<ToolResult> => {
        try {
          const apiKey = getApiKey();
          if (!apiKey) {
            return { ok: false, error: '尚未設定 API Key，無法進行語意檢索' };
          }
          const query = String(args.query ?? '');
          if (!query.trim()) return { ok: false, error: 'query 不可為空字串' };

          const results = await policyRetrievalService.retrieveTopK(apiKey, query, 3);
          return { ok: true, data: results };
        } catch (err) {
          return { ok: false, error: `規章檢索失敗：${(err as Error).message}` };
        }
      },
    },
  ];
}
