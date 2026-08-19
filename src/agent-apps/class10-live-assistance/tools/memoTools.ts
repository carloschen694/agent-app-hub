import type { ToolDefinition } from '../../../agent/types/agent';
import type { ToolHandler } from '../../../agent/types/tool';
import { memoRepository, saveScreenshot } from '../repositories/memoRepository';
import { buildMarkdownReport } from '../services/memoExportService';
import { showPipContent } from '../services/pipService';
import { liveAssistanceStore } from '../store/liveAssistanceStore';
import type { Memo } from '../types/memo';

const TODO_SCHEMA = {
  type: 'ARRAY',
  description: '待辦事項清單',
  items: {
    type: 'OBJECT',
    properties: {
      text: { type: 'STRING', description: '待辦內容' },
      done: { type: 'BOOLEAN', description: '是否已完成，預設 false' }
    },
    required: ['text']
  }
};

const SOURCE_SCHEMA = {
  type: 'ARRAY',
  description: '資料來源連結。使用 Google 搜尋作答時必填，且每個連結都必須真的支撐內文的論點。',
  items: {
    type: 'OBJECT',
    properties: {
      url: { type: 'STRING', description: '完整網址' },
      title: { type: 'STRING', description: '該頁標題' }
    },
    required: ['url']
  }
};

export const memoToolDefinitions: ToolDefinition[] = [
  {
    name: 'createMemo',
    description:
      '建立一則新的 memo 筆記。主人說「幫我記一下」「這個存起來」「整理成筆記」，或你整理出值得保存的資料時使用。summary 會顯示在列表卡片上，務必寫得能一眼看懂。',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'memo 標題，簡短具體' },
        summary: { type: 'STRING', description: '一到兩句的摘要，顯示在 memo 卡片上' },
        content: { type: 'STRING', description: 'memo 正文，可使用 Markdown' },
        translation: { type: 'STRING', description: '若內容是翻譯結果，放在這裡' },
        type: {
          type: 'STRING',
          description: "筆記類型：'text' 一般筆記, 'html' 互動小工具/程式",
          enum: ['text', 'html']
        },
        htmlContent: { type: 'STRING', description: '當 type=html 時，寫入可互動的 HTML5 原始碼' },
        tags: { type: 'ARRAY', description: '標籤', items: { type: 'STRING' } },
        todos: TODO_SCHEMA,
        sourceUrls: SOURCE_SCHEMA,
        attachLastScreenshot: {
          type: 'BOOLEAN',
          description: '是否把最近一次 captureScreen 擷取的畫面附進這則 memo'
        }
      },
      required: ['title', 'summary']
    }
  },
  {
    name: 'loadMemoToPip',
    description:
      '將先前儲存的 HTML Memo (小程序/小工具卡片) 重新加載回浮動視窗 (PIP Window) 中顯示與互動。當主人說「幫我打開之前做的計算機/小程序」「把那個小工具叫出來」時使用。',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: { type: 'STRING', description: '要載入的 Memo ID' },
        query: { type: 'STRING', description: '若不知道 ID，可輸入 Memo 標題關鍵字搜尋' }
      }
    }
  },
  {
    name: 'updateMemo',
    description:
      '更新既有 memo。只會覆寫你有傳入的欄位，其餘保留。注意：userNote 是主人自己寫的備註，除非主人明確要求，否則絕對不要覆寫。',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: { type: 'STRING', description: '要更新的 memo id' },
        title: { type: 'STRING', description: '新標題' },
        summary: { type: 'STRING', description: '新摘要' },
        content: { type: 'STRING', description: '新正文' },
        translation: { type: 'STRING', description: '新翻譯內容' },
        tags: { type: 'ARRAY', description: '完整的新標籤清單', items: { type: 'STRING' } },
        todos: TODO_SCHEMA,
        sourceUrls: SOURCE_SCHEMA,
        attachLastScreenshot: {
          type: 'BOOLEAN',
          description: '是否把最近一次 captureScreen 擷取的畫面附加到這則 memo'
        }
      },
      required: ['id']
    }
  },
  {
    name: 'queryMemos',
    description:
      '搜尋主人的 memo。回答問題前應先查這裡，主人過去交代或保存過的資訊都在這。不給 query 時回傳最近的 memo。',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: '關鍵字，可用空白分隔多個詞（需全部命中）' },
        tags: { type: 'ARRAY', description: '同時篩選標籤', items: { type: 'STRING' } },
        limit: { type: 'NUMBER', description: '最多回傳幾則，預設 10' }
      }
    }
  },
  {
    name: 'deleteMemo',
    description: '刪除一則 memo。刪除無法復原，執行前務必先向主人確認。',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: { type: 'STRING', description: '要刪除的 memo id' }
      },
      required: ['id']
    }
  },
  {
    name: 'getMemoById',
    description: '依據 Memo ID 取得完整的 Memo 詳細內容（包含內文 content、翻譯、來源連結與待辦事項）。',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: { type: 'STRING', description: '要查詢的 Memo ID' }
      },
      required: ['id']
    }
  },
  {
    name: 'exportMarkdownReport',
    description:
      '把多則 memo 整理成一份 Markdown 工作摘要報告，顯示在主畫面供主人複製或下載。不給 memoIds 時匯出全部。',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: '報告標題' },
        memoIds: { type: 'ARRAY', description: '要納入的 memo id', items: { type: 'STRING' } }
      }
    }
  }
];

export interface MemoToolDeps {
  /** Returns the data URL of the most recent capture, if any. */
  getLastScreenshot: () => string | null;
}

const asStringArray = (value: unknown): string[] | undefined =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : undefined;

const asTodos = (value: unknown) =>
  Array.isArray(value)
    ? value
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
        .filter(item => typeof item.text === 'string')
        .map(item => ({ text: item.text as string, done: Boolean(item.done) }))
    : undefined;

const asSources = (value: unknown) =>
  Array.isArray(value)
    ? value
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
        .filter(item => typeof item.url === 'string')
        .map(item => ({ url: item.url as string, title: (item.title as string) ?? '' }))
    : undefined;

/** Trimmed shape returned to the model — full content would bloat context. */
const toDigest = (memo: Memo) => ({
  id: memo.id,
  title: memo.title,
  summary: memo.summary,
  tags: memo.tags,
  openTodos: memo.todos.filter(todo => !todo.done).map(todo => todo.text),
  hasScreenshot: memo.screenshotIds.length > 0,
  updatedAt: new Date(memo.updatedAt).toISOString()
});

export function createMemoToolHandlers(deps: MemoToolDeps): Record<string, ToolHandler> {
  const attachScreenshotIfAsked = async (args: Record<string, unknown>): Promise<string[]> => {
    if (!args.attachLastScreenshot) return [];
    const shot = deps.getLastScreenshot();
    if (!shot) return [];
    return [await saveScreenshot(shot)];
  };

  return {
    createMemo: async (args) => {
      const screenshotIds = await attachScreenshotIfAsked(args);
      const memo = memoRepository.create({
        title: args.title as string,
        summary: args.summary as string,
        content: (args.content as string) ?? '',
        translation: args.translation as string | undefined,
        tags: asStringArray(args.tags) ?? [],
        todos: asTodos(args.todos) ?? [],
        sourceUrls: asSources(args.sourceUrls),
        screenshotIds
      });
      liveAssistanceStore.emit('memos-changed');
      return { created: true, id: memo.id, title: memo.title };
    },

    updateMemo: async (args) => {
      const id = args.id as string;
      const existing = memoRepository.get(id);
      if (!existing) return { updated: false, reason: `找不到 id 為 ${id} 的 memo。` };

      const newScreenshots = await attachScreenshotIfAsked(args);
      const patch: Parameters<typeof memoRepository.update>[1] = {};
      if (typeof args.title === 'string') patch.title = args.title;
      if (typeof args.summary === 'string') patch.summary = args.summary;
      if (typeof args.content === 'string') patch.content = args.content;
      if (typeof args.translation === 'string') patch.translation = args.translation;
      const tags = asStringArray(args.tags);
      if (tags) patch.tags = tags;
      const todos = asTodos(args.todos);
      if (todos) patch.todos = todos;
      const sources = asSources(args.sourceUrls);
      if (sources) patch.sourceUrls = sources;
      if (newScreenshots.length) {
        patch.screenshotIds = [...existing.screenshotIds, ...newScreenshots];
      }

      const memo = memoRepository.update(id, patch);
      liveAssistanceStore.emit('memos-changed');
      return { updated: Boolean(memo), id, title: memo?.title };
    },

    queryMemos: (args) => {
      const limit = typeof args.limit === 'number' ? Math.min(args.limit, 30) : 10;
      const results = memoRepository
        .search((args.query as string) ?? '', asStringArray(args.tags))
        .slice(0, limit);
      return { count: results.length, memos: results.map(toDigest) };
    },

    getMemoById: (args) => {
      const memo = memoRepository.get(args.id as string);
      if (!memo) return { found: false, reason: `找不到 id 為 ${args.id} 的 memo。` };
      return { found: true, memo };
    },

    loadMemoToPip: (args) => {
      let target = args.id ? memoRepository.get(args.id as string) : undefined;
      if (!target && args.query) {
        const results = memoRepository.search(args.query as string);
        target = results.find(m => m.type === 'html' || Boolean(m.htmlContent));
      }
      if (!target) return { success: false, reason: '找不到對應的 HTML Memo' };

      const html = target.htmlContent || target.content;
      showPipContent({
        html,
        title: target.title,
        layout: 'content'
      });
      return { success: true, message: `已將「${target.title}」加載至浮動視窗` };
    },

    deleteMemo: async (args) => {
      const removed = await memoRepository.remove(args.id as string);
      liveAssistanceStore.emit('memos-changed');
      return removed
        ? { deleted: true, id: args.id }
        : { deleted: false, reason: `找不到 id 為 ${args.id} 的 memo。` };
    },

    exportMarkdownReport: (args) => {
      const ids = asStringArray(args.memoIds);
      const all = memoRepository.list();
      const selected = ids?.length ? all.filter(memo => ids.includes(memo.id)) : all;
      const title = (args.title as string) || '工作摘要';
      const markdown = buildMarkdownReport(selected, title);
      liveAssistanceStore.emit('report-ready', { markdown, title });
      return {
        generated: true,
        memoCount: selected.length,
        note: '報告已顯示在主畫面，主人可以直接複製或下載。請只用一兩句話口頭告知即可，不要把整份報告唸出來。'
      };
    }
  };
}
