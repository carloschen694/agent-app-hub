import type { ToolDefinition } from '../../../agent/types/agent';
import type { ToolHandler } from '../../../agent/types/tool';
import { getPipState, hidePipContent, resizePipWindow, showPipContent } from '../services/pipService';
import type { PipPromptOption } from '../types/pip';

const HTML_GUIDANCE =
  '完整的 HTML5 片段，會在浮動視窗的沙盒 iframe 中執行，可以寫 <style> 與 <script>。\n' +
  '【浮動視窗 Mobile App UI/UX 設計與視覺呈現硬性規範】\n' +
  '1. Mobile-First 尺寸與佈局：浮動視窗寬度固定約 360px，採用 Mobile-First 單欄流體卡片佈局 (flex flex-col space-y-3)。\n' +
  '2. 觸控與點擊目標 (Touch Targets)：點擊目標與按鈕高度至少 44px (min-h-[44px], px-4 py-2.5)，便於點擊操作。\n' +
  '3. 明亮模式 (Light Mode Only)：一律使用純白或極淺色背景 (如 #ffffff, #f8fafc)，搭配高對比深色文字 (#0f172a / #334155)。嚴禁使用暗色／黑底夜間模式 (Dark Mode) 設計。\n' +
  '4. 多圖少字與視覺化：優先使用美觀的圖片 (img)、豐富圖示 (Material Symbols `<span class="material-symbols-outlined">icon</span>` / iconfont)、豐富 Emoji (✨, 📊, 🚀, 💡, 🏷️) 與 SVG/D3.js 圖表。極力避免長篇大論的大段純文字牆。\n' +
  '5. 資訊精要精確：內容必須精簡扼要，以實際具體數字、明確結論與可點擊連結 (target="_blank") 為主，主次分明。\n' +
  '6. 互動卡片與底部操作列：善用質感卡片 (.card)、Segmented Controls、狀態標籤 (Status Badges) 與底部黏性操作列 (Bottom Sticky Bar)，提供極致舒適、易讀與直覺的介面視覺設計。\n' +
  '7. 通用第三方嵌入 (Universal Embeds)：完整支援第三方媒體嵌入，如 YouTube 影片 (`<iframe src="https://www.youtube.com/embed/...">`)、Sketchfab 3D 模型 (`<iframe src="https://sketchfab.com/models/.../embed">`)、Spotify/Google Maps 等，系統已開啟全權限相容，可直接嵌入！';

export const pipToolDefinitions: ToolDefinition[] = [
  {
    name: 'showPipWindow',
    description:
      '把內容顯示到浮動視窗（Picture-in-Picture）。這是你對主人呈現資訊的主要管道 —— 回答問題、搜尋結果、翻譯結果都應該送到這裡。layout 用 content 顯示唯讀資訊；用 prompt 時可以附輸入框與選項按鈕向主人提問。注意：浮動視窗必須由主人親手開啟，若尚未開啟，你的內容會被暫存並提示主人開窗。',
    parameters: {
      type: 'OBJECT',
      properties: {
        layout: {
          type: 'STRING',
          description: "'content' 顯示資訊；'prompt' 詢問主人並提供選項",
          enum: ['content', 'prompt']
        },
        html: { type: 'STRING', description: HTML_GUIDANCE },
        message: { type: 'STRING', description: 'prompt 版型：要問主人的話' },
        options: {
          type: 'ARRAY',
          description: 'prompt 版型：選項按鈕，最多 3 個',
          items: {
            type: 'OBJECT',
            properties: {
              label: { type: 'STRING', description: '按鈕上的文字' },
              value: { type: 'STRING', description: '主人點下後回傳給你的內容' }
            },
            required: ['label', 'value']
          }
        },
        showInput: { type: 'BOOLEAN', description: 'prompt 版型：是否顯示自由輸入框' },
        inputPlaceholder: { type: 'STRING', description: '輸入框的提示文字' },
        width: { type: 'NUMBER', description: '視窗寬度（240–800）' },
        height: { type: 'NUMBER', description: '視窗高度（200–900）' },
        replace: {
          type: 'BOOLEAN',
          description:
            '預設 true 直接取代現有內容。主動提示（主人沒有開口詢問）時務必傳 false —— 這樣不會蓋掉主人正在看的東西，只會亮起紅點提醒。'
        }
      },
      required: ['layout']
    }
  },
  {
    name: 'updatePipContent',
    description:
      '更新浮動視窗的內容。與 showPipWindow 的差別是這個工具不會改變視窗尺寸。主動推送新資訊時記得傳 replace: false。',
    parameters: {
      type: 'OBJECT',
      properties: {
        html: { type: 'STRING', description: HTML_GUIDANCE },
        replace: {
          type: 'BOOLEAN',
          description: 'false 時保留現有內容並亮紅點，等主人自己關掉後才換上新內容'
        }
      },
      required: ['html']
    }
  },
  {
    name: 'hidePipWindow',
    description:
      '清空浮動視窗的內容（視窗本身保持開啟，因為重新開窗需要主人再操作一次）。主人說「知道了」「關掉吧」時使用。',
    parameters: { type: 'OBJECT', properties: {} }
  }
];

const asOptions = (value: unknown): PipPromptOption[] | undefined =>
  Array.isArray(value)
    ? value
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
        .filter(item => typeof item.label === 'string' && typeof item.value === 'string')
        .slice(0, 3)
        .map(item => ({ label: item.label as string, value: item.value as string }))
    : undefined;

const describeResult = (result: { shown: boolean; badged: boolean; pending: boolean }) => {
  if (result.pending) {
    return '浮動視窗尚未開啟，內容已暫存。請提醒主人到主畫面按「開啟浮動視窗」，開啟後會立刻顯示。';
  }
  if (result.badged) {
    return '主人正在看的內容沒有被蓋掉，浮動視窗右上角已亮起紅點提醒。不要再重複推送同一件事。';
  }
  return '內容已顯示在浮動視窗。請只用一兩句話口頭摘要重點，不要把內容整段唸出來。';
};

export function createPipToolHandlers(): Record<string, ToolHandler> {
  return {
    showPipWindow: (args) => {
      if (typeof args.width === 'number' || typeof args.height === 'number') {
        const state = getPipState();
        resizePipWindow(
          typeof args.width === 'number' ? args.width : state.width,
          typeof args.height === 'number' ? args.height : state.height
        );
      }

      const layout = args.layout === 'prompt' ? 'prompt' : 'content';
      const result = showPipContent(
        {
          layout,
          html: args.html as string | undefined,
          message: args.message as string | undefined,
          options: asOptions(args.options),
          showInput: Boolean(args.showInput),
          inputPlaceholder: args.inputPlaceholder as string | undefined
        },
        { replace: args.replace !== false }
      );

      return { ...result, note: describeResult(result) };
    },

    updatePipContent: (args) => {
      const result = showPipContent(
        { layout: 'content', html: args.html as string },
        { replace: args.replace !== false }
      );
      return { ...result, note: describeResult(result) };
    },

    hidePipWindow: () => {
      hidePipContent();
      return { hidden: true, note: '浮動視窗內容已清空，視窗仍保持開啟。' };
    }
  };
}
