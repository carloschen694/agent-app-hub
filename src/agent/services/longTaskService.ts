import type { ToolDefinition } from '../types/agent';
import type { AgentTask } from '../types/task';

export const MAX_PLANNED_TASKS = 10;

/**
 * Built-in tool the model calls when a request is too large to complete in a
 * single response. The host app then executes the sub-tasks one by one and
 * aggregates the results into a final answer.
 */
export const PLAN_LONG_TASKS_TOOL: ToolDefinition = {
  name: 'planLongTasks',
  description:
    '當使用者的請求規模太大、無法在單次回應的 token 容量內完成時（例如需要分段蒐集大量資料、逐項研究多個主題、產出長篇內容），呼叫此工具把工作拆分成多個可依序執行的子任務。系統會逐一執行每個子任務、蒐集結果，全部完成後再彙整成最終回覆提交給使用者。每個子任務的產出都應該能在單次回應內完成。簡單、單步就能回答的問題絕對不要使用此工具。',
  parameters: {
    type: 'object',
    properties: {
      objective: {
        type: 'string',
        description: '整體目標的一句話描述（語音對談中必填；文字對談可省略，系統會用使用者原始訊息）'
      },
      tasks: {
        type: 'array',
        description: `依執行順序排列的子任務清單（最多 ${MAX_PLANNED_TASKS} 個）。`,
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: '子任務的簡短標題' },
            description: {
              type: 'string',
              description: '子任務要做什麼、預期產出什麼的具體說明'
            }
          },
          required: ['title']
        }
      }
    },
    required: ['tasks']
  }
};

export const LONG_TASK_PROTOCOL_PROMPT = `
---
LONG TASK PROTOCOL:
如果你判斷使用者的請求太大，單次回應無法完整處理（資訊量會超過一次輸出的 token 容量），
請呼叫 planLongTasks 工具，把工作拆分成多個依序執行的子任務。
系統會逐一執行子任務並在最後要求你彙整提交。呼叫工具後，請簡短告知使用者你的拆分計畫即可，不要開始執行內容。
語音對談中也適用：呼叫 planLongTasks（務必附上 objective），系統會在背景執行，進度與最終結果會顯示在聊天視窗；你只需口頭告知使用者可打開聊天視窗查看進度。
簡單問題請直接回答，不要呼叫 planLongTasks。`;

export function buildTaskExecutionPrompt(
  objective: string,
  task: AgentTask,
  taskIndex: number,
  totalTasks: number,
  previousResults: Array<{ title: string; result: string }>
): string {
  const previousSection =
    previousResults.length > 0
      ? `\n\n先前子任務的結果（僅供參考與銜接，不要重複內容）：\n${previousResults
          .map((item, index) => `【任務 ${index + 1}：${item.title}】\n${item.result}`)
          .join('\n\n')}`
      : '';

  return `你正在執行一個長任務計畫中的子任務。

整體目標：${objective}

目前子任務（第 ${taskIndex + 1}/${totalTasks} 個）：${task.title}
${task.description ? `說明：${task.description}` : ''}${previousSection}

請只執行並輸出「目前子任務」的成果，內容完整但不要超出此子任務範圍，也不要輸出開場白或總結整個計畫。`;
}

export function buildAggregationPrompt(
  objective: string,
  results: Array<{ title: string; result: string; failed?: boolean }>
): string {
  return `所有子任務已執行完畢。請根據以下各子任務的結果，彙整出一份完整、連貫的最終回覆提交給使用者。

整體目標：${objective}

${results
    .map(
      (item, index) =>
        `【任務 ${index + 1}：${item.title}${item.failed ? '（執行失敗）' : ''}】\n${item.result}`
    )
    .join('\n\n')}

請直接輸出最終彙整結果；若有子任務失敗，請在結尾註明缺漏的部分。`;
}
