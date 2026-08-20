# Agent App Hub

這是一套以 Google Gemini API 為核心的「AI Agent 應用」教學範例集合，取材自一套課程專案，並整理成乾淨、獨立、可公開發布的版本 —— 不含任何內部後端、gateway 或帳號登入機制，任何人拿到都能直接安裝執行。

每個範例都是一個獨立的 Agent App，展示 Gemini API 的不同能力（Function Calling、RAG 語意檢索、多模態、Live API 等），並共用同一套「浮動 AI 助理」殼層（`src/agent/`）與應用切換介面（`src/app-shell/`）。

## 包含的範例應用

| 路徑 | 名稱 | 說明 |
|---|---|---|
| `dashboard` | 首頁大廳 | 展示並啟動所有已註冊的 Agent App。 |
| `class02-ai-chat-assistant` | Gemini AI 互動助理 | 最基礎的 AI 對話助理示範，展示共用浮動 Agent 殼層的基本用法。 |
| `class03-camping-markdown` | 露營裝備客服（Markdown 商品清單） | 系統提示詞內嵌完整 Markdown 商品清單，展示純提示工程即可打造客服機器人。 |
| `class04-camping-tools-rag` | 露營裝備租賃 AI 小助手 | 結合 Function Calling 查詢商品，並用 RAG 語意檢索查詢服務規章。 |
| `class07-price-comparison` | 比價助手 | 自動搜尋商品、生成 HTML 比價報告，支援多版本比較與匯出 PDF。 |
| `class08-data-analysis` | 數據分析助理 | 透過唯讀 SQL 與報表工具連接資料庫 API，生成 Chart.js 視覺化分析報告。 |
| `class09-proposal` | AI 企劃書撰寫助手 | 對話式協助規劃大綱、逐節撰寫與修改，完成專業企劃書文件。 |
| `class10-live-assistance` | 即時協作助理 | 使用 Gemini Live API 即時看螢幕、預判意圖並主動提供支援的 AI Copilot。 |
| `class11-article-writer` | AI 網路圖文作家 | 議題研究、撰稿、生成封面圖與短影音宣傳素材的一站式編輯器。 |

## 如何執行

需求：Node.js（建議 20 以上）。

```bash
npm install
npm run dev
```

啟動後依終端機提示的網址（預設 `http://localhost:5173`）在瀏覽器開啟即可。

其他指令：

```bash
npm run build    # 型別檢查 + 測試 + 正式建置
npm run test     # 只跑測試
npm run lint     # 靜態檢查
```

## 設定 Gemini API Key

每個 Agent App 都需要一把你自己的 Google Gemini API Key 才能運作。Key **只會存放在瀏覽器的 localStorage**（`agent_hub_settings` 這個 key），不會被送到任何第三方伺服器 —— 所有請求都是瀏覽器直接呼叫 Google 的 Gemini API。

在畫面右下角開啟浮動的 AI 助理小工具，點擊其中的「設定」（齒輪圖示）即可貼上你的 API Key（對應原始碼中的 `src/agent/components/AgentSettingsPanel.tsx`，儲存邏輯位於 `src/agent/repositories/settingsRepository.ts`，全域狀態管理則在 `src/agent/context/AgentProvider.tsx`）。

你可以在 [Google AI Studio](https://aistudio.google.com/apikey) 免費取得一把 API Key。

## 如何開發一個新的 Agent App

新增一個 Agent App 不需要修改任何殼層路由設定 —— 在 `src/agent-apps/` 底下新增一個資料夾、放入一份 `agentAppManifest.ts`，殼層會透過 `import.meta.glob` 自動掃描並掛載路由（見 `src/config/agentAppRegistry.ts`）。刪除該資料夾即等於移除這個 App，同樣不需動到任何其他檔案。

### 1. Manifest：一個 App 的完整宣告

每個 App 的核心是一份符合 `AgentAppManifest`（定義於 `src/agent/types/agent.ts`）的物件，宣告這個 App 是誰、長什麼樣子、以及 Agent 能對它做什麼：

```ts
// src/agent-apps/my-app/agentAppManifest.ts
import type { AgentAppManifest } from '../../agent/types/agent';
import { MainPage } from './MainPage';
import { myAppTools } from './tools/myAppTools';

export const myAppManifest: AgentAppManifest = {
  agentAppId: 'my-app',          // 唯一 ID，同時作為 registerToolHandlers 生命週期 key
  agentAppName: '我的助手',        // 顯示於導覽列、Dashboard、瀏覽器分頁標題
  description: '一句話說明這個 App 在做什麼。',
  route: '/my-app',              // HashRouter 路由，需與資料夾邏輯無關、全站唯一
  systemPrompt: '你是……',        // 此 App 專屬的 System Prompt，會與殼層共用規則組合
  availableTools: myAppTools,    // 此路由啟用時，Agent 可呼叫的 Function Calling 工具清單
  MainView: MainPage,            // 路由對應渲染的頁面元件
  icon: 'hiking',                // Material Symbols 圖示名稱，顯示於 Dashboard 卡片與導覽選單
  sortOrder: 50,                 // Dashboard 卡片排序（數字小排前面）
};
```

其餘常用欄位：

| 欄位 | 用途 |
|---|---|
| `CardWidget` | Dashboard 首頁要顯示的自訂卡片元件；不提供則用預設卡片樣式 |
| `prepareSystemPrompt` | 在送出前非同步加工 System Prompt（例如注入即時資料） |
| `enableGoogleSearch` | 是否讓此 App 的對話啟用 Google 搜尋 grounding |
| `supportedUploads` | 是否允許上傳檔案 / 圖片 |
| `supportsRealtimeVoice` / `supportsVisionStream` / `supportsScreenStream` | 是否支援殼層提供的 Live 語音、視覺串流、螢幕分享能力 |
| `toolFollowups` | 依工具名稱附加「快速回覆按鈕」，工具成功執行後顯示在對話泡泡下方 |
| `toolDisplayNotes` | 工具被呼叫時，在對話泡泡顯示的一句話說明文字 |
| `exampleQuestions` | Dashboard 卡片上顯示的建議提問，幫助使用者快速上手 |
| `fullPage` | 跳出殼層置中版型，改用滿版無邊距版型（例如需要佔滿整個畫面的看板） |
| `courseId` / `slideDeck` / `slideNotes` | 教學情境的對應課程/投影片標記，純資訊用途，非必填 |

### 2. Agent 工具（Function Calling）機制

工具分兩層：**宣告**（給模型看的 schema）與**實作**（實際執行的 handler），兩者要能對得上名字。

**宣告**：`ToolDefinition`（`src/agent/types/agent.ts`）只有 `name` / `description` / `parameters`（JSON Schema），這是放進 `manifest.availableTools` 給 Gemini 的工具清單。`AgentTool`（`src/agent/types/tool.ts`）則是 `ToolDefinition` 再加上 `handler`，方便把 schema 和實作寫在同一個物件裡：

```ts
// src/agent-apps/my-app/tools/myAppTools.ts
import type { AgentTool, ToolResult } from '../../../agent/types/tool';

export const myAppTools: AgentTool[] = [
  {
    name: 'search_items',
    description: '依關鍵字搜尋商品。',
    parameters: {
      type: 'object',
      properties: { keyword: { type: 'string', description: '搜尋關鍵字' } },
      required: ['keyword'],
    },
    handler: (args): ToolResult => {
      try {
        return { ok: true, data: myService.search(String(args.keyword ?? '')) };
      } catch (err) {
        return { ok: false, error: `搜尋失敗：${(err as Error).message}` };
      }
    },
  },
];
```

`handler` 的慣例是回傳 `{ ok: boolean, data?, error? }`（`ToolResult`），並且**永遠 catch 例外**——丟出的例外會中斷整個對話流程，回傳 `{ ok: false, error }` 才能讓模型讀到失敗原因並自行決定下一步（重試、換句話、或誠實告知使用者）。金額計算、SQL 查詢等「必須精確」的邏輯要寫在 handler 裡由程式碼執行，不要期待模型自己心算或編造答案（可參考 `class04-camping-tools-rag` 的 `calculate_rental_price`）。

**掛載時機（重要）**：`manifest.availableTools` 只決定「使用者停留在這個路由時，工具*schema*會不會被送給模型」（見 `AppLayout.tsx` 依 `location.pathname` 對照 `agentAppRegistry` 呼叫 `setActiveTools`）。但實際的 `handler` 函式要在頁面元件掛載時，透過 `registerToolHandlers` 明確註冊 —— 這是因為 handler 常需要當下最新的 React state（例如使用者輸入的篩選條件）或 API Key，寫死在 manifest 裡拿不到：

```tsx
// src/agent-apps/my-app/MainPage.tsx
import { useEffect } from 'react';
import { useAgent } from '../../agent/hooks/useAgent';
import { myAppTools } from './tools/myAppTools';

export function MainPage() {
  const { registerToolHandlers } = useAgent();

  useEffect(() => {
    registerToolHandlers(Object.fromEntries(myAppTools.map((t) => [t.name, t.handler])));
    return () => registerToolHandlers({}); // 離開頁面時務必清空，避免殘留舊 handler
  }, [registerToolHandlers]);

  // ...
}
```

若工具需要即時資料（例如目前畫面上的篩選狀態），可搭配 `setRuntimeContext(...)` 把一段 JSON 字串注入到 System Prompt 裡（見 `class04-camping-tools-rag/MainPage.tsx` 的用法），讓 Agent 不用呼叫工具也能感知目前畫面狀態。

### 3. 殼層（Agent Shell）提供的機制

所有 App 共用同一個浮動 Agent 視窗（`src/agent/`），透過 `useAgent()`（`src/agent/hooks/useAgent.ts`）這個 Context Hook 存取，不需要、也不應該自己重造對話 UI、Session 儲存或 API 呼叫邏輯。常用能力：

| 能力 | 說明 |
|---|---|
| `settings` / `updateSettings` | 讀寫使用者的 API Key、模型選擇等設定（`src/agent/repositories/settingsRepository.ts`，存於 localStorage） |
| `sessions` / `currentSession` / `createNewSession` / `switchSession` / `deleteSession` | 多輪對話 Session 的 CRUD（`src/agent/repositories/sessionRepository.ts`） |
| `sendMessageText(text, attachments?)` | 送出一則使用者訊息，殼層會自動組合 System Prompt、掛上目前路由的工具、呼叫 Gemini API 並處理回覆 |
| `setUiState({ isOpened, zoomState, ... })` | 控制浮動視窗開關與縮放模式（`small` / `large` / `panel` / `drawer` / `fullscreen`） |
| `registerToolHandlers` / `toolHandlers` | 如上節所述，註冊/讀取目前生效的工具實作 |
| `setRuntimeContext` | 注入一段會隨每次對話帶入 System Prompt 的即時上下文字串 |
| `startRealtimeVoice` / `stopRealtimeVoice` / `sendLiveVideoFrame` / `sendLiveText` / `setLiveOverrides` | Gemini Live API 即時語音/視覺對話能力，需 manifest 宣告 `supportsRealtimeVoice`（可參考 `class10-live-assistance`） |
| `activateAgentApp(manifest, runtimeContext?)` | 手動切換目前生效的 App 情境（正常情況下 `AppLayout.tsx` 會依路由自動處理，通常不需自行呼叫） |

**System Prompt 是分層組合的**（見 `AgentProvider.tsx` 的 `buildFullSystemPrompt`）：使用者在設定面板填的全域提示詞 → 目前路由的 `manifest.systemPrompt` → 殼層固定注入的教學助教規則與範圍限制（`src/agent/context/systemPromptScope.ts`，只有 `dashboard` 首頁會被限制在課程主題內，其餘每個 App 內都是完全通用能力）→ `runtimeContext`。撰寫 `systemPrompt` 時只需專注在「這個 App 該怎麼回答」，不需要重複殼層已經處理好的規則。

### 4. 檢查清單

新增一個 Agent App 時建議依序確認：

1. `src/agent-apps/<app-id>/agentAppManifest.ts` 是否有唯一的 `agentAppId` 與 `route`
2. `MainView` 頁面是否透過 `useAgent()` 存取殼層狀態，而不是自己另外接一份 Gemini API 呼叫
3. 需要 Function Calling 時，`tools/*.ts` 的 `handler` 是否都有 try/catch、回傳 `ToolResult`
4. 頁面元件是否在 `useEffect` 裡 `registerToolHandlers(...)`，並在 cleanup 呼叫 `registerToolHandlers({})`
5. 是否補上對應的 `*.test.ts`（可參考既有 App 的測試風格，例如 `dataAnalysis.test.ts`、`priceComparison.test.ts`）
6. `npm run build` 是否通過（型別檢查 + 測試 + 正式建置一次到位）

## 關於 class08-data-analysis 的資料庫

`class08-data-analysis` 範例會呼叫一個公開的 Northwind 範例資料庫 REST API（`https://gemini.printii.com/northwind/api`），不需要你自行架設或啟動任何本機資料庫服務，開箱即用。

## License

本專案採用 [MIT License](./LICENSE)。
