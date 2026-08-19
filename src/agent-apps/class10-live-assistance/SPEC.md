# 即時協作助理 — 軟體規格（class10-live-assistance）

> 對應 `class10/slides/slide.md` Slide 09 的需求提示詞：本文件即該提示詞要求產出的六項規格
> （使用者流程 / UI 狀態 / memo note 資料格式 / Workspace 資料來源 / AI 能力清單 / 驗收清單）。

## 0. 產品定位

一個會**主動**留意主人螢幕、預判意圖、在低干擾的時機提供支援的 Copilot。它不是等人開口的問答機器人：
它持續觀察主人在做什麼、學習主人是誰，並用學到的一切先一步把可能用得上的東西準備好。

---

## 1. 使用者流程

### 1.1 首次啟動
1. 進入 `/class10-live-assistance`。
2. 在殼層的 Agent 設定填入 API 金鑰（沒有金鑰時，主動觀察與語音都會被擋下並提示）。
3. 到「設定」分頁選個性與聲音模型。
4. 按「開始螢幕分享」→ 瀏覽器要求授權 → 選擇要分享的螢幕。
5. 按「開啟浮動視窗」→ 出現常駐最上層的 PiP 視窗。
   （這一步**必須**由主人親自點擊，瀏覽器規定 Document PiP 只能由使用者手勢開啟。）
6. 按「開始主動觀察」→ 助理開始週期性讀取畫面。

### 1.2 六種工作情境

| # | 情境 | 觸發 | 流程 |
|---|---|---|---|
| 1 | 回答問題 | 主人語音或文字提問 | 判斷用 Google 搜尋 / `queryMemos` / 記憶 → `showPipWindow` 呈現 HTML 答案 → 語音只講一兩句重點 |
| 2 | 主動提示 | 觀察者迴圈判定值得提示 | `showPipWindow(replace:false)` → 若視窗已有內容則**不覆蓋**，只在右上角亮紅點 |
| 3 | 幫我搜尋 | 「幫我查…」 | **禁止**憑記憶作答 → Google 搜尋 → 自我檢查每個 URL 是否真的支撐結論 → PiP 呈現「摘要 + 媒體 + 可點擊來源」 |
| 4 | 幫我翻譯 | 「這段翻成中文」 | `captureScreen(mode:'focus')` 取原始像素裁切圖 → 翻譯 → PiP 顯示譯文 + 語音朗讀 |
| 5 | 需要幫忙嗎 | 觀察者偵測到卡關訊號 | `showPipWindow(layout:'prompt')` 以「觀察 → 建議 → 行動」三段式詢問 → 得到同意才動手 |
| 6 | 匯出報告 | 「整理成工作摘要」 | `exportMarkdownReport` → 主畫面「報告」分頁顯示 → 可複製或下載 `.md` |

### 1.3 對話結束
主人說「今天到這」時，助理呼叫 `consolidateMemory` 把本次值得長期保留的結論昇華為長程記憶，並清空短程記憶。

---

## 2. UI 狀態

### 2.1 主畫面（`fullPage: true`）

**狀態列（永遠可見）** — 三顆燈直接回答「助理現在到底有沒有在看／在聽／找得到我」：

| 燈 | 亮（綠、脈動） | 暗（灰） |
|---|---|---|
| 螢幕分享 | `getDisplayMedia` 串流存活中 | 未授權或已停止 |
| 主動觀察 | 觀察迴圈執行中（並顯示最近一次觀察時間） | 未啟動 |
| 語音對談 | Live session 連線中 | 未連線 |

四個按鈕：開始/停止螢幕分享、開始/停止主動觀察（需先有螢幕分享）、語音對談、開啟浮動視窗
（有暫存內容未顯示時，此按鈕加琥珀色外框並改字為「助理有話要說」）。

**四個分頁**

| 分頁 | 內容 |
|---|---|
| Memo | 左：列表（搜尋、標籤篩選、新增、刪除、匯出）／右：編輯器。<800px 改為上下堆疊 |
| 記憶 | Knowledge Viewer：長程記憶（可個別刪除）＋ 短程記憶（可清空），唯讀不可改字 |
| 設定 | 個性（四選一，顯示標準化參數）＋ 聲音模型（標註男聲／女聲） |
| 報告 | Markdown 全文預覽 ＋ 複製 ＋ 下載 |

### 2.2 浮動視窗（Document PiP）

**Layout #1 — content**
```
[ (mic) ──────────────── (bell +紅點) ]
|                                      |
|      sandboxed iframe (agent HTML)   |
|                                      |
|                          [DISMISS]   |
```

**Layout #2 — prompt**
```
[ (mic) ──────────────── (bell +紅點) ]
|  Message …                           |
|  Input [____________________]        |
|  [   Button Option #1   ]            |
|  [   Button Option #2   ]            |
|  [   Button Option #3   ]            |
|                          [DISMISS]   |
```

狀態機：

| 狀態 | 條件 | 行為 |
|---|---|---|
| `closed` | 視窗未開 | Agent 送出的內容轉為 `pending`，主畫面提示主人開窗 |
| `idle` | 已開、無內容 | 顯示「助理待命中」 |
| `showing` | 已開、有內容 | 顯示內容 + DISMISS |
| `badged` | `showing` 時收到 `replace:false` 的新內容 | **保留現有內容**，右上角亮紅點；新內容排隊，等主人按 DISMISS 後才遞補 |

`hidePipWindow` 只清空內容、不關窗（關窗需要再一次使用者手勢）。每個分頁只能有一個 PiP 視窗。

**Agent 浮動視窗資訊呈現硬性規範**：
1. **明亮模式 (Light Mode Only)**：以純白或極淺色背景 (`#ffffff` / `#f8fafc`) 搭配深色高對比文字。**嚴禁使用 Dark Mode 深色背景**。
2. **多圖少字、視覺導向**：善加搭配美觀圖片 (`img`)、圖示 (`Material Symbols` / `iconfont`)、豐富 Emoji (✨, 📊, 🚀, 💡, 🏷️) 與 SVG/D3.js 圖表。避開長篇大論純文字牆。
3. **資訊精要精確**：內容以實際具體數字、明確結論與可點擊連結 (`target="_blank"`) 為主，主次分明。
4. **互動卡片排版**：善加利用表格 (`table`)、資訊卡片 (`.card`)、Script 互動開合資訊 (`<details><summary>` 或 JS toggle)，提供舒適易讀的訊息設計。
5. **一鍵存為 Memo**：浮動視窗下方提供「存為 Memo」按鈕，可將當前 HTML 片段直接儲存為 HTML 類別的 Memo。

---

## 3. Memo note 資料格式

```ts
interface Memo {
  id: string;
  title: string;
  summary: string;            // 卡片列表上顯示的一句話
  content: string;            // Markdown 正文
  translation?: string;       // 翻譯結果
  tags: string[];
  todos: Array<{ text: string; done: boolean }>;
  userNote?: string;          // 主人手寫，Agent 不得覆寫
  screenshotIds: string[];    // → IndexedDB
  sourceUrls?: Array<{ url: string; title: string }>;
  createdAt: number;
  updatedAt: number;
}
```

**儲存位置**
- metadata → `localStorage['class10_memos']`（列表要能同步渲染）
- 截圖 → IndexedDB `class10_screenshot_db / screenshots`（base64 圖片會撐爆 localStorage 配額）
- 刪除 memo 時一併清掉它的截圖，避免孤兒 blob 永久殘留

---

## 4. Workspace 資料來源（Agent 掌握的三種資料）

### 4.1 知識庫
訓練資料 ＋ **Google 搜尋 grounding**。系統提示詞硬性要求：任何會隨時間改變的事實（價格、版本、政策、
新聞、人事、規格）一律搜尋查證後再回答。殼層 `geminiService.ts` 已無條件掛上 `{ googleSearch: {} }`，
語音 session 亦同。另有殼層注入的 `queryCourseMaterials`（課程 RAG）。

### 4.2 經驗（記憶）

| | 長程記憶 | 短程記憶 |
|---|---|---|
| 內容 | 姓名、生日、職業、主要目標、服務領域、領域知識、領域模型、曾協助解決的問題 | 目前的工作、目前的焦點、正在處理的問題 |
| 儲存 | `localStorage['class10_memory_long']` | 記憶體，**不落地** |
| 生命週期 | 跨對話保留 | 重整頁面即消失，不帶到下一次對話 |
| 寫入 | `saveLongTermMemory`（依 category+key upsert，低把握度不覆寫高把握度） | `saveShortTermMemory`（同 topic 直接取代） |

兩者每回合都注入 `setRuntimeContext()`，模型永遠看得到。`consolidateMemory` 負責短程 → 長程的昇華。

### 4.3 Memo
見 §3。Agent 有完整 CRUD 工具，主人有完整手動管理介面。

---

## 5. AI 能力清單（工具）

### 螢幕
| 工具 | 說明 |
|---|---|
| `captureScreen({ mode, purpose, x?, y?, width?, height? })` | `full`：全螢幕縮到 ~1024px 長邊（看全貌，小字模糊）。`focus`：依座標**原始像素**裁切（文字銳利，翻譯／讀碼／讀錯誤訊息必用）。回傳含 `screenSize` 供 Agent 決定下一次的裁切座標，以及一段由視覺模型讀出的文字內容 |

### 浮動視窗
| 工具 | 說明 |
|---|---|
| `showPipWindow({ layout, html?, message?, options?, showInput?, width?, height?, replace? })` | 顯示內容或提問。`replace:false` = 不覆蓋、只亮紅點 |
| `updatePipContent({ html, replace })` | 更新內容但不改尺寸 |
| `hidePipWindow()` | 清空內容（視窗保持開啟） |

### Memo
`createMemo` / `updateMemo` / `queryMemos` / `deleteMemo` / `exportMarkdownReport`

### 記憶
`saveLongTermMemory` / `saveShortTermMemory` / `queryMemory` / `consolidateMemory`

### 殼層自動附加
`googleSearch`、`postChatMessage`、`queryCourseMaterials`、`planLongTasks`

### 個性參數化
四種個性（積極活潑／成熟穩重／冷峻專業／慎重謹慎）沿同一組軸線差異化，而非各寫一段散文：

| 參數 | 值域 | 影響 |
|---|---|---|
| `attitude` | 文字 | 處理事情的態度 |
| `proactiveness` | 1–5 | 主動介入積極度，**同時決定觀察迴圈的輪詢間隔**（25–120 秒） |
| `verbosity` | terse / balanced / detailed | 答覆用字數量上限 |
| `emotionMarkup` | none / light / expressive | 回應文字的情緒標註風格 |

語音由殼層負責，因此個性與聲音透過殼層新開放的 `setLiveOverrides({ voiceName, systemPromptSuffix, mediaResolution })`
介面套用，agent-app 不自行開第二條 live 連線。

---

## 6. 架構決策

### 6.1 雙通道分離
Live API **含 video 的 session 官方上限只有 2 分鐘**，不能拿來當「整個下午都在看」的主力。因此：

- **語音通道**：`ai.live.connect`，只走音訊（15 分鐘上限，並開啟 `sessionResumption` +
  `contextWindowCompression` 延長）。對話中需要看畫面時才以最高 1 fps 推送 frame。
- **觀察通道**：獨立的 unary `generateContent`，每 N 秒送一張低解析截圖，用 structured output
  回傳意圖判讀。不受 2 分鐘限制，成本可控，且預設為關閉。

### 6.2 Focus 模式由 AI 選裁切區
純瀏覽器**無法**取得瀏覽器視窗外的全域滑鼠座標——`getDisplayMedia` 只給畫面像素，不給游標座標。
因此改為兩段式：先抓 `full` → Agent 從畫面與 `screenSize` 判斷要細看哪一塊 → 再用 `focus` 抓該區。

### 6.3 Agent HTML 跑在沙盒 iframe
Agent 撰寫的 HTML5 + script 在 PiP 視窗內的 `<iframe sandbox="allow-scripts">` 執行，不直接注入 PiP
document。iframe 透過 `postMessage` 回傳使用者的按鈕點擊與輸入，宿主再餵回 Agent，Layout #2 因此可用。
Agent 端可呼叫 `window.reply(value)` 或在元素上加 `data-reply` 屬性。

---

## 7. 驗收清單

### 自動化（`npm run build` = vitest + tsc + vite build）
- [x] memo CRUD：建立預設值、部分更新、依 `updatedAt` 排序、標籤彙整
- [x] memo 搜尋：空字串全過、多關鍵字需全部命中、跨 title/summary/tags/todos
- [x] 長程記憶：依 category+key upsert、低把握度不覆寫高把握度、confidence 夾在 0–1
- [x] 短程記憶：同 topic 取代而非堆疊；consolidate 後清空並寫入長程
- [x] 記憶注入文字：有內容時包含內容，無內容時明說「尚無」
- [x] Markdown 匯出：待辦轉 checkbox、翻譯與來源區塊、未完成待辦彙整（且不含已完成）、空清單不產生壞報告
- [x] `clampRegion`：越界時滑回畫面內並保留尺寸；超過螢幕時縮小；不產生負座標
- [x] 個性四個 preset 參數組合互不重複；提示詞包含全部四項標準化參數；積極度越高輪詢越密
- [x] 聲音選項全部標註男聲／女聲，且兩者皆有
- [x] PiP 未開窗時內容轉為 pending
- [x] Registry 排序：`class10-live-assistance` 位於 class09 與 class11 之間

### 手動走查（Chrome / Edge 116+）
- [ ] 填入 API 金鑰 → 開螢幕分享 → 開浮動視窗
- [ ] 文字問「看一下我的畫面」→ `captureScreen` 被呼叫，PiP 出現內容
- [ ] 語音提問 → 麥克風運作、選定的聲音生效、回覆送到 PiP
- [ ] 開主動觀察 → 切到別的視窗停留 → PiP **亮紅點且沒有覆蓋**既有內容；按 DISMISS 後新內容才遞補
- [ ] 要求翻譯 → 走 focus 模式、譯文可讀、有語音朗讀
- [ ] 建立多則 memo → 搜尋 / 改名 / 刪除 / 匯出 Markdown 並下載
- [ ] Knowledge Viewer 內容正確；重整後短程清空、長程保留
- [ ] 在瀏覽器自己的分享列按「停止分享」→ 主動觀察自動停止、燈號轉暗
- [ ] 回歸：切到 class07 試語音，確認殼層改動未破壞既有行為

---

## 8. 已知限制

| 限制 | 原因 | 影響 |
|---|---|---|
| Document PiP 需 Chromium 116+ | 瀏覽器支援度 | 不支援時按鈕停用並提示；其餘功能不受影響 |
| 開窗必須由使用者手勢觸發 | Document PiP 規範 | Agent 無法自行開窗，只能暫存內容並提示 |
| 每分頁僅一個 PiP 視窗 | Document PiP 規範 | 不能同時開多個浮動面板 |
| 無法透明／無邊框／點擊穿透 | Web 平台限制 | 需要這些效果得改用 Electron（見 `class10/slides/speaker.md`） |
| Focus 區域由 AI 判斷，非跟隨滑鼠 | 瀏覽器取不到全域游標座標 | 兩段式擷取，多一次 API 呼叫 |
| Live session 含 video 上限 2 分鐘 | Live API 限制 | 觀察改走獨立 unary 通道 |
| 觀察迴圈持續消耗 token | 每次輪詢都是一次 API 呼叫 | 輪詢間隔綁定個性積極度，且**預設關閉** |
