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

## 關於 class08-data-analysis 的資料庫

`class08-data-analysis` 範例會呼叫一個公開的 Northwind 範例資料庫 REST API（`https://gemini.printii.com/northwind/api`），不需要你自行架設或啟動任何本機資料庫服務，開箱即用。

## License

本專案採用 [MIT License](./LICENSE)。
