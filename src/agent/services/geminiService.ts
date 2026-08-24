import type { Message, ErrorDetails, WebSearchGroundingMetadata, MessageAttachment } from '../types/message';
import type { ToolDefinition } from '../types/agent';
import { executeTool, type ToolHandlerMap } from './toolExecutionService';
import { createGoogleGenAI } from '../../shared/auth';

export function parseGeminiError(error: any): ErrorDetails {
  const msg = error?.message || String(error);

  let friendlyTitle = '發生了未知錯誤';
  let friendlyDesc = '抱歉，對話助理目前遇到了一些問題，請確認您的網路連線或稍後再試。';
  let type: 'busy' | 'api_key' | 'quota' | 'unknown' = 'unknown';

  if (
    msg.includes('503') ||
    msg.includes('high demand') ||
    msg.includes('service unavailable') ||
    msg.includes('temp') ||
    msg.includes('overloaded') ||
    msg.includes('is busy')
  ) {
    friendlyTitle = '伺服器目前過於繁忙';
    friendlyDesc = 'Gemini 伺服器目前正處於尖峰期或進行臨時維護，請稍等幾秒後再試。';
    type = 'busy';
  } else if (
    msg.includes('API_KEY_INVALID') ||
    msg.includes('API key not valid') ||
    msg.includes('invalid API key') ||
    (msg.includes('API key') && msg.includes('400')) ||
    msg.includes('API_KEY') ||
    msg.includes('API key is required')
  ) {
    friendlyTitle = 'API Key 似乎有誤';
    friendlyDesc = '請檢查您在設定面板中輸入的 API Key 是否正確。';
    type = 'api_key';
  } else if (
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('429') ||
    msg.includes('quota exceeded') ||
    msg.includes('Quota exceeded') ||
    msg.includes('rate limit exceeded') ||
    msg.includes('rateLimitExceeded') ||
    msg.includes('RATE_LIMIT_EXCEEDED')
  ) {
    friendlyTitle = '額度已達上限';
    friendlyDesc = '您的 API Key 目前已達到使用配額或請求頻率限制，請稍後再試。';
    type = 'quota';
  }

  return { friendlyTitle, friendlyDesc, type, rawMessage: msg };
}

export async function fetchGeminiModels(apiKey: string): Promise<string[]> {
  try {
    const ai = createGoogleGenAI(apiKey);
    const response = await ai.models.list();
    const models: string[] = [];
    // SDK 回傳的 response 可能是 Pager 或帶有 models 陣列
    const modelList = (response as any).models ?? (response as any).page ?? response;
    if (Array.isArray(modelList)) {
      for (const m of modelList) {
        const name = m.name?.replace('models/', '') || m.id || '';
        if (name) models.push(name);
      }
    }
    return Array.from(new Set(models));
  } catch (error) {
    console.error('Error fetching models dynamically', error);
    throw error;
  }
}

// 靜態 Fallback 清單（僅在 API 無法動態取得時使用）
export const OFFLINE_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-2.5-pro'
];

export const LIVE_MODELS = [
  'gemini-3.1-flash-live-preview',
  'gemini-3.6-flash',
  'gemini-2.0-flash-exp',
  'gemini-1.5-flash'
];

export const MULTIMEDIA_GEN_MODELS = [
  'gemini-3.1-flash-image',
  'gemini-3.1-flash-lite-image',
  'gemini-3-pro-image',
  'gemini-2.5-flash-image',
  'veo-3.1-generate-preview',
  'veo-3.1-fast-generate-preview'
];

interface SendMessageParams {
  apiKey: string;
  modelName: string;
  systemPrompt: string;
  history: Message[];
  messageText: string;
  attachments?: MessageAttachment[];
  tools?: ToolDefinition[];
  toolHandlers?: ToolHandlerMap;
  onActivity?: (state: 'thinking' | 'tool', detail: string) => void;
  enableGoogleSearch?: boolean;
}

function buildAlwaysOnTools(tools: ToolDefinition[], enableGoogleSearch = false) {
  return [
    ...(enableGoogleSearch ? [{ googleSearch: {} }] : []),
    ...(tools.length > 0
      ? [{
          functionDeclarations: tools.map(t => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters
          }))
        }]
      : [])
  ];
}

function buildUserParts(text: string, attachments: MessageAttachment[] = []) {
  const parts: any[] = [];
  if (text) parts.push({ text });
  for (const attachment of attachments) {
    if (!attachment.base64Data) continue;
    parts.push({
      inlineData: {
        mimeType: attachment.mimeType,
        data: attachment.base64Data
      }
    });
  }
  if (parts.length === 0) parts.push({ text: '' });
  return parts;
}

/**
 * 舊輪次的檢索結果折疊成摘要。
 *
 * 完整重播每一輪的 functionResponse 會讓 context 隨輪數線性膨脹：十輪課程問答
 * 就是十份投影片內容仍留在 context，與本次檢索疊加。模型已依據那些內容回答過，
 * 保留來源摘要即可。長任務路徑刻意傳 history: [] 也是同一個原則。
 */
function summarizeStaleToolResult(result: any): any {
  if (!result || typeof result !== 'object') return result;

  const results = (result as any).results;
  if (!Array.isArray(results) || results.length === 0) return result;

  const cited = results
    .map((r: any) => {
      if (r?.classId && r?.slideNo !== null && r?.slideNo !== undefined) {
        return `${r.classId} Slide ${String(r.slideNo).padStart(2, '0')}${r.slideTitle ? `〈${r.slideTitle}〉` : ''}`;
      }
      return r?.sourceFile ?? null;
    })
    .filter(Boolean);

  return {
    query: (result as any).query,
    note: `[已於先前輪次檢索並用於回答，內容從略：${cited.join('、')}]`,
  };
}

export function buildContentsHistory(history: Message[]) {
  const contentsHistory: any[] = [];

  // 只有最近一輪的工具結果保留完整內容，更早的折疊為來源摘要
  const lastToolCallIndex = history.reduce(
    (last, msg, index) =>
      msg.sender === 'agent' && !msg.error && msg.toolCallsInfo && msg.toolCallsInfo.length > 0 ? index : last,
    -1
  );

  for (const [index, msg] of history.entries()) {
    if (msg.error) continue;

    if (msg.sender === 'agent' && msg.toolCallsInfo && msg.toolCallsInfo.length > 0) {
      const isStale = index !== lastToolCallIndex;

      contentsHistory.push({
        role: 'model',
        parts: msg.toolCallsInfo.map(tc => ({
          functionCall: {
            name: tc.name,
            args: tc.args
          }
        }))
      });

      // functionCall/functionResponse 需成對，否則 contents 驗證失敗；折疊的是內容而非結構
      contentsHistory.push({
        role: 'user',
        parts: msg.toolCallsInfo.map(tc => ({
          functionResponse: {
            name: tc.name,
            response: isStale ? summarizeStaleToolResult(tc.result) : tc.result
          }
        }))
      });

      if (msg.content) {
        contentsHistory.push({
          role: 'model',
          parts: [{ text: msg.content }]
        });
      }
      continue;
    }

    contentsHistory.push({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: msg.sender === 'user'
        ? buildUserParts(msg.content, msg.attachments)
        : [{ text: msg.content }]
    });
  }

  return contentsHistory;
}

/** 使用官方 @google/genai SDK 呼叫 generateContent */
async function generateContent(apiKey: string, modelName: string, body: Record<string, any>) {
  const ai = createGoogleGenAI(apiKey);
  const model = modelName.startsWith('models/') ? modelName : modelName;

  const response = await ai.models.generateContent({
    model,
    contents: body.contents,
    config: {
      systemInstruction: body.systemInstruction?.parts?.[0]?.text || undefined,
      tools: body.tools,
      toolConfig: body.toolConfig,
    }
  });

  return response;
}

function extractText(response: any): string {
  return (response?.candidates?.[0]?.content?.parts ?? [])
    .map((part: any) => part.text ?? '')
    .join('');
}

function extractGroundingMetadata(response: any): WebSearchGroundingMetadata | undefined {
  const rawMetadata = response.candidates?.[0]?.groundingMetadata;
  if (!rawMetadata) return undefined;

  const queries = rawMetadata.webSearchQueries || [];
  const chunks = rawMetadata.groundingChunks?.map((chunk: any) => ({
    title: chunk.web?.title,
    uri: chunk.web?.uri
  })) || [];

  if (queries.length === 0 && chunks.length === 0) return undefined;

  return {
    webSearchQueries: queries,
    groundingChunks: chunks
  };
}

export async function sendChatMessage({
  apiKey,
  modelName,
  systemPrompt,
  history,
  messageText,
  attachments = [],
  tools = [],
  toolHandlers = {},
  onActivity,
  enableGoogleSearch = false
}: SendMessageParams): Promise<{
  content: string;
  groundingMetadata?: WebSearchGroundingMetadata;
  toolCallsInfo?: Array<{ name: string; args: any; result: any }>;
}> {
  const contents = [
    ...buildContentsHistory(history),
    {
      role: 'user',
      parts: buildUserParts(messageText, attachments)
    }
  ];
  const executedToolCalls: Array<{ name: string; args: any; result: any }> = [];
  let response: any;
  let round = 0;

  while (true) {
    round += 1;
    onActivity?.(
      'thinking',
      round === 1
        ? '正在思考與推理回應內容…'
        : `正在整合工具結果，繼續推理…（第 ${round} 輪）`
    );
    response = await generateContent(apiKey, modelName, {
      contents,
      systemInstruction: { parts: [{ text: systemPrompt }] },
      tools: buildAlwaysOnTools(tools, enableGoogleSearch),
      toolConfig: { includeServerSideToolInvocations: true }
    });

    const modelContent = response.candidates?.[0]?.content;
    const functionCalls = (modelContent?.parts ?? [])
      .map((part: any) => part.functionCall)
      .filter((call: any) => call?.name && tools.some(tool => tool.name === call.name));

    if (functionCalls.length === 0) break;

    contents.push(modelContent);

    const functionResponses: any[] = [];
    for (const call of functionCalls) {
      const name = call.name ?? '';
      onActivity?.('tool', `正在執行工具「${name}」…`);
      const handlerResult = await executeTool(name, call.args, toolHandlers);

      executedToolCalls.push({
        name,
        args: call.args,
        result: handlerResult
      });

      functionResponses.push({
        functionResponse: {
          name,
          response: handlerResult
        }
      });
    }

    contents.push({ role: 'user', parts: functionResponses });
  }

  return {
    content: extractText(response),
    groundingMetadata: extractGroundingMetadata(response),
    toolCallsInfo: executedToolCalls.length > 0 ? executedToolCalls : undefined
  };
}
