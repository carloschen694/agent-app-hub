# Agent App Hub

以 Google Gemini API 為核心的 AI Agent 應用教學範例集合。純前端架構，無後端、無 gateway、無登入機制 —— 所有 Gemini API 呼叫都由瀏覽器直接發送給 Google，任何人拿到都能安裝即跑。

每個範例是一個獨立的 Agent App，展示 Gemini API 的不同能力（Function Calling、RAG 語意檢索、多模態、Live API 等），並共用同一套浮動 AI 助理殼層（`src/agent/`）與應用切換介面（`src/app-shell/`）。

## 包含的範例應用

| 路徑 | 名稱 | 展示能力 |
|---|---|---|
| `dashboard` | 首頁大廳 | 展示並啟動所有已註冊的 Agent App |
| `class02-ai-chat-assistant` | Gemini AI 互動助理 | 最基礎的對話助理，示範共用殼層的基本用法 |
| `class03-camping-markdown` | 露營裝備客服 | 系統提示詞內嵌 Markdown 商品清單，純提示工程打造客服機器人 |
| `class04-camping-tools-rag` | 露營裝備租賃小助手 | Function Calling 查商品 + RAG 語意檢索查服務規章 |
| `class07-price-comparison` | 比價助手 | 自動搜尋商品、生成 HTML 比價報告，支援匯出 PDF |
| `class08-data-analysis` | 數據分析助理 | 唯讀 SQL 與報表工具，生成 Chart.js 視覺化分析報告 |
| `class09-proposal` | AI 企劃書撰寫助手 | 對話式規劃大綱、逐節撰寫與修改企劃書文件 |
| `class10-live-assistance` | 即時協作助理 | Gemini Live API 即時看螢幕、預判意圖的 AI Copilot |
| `class11-article-writer` | AI 網路圖文作家 | 議題研究、撰稿、生成封面圖與短影音素材的一站式編輯器 |

## 執行

需求：Node.js 20 以上。

```bash
npm install
npm run dev      # http://localhost:5173
```

```bash
npm run build    # 型別檢查 + 測試 + 正式建置
npm run test     # 只跑測試
npm run lint     # 靜態檢查
```

## 顯示 / 隱藏 App

導覽列右上角的齒輪圖示（或直接開啟 `/#/settings/apps`）可進入顯示設定頁，個別開關要在導覽選單與首頁大廳出現的 App。首頁大廳（`dashboard`）一律顯示、無法隱藏。設定存於瀏覽器 `localStorage`（`agent_hub_hidden_apps`），只影響目前這台裝置，不會同步給其他人（對應原始碼 `src/shared/repositories/appVisibilityRepository.ts`、`src/app-shell/AppVisibilityPage.tsx`）。

## 環境變數設定

複製 `.env.example` 為 `.env` 並視需要填入：

| 變數 | 必要性 | 用途 |
|---|---|---|
| `VITE_GEMINI_API_KEY` | 選填 | Gemini API Key 的預設值。未設定時可在畫面右下角 AI 助理的設定面板貼上，一律只存放於瀏覽器 `localStorage`（`agent_hub_settings`），不會送到任何第三方伺服器 —— 對應原始碼 `src/agent/repositories/settingsRepository.ts`。可在 [Google AI Studio](https://aistudio.google.com/apikey) 免費取得。 |
| `VITE_GOOGLE_CLIENT_ID` | 選填，僅 `class10-live-assistance` 需要 | 串接 Google 聯絡人／行事曆／Gmail 的 OAuth Client ID。授權流程完全在瀏覽器端以 Google Identity Services 的 Token Client（implicit flow）完成 —— **不需要、也不應該設定 Client Secret**，此架構下用不到 Secret，放進前端專案只會造成外洩風險。在 [Google Cloud Console](https://console.cloud.google.com/apis/credentials) 建立「網頁應用程式」類型的 OAuth 用戶端即可取得。對應原始碼 `src/agent-apps/class10-live-assistance/services/googleAuthService.ts`。 |

兩個變數都是選填，不設定不影響其他 App 運作。

## 開發新的 Agent App

新增一個 App 不需修改任何殼層路由設定：在 `src/agent-apps/` 下新增資料夾並放入 `agentAppManifest.ts`，殼層透過 `import.meta.glob` 自動掃描掛載路由（`src/config/agentAppRegistry.ts`）。刪除資料夾即等於移除該 App。

### Manifest

核心是一份 `AgentAppManifest`（`src/agent/types/agent.ts`）物件：

```ts
// src/agent-apps/my-app/agentAppManifest.ts
import type { AgentAppManifest } from '../../agent/types/agent';
import { MainPage } from './MainPage';
import { myAppTools } from './tools/myAppTools';

export const myAppManifest: AgentAppManifest = {
  agentAppId: 'my-app',        // 唯一 ID，同時是 registerToolHandlers 的生命週期 key
  agentAppName: '我的助手',      // 顯示於導覽列、Dashboard、分頁標題
  description: '一句話說明用途。',
  route: '/my-app',            // HashRouter 路由，全站唯一
  systemPrompt: '你是……',      // 此 App 專屬 System Prompt，會與殼層規則組合
  availableTools: myAppTools,  // 此路由啟用時可用的 Function Calling 工具
  MainView: MainPage,          // 路由對應的頁面元件
  icon: 'hiking',              // Material Symbols 圖示名稱
  sortOrder: 50,               // Dashboard 卡片排序，數字小排前面
};
```

其餘欄位：

| 欄位 | 用途 |
|---|---|
| `CardWidget` | Dashboard 自訂卡片元件，不提供則用預設樣式 |
| `prepareSystemPrompt` | 送出前非同步加工 System Prompt（例如注入即時資料） |
| `enableGoogleSearch` | 是否啟用 Google 搜尋 grounding |
| `supportedUploads` | 是否允許上傳檔案／圖片 |
| `supportsRealtimeVoice` / `supportsVisionStream` / `supportsScreenStream` | 是否支援殼層的 Live 語音、視覺串流、螢幕分享 |
| `toolFollowups` | 依工具名稱附加快速回覆按鈕，工具成功後顯示 |
| `toolDisplayNotes` | 工具被呼叫時對話泡泡顯示的說明文字 |
| `exampleQuestions` | Dashboard 卡片上的建議提問 |
| `fullPage` | 跳出置中版型，改用滿版無邊距版型 |
| `courseId` / `slideDeck` / `slideNotes` | 教學情境標記，純資訊用途 |

### 工具（Function Calling）機制

工具分兩層：**宣告**（給模型看的 schema）與**實作**（實際執行的 handler），以 `name` 對應。

`ToolDefinition`（`src/agent/types/agent.ts`）只有 `name` / `description` / `parameters`（JSON Schema），放進 `manifest.availableTools`。`AgentTool`（`src/agent/types/tool.ts`）是 `ToolDefinition` 加上 `handler`：

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

規則：
- `handler` 一律回傳 `{ ok, data?, error? }`（`ToolResult`），並 catch 所有例外 —— 丟出例外會中斷整個對話流程，回傳 `{ ok: false, error }` 才能讓模型讀到失敗原因並自行決定下一步。
- 金額計算、SQL 查詢等需要精確結果的邏輯寫在 handler 裡由程式碼執行，不要讓模型自行心算或編造（參考 `class04-camping-tools-rag` 的 `calculate_rental_price`）。

**掛載時機**：`manifest.availableTools` 只決定路由啟用時工具 *schema* 是否送給模型（`AppLayout.tsx` 依 `location.pathname` 呼叫 `setActiveTools`）。實際 `handler` 要在頁面元件掛載時透過 `registerToolHandlers` 註冊，因為 handler 常需要當下最新的 React state 或 API Key：

```tsx
// src/agent-apps/my-app/MainPage.tsx
import { useEffect } from 'react';
import { useAgent } from '../../agent/hooks/useAgent';
import { myAppTools } from './tools/myAppTools';

export function MainPage() {
  const { registerToolHandlers } = useAgent();

  useEffect(() => {
    registerToolHandlers(Object.fromEntries(myAppTools.map((t) => [t.name, t.handler])));
    return () => registerToolHandlers({}); // 離開頁面務必清空
  }, [registerToolHandlers]);

  // ...
}
```

需要即時畫面狀態時（例如目前的篩選條件），用 `setRuntimeContext(...)` 注入一段 JSON 字串到 System Prompt，讓 Agent 不呼叫工具也能感知目前狀態（參考 `class04-camping-tools-rag/MainPage.tsx`）。

### 殼層提供的機制

所有 App 共用同一個浮動 Agent 視窗（`src/agent/`），經 `useAgent()`（`src/agent/hooks/useAgent.ts`）存取，不應自行重造對話 UI、Session 儲存或 API 呼叫邏輯：

| 能力 | 說明 |
|---|---|
| `settings` / `updateSettings` | 讀寫 API Key、模型選擇等設定（`settingsRepository.ts`，存於 localStorage） |
| `sessions` / `currentSession` / `createNewSession` / `switchSession` / `deleteSession` | 多輪對話 Session 的 CRUD（`sessionRepository.ts`） |
| `sendMessageText(text, attachments?)` | 送出使用者訊息，殼層自動組合 System Prompt、掛上目前路由工具、呼叫 Gemini API 並處理回覆 |
| `setUiState({ isOpened, zoomState, ... })` | 控制浮動視窗開關與縮放模式（`small` / `large` / `panel` / `drawer` / `fullscreen`） |
| `registerToolHandlers` / `toolHandlers` | 註冊／讀取目前生效的工具實作 |
| `setRuntimeContext` | 注入隨每次對話帶入 System Prompt 的即時上下文字串 |
| `startRealtimeVoice` / `stopRealtimeVoice` / `sendLiveVideoFrame` / `sendLiveText` / `setLiveOverrides` | Gemini Live API 即時語音／視覺對話，需 manifest 宣告 `supportsRealtimeVoice`（參考 `class10-live-assistance`） |
| `activateAgentApp(manifest, runtimeContext?)` | 手動切換目前生效的 App 情境；一般由 `AppLayout.tsx` 依路由自動處理，通常不需自行呼叫 |

System Prompt 分層組合（`AgentProvider.tsx` 的 `buildFullSystemPrompt`）：全域設定 → 目前路由的 `manifest.systemPrompt` → 殼層固定規則（`systemPromptScope.ts`；只有 `dashboard` 首頁被限制在課程主題內，其餘每個 App 皆為通用能力）→ `runtimeContext`。撰寫 `systemPrompt` 時只需處理「這個 App 該怎麼回答」，殼層規則不必重複。

### 新增 App 檢查清單

1. `agentAppManifest.ts` 有唯一的 `agentAppId` 與 `route`
2. `MainView` 透過 `useAgent()` 存取殼層狀態，不自行另接 Gemini API
3. 每個工具 `handler` 都有 try/catch，回傳 `ToolResult`
4. 頁面元件在 `useEffect` 呼叫 `registerToolHandlers(...)`，並在 cleanup 呼叫 `registerToolHandlers({})`
5. 補上對應的 `*.test.ts`（參考 `dataAnalysis.test.ts`、`priceComparison.test.ts`）
6. `npm run build` 通過

## License

[MIT License](./LICENSE)
