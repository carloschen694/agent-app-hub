import type { ToolDefinition } from '../../../agent/types/agent';
import type { ToolHandler } from '../../../agent/types/tool';
import { memoryRepository } from '../repositories/memoryRepository';
import { liveAssistanceStore } from '../store/liveAssistanceStore';
import type { LongTermCategory } from '../types/memory';

const CATEGORY_ENUM = ['identity', 'goal', 'domain', 'preference', 'solved'];

export const memoryToolDefinitions: ToolDefinition[] = [
  {
    name: 'saveLongTermMemory',
    description:
      '把「關於主人、且長期不太會變」的事實寫進長程記憶，下次開新對話仍然記得。例如姓名、生日、職稱、主要目標、服務領域、領域知識、領域模型，以及你曾協助解決過的問題。同一個 key 會覆寫舊值。切勿把當下的暫時狀況寫進來（那是短程記憶）。',
    parameters: {
      type: 'OBJECT',
      properties: {
        category: { type: 'STRING', description: '分類', enum: CATEGORY_ENUM },
        key: { type: 'STRING', description: '這則記憶的名稱，例如「姓名」「主要專案」' },
        value: { type: 'STRING', description: '記憶內容' },
        confidence: {
          type: 'NUMBER',
          description: '0–1 的把握程度。主人親口說的填 1，你推測的填 0.5 左右。低於既有值時不會覆寫。'
        }
      },
      required: ['category', 'key', 'value']
    }
  },
  {
    name: 'saveShortTermMemory',
    description:
      '記下「現在正在發生」的事，例如主人此刻在做的工作、目前的焦點、正在處理的問題。只存活於本次工作階段，不會帶到下一次對話。同一個 topic 會被新的內容取代。',
    parameters: {
      type: 'OBJECT',
      properties: {
        topic: { type: 'STRING', description: '主題，例如「目前任務」「正在處理的問題」' },
        detail: { type: 'STRING', description: '內容' }
      },
      required: ['topic', 'detail']
    }
  },
  {
    name: 'queryMemory',
    description: '讀取目前的長程與短程記憶。回答與主人本人、他的專案或偏好有關的問題前應先查詢。',
    parameters: {
      type: 'OBJECT',
      properties: {
        scope: { type: 'STRING', description: "'long'、'short' 或 'all'（預設）", enum: ['long', 'short', 'all'] }
      }
    }
  },
  {
    name: 'consolidateMemory',
    description:
      '把本次工作階段中值得長期保留的結論昇華成長程記憶，並清空短程記憶。主人說「今天到這」「先這樣」，或一段工作明確告一段落時使用。',
    parameters: {
      type: 'OBJECT',
      properties: {
        entries: {
          type: 'ARRAY',
          description: '要保留下來的長期事實',
          items: {
            type: 'OBJECT',
            properties: {
              category: { type: 'STRING', description: '分類', enum: CATEGORY_ENUM },
              key: { type: 'STRING', description: '記憶名稱' },
              value: { type: 'STRING', description: '記憶內容' },
              confidence: { type: 'NUMBER', description: '0–1 的把握程度' }
            },
            required: ['category', 'key', 'value']
          }
        }
      },
      required: ['entries']
    }
  }
];

const isCategory = (value: unknown): value is LongTermCategory =>
  typeof value === 'string' && CATEGORY_ENUM.includes(value);

export interface MemoryToolDeps {
  getSessionId: () => string | undefined;
}

export function createMemoryToolHandlers(deps: MemoryToolDeps): Record<string, ToolHandler> {
  return {
    saveLongTermMemory: (args) => {
      if (!isCategory(args.category)) {
        return { saved: false, reason: `category 必須是 ${CATEGORY_ENUM.join(' / ')} 其中之一。` };
      }
      const { memory, applied } = memoryRepository.saveLongTerm({
        category: args.category,
        key: args.key as string,
        value: args.value as string,
        confidence: typeof args.confidence === 'number' ? args.confidence : undefined,
        sourceSessionId: deps.getSessionId()
      });
      liveAssistanceStore.emit('memory-changed');
      return applied
        ? { saved: true, id: memory.id, key: memory.key }
        : {
            saved: false,
            reason: `已有把握度更高的記憶「${memory.key}：${memory.value}」，未覆寫。若確定要改，請提高 confidence。`
          };
    },

    saveShortTermMemory: (args) => {
      const memory = memoryRepository.saveShortTerm(args.topic as string, args.detail as string);
      liveAssistanceStore.emit('memory-changed');
      return { saved: true, id: memory.id, topic: memory.topic };
    },

    queryMemory: (args) => {
      const scope = args.scope ?? 'all';
      return {
        longTerm:
          scope === 'short'
            ? undefined
            : memoryRepository.listLongTerm().map(m => ({
                id: m.id,
                category: m.category,
                key: m.key,
                value: m.value,
                confidence: m.confidence
              })),
        shortTerm:
          scope === 'long'
            ? undefined
            : memoryRepository.listShortTerm().map(m => ({ topic: m.topic, detail: m.detail }))
      };
    },

    consolidateMemory: (args) => {
      const entries = Array.isArray(args.entries)
        ? args.entries
            .filter((item: unknown): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
            .filter(item => isCategory(item.category) && typeof item.key === 'string' && typeof item.value === 'string')
            .map(item => ({
              category: item.category as LongTermCategory,
              key: item.key as string,
              value: item.value as string,
              confidence: typeof item.confidence === 'number' ? item.confidence : undefined
            }))
        : [];

      if (!entries.length) {
        return { consolidated: false, reason: 'entries 至少要有一筆有效的長期事實。' };
      }

      const saved = memoryRepository.consolidate(entries, deps.getSessionId());
      liveAssistanceStore.emit('memory-changed');
      return { consolidated: true, count: saved.length, note: '短程記憶已清空。' };
    }
  };
}
