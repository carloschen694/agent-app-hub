# Specification — class09-proposal（AI 企劃書撰寫助手）

本文件定義 `class09-proposal` AgentApp 的詳細技術規格與介面互動規範，供開發人員與 AI Agent 開發時作為唯一的實作基準。

> **參考來源**：原始功能來自 [printii-documind](https://github.com/drgarbage/printii-documind)，本版本以 agent-app-hub 架構重新實作。

---

## 1. 產品定位

**AI 企劃書撰寫助手** 是一個以對話驅動的文件生成 App。使用者透過聊天窗告知需求，AI Agent 自動規劃大綱、逐節撰寫、並允許使用者手動或透過 AI 進行細部調整，最終輸出專業企劃書（A4 預覽 + 列印 / JSON 匯出）。

---

## 2. 資料結構

### 2.1 企劃書文件 (ProposalDoc)

所有文件 ID 索引存於 `localStorage["class09-proposal-index"]`；  
個別文件本體存於 `localStorage["class09-proposal-doc-{docId}"]`。

```typescript
export interface ProposalDoc {
  id: string;                     // UUID
  title: string;                  // 文件標題
  metadata: ProposalMeta;
  sections: ProposalSection[];
  publishedVersions: VersionLog[];
  createdAt: number;              // Unix timestamp (ms)
  updatedAt: number;
}

export interface ProposalMeta {
  purpose: string;                // 文件用途描述 (由 AI 分析後填入)
  targetAudience: string;         // 目標對象
  tone: string;                   // 語氣，預設 "專業"
  pageCountEstimate: number;      // 預估頁數
}

export interface ProposalSection {
  id: string;
  title: string;
  description: string;            // AI 生成大綱時的段落說明
  content: ProposalBlock[];
  isComplete: boolean;            // 是否已生成內容
}

export type BlockType = 'h1' | 'h2' | 'h3' | 'paragraph' | 'list_item' | 'table';

export interface ProposalBlock {
  id: string;
  type: BlockType;
  content: string | string[][];   // 一般文字為 string；table 為 2D 陣列 string[][]
}

export interface VersionLog {
  version: string;                // e.g., "1.0.0"
  timestamp: number;
  changes: string;                // 本版本變更摘要
}

export interface VersionSnapshot {
  id: string;
  timestamp: number;
  name: string;
  doc: ProposalDoc;               // 完整文件快照
}

export type AppStatus = 'idle' | 'planning' | 'writing' | 'reviewing';
```

---

## 3. AI Tools（工具定義）

Agent 透過以下工具操作文件狀態。工具由 MainView 以 `registerToolHandlers()` 註冊。

### `create_outline`
**觸發時機**：使用者描述文件需求，Agent 規劃大綱。

```typescript
// 參數
{
  title: string;                  // 文件標題
  purpose: string;                // 文件用途
  targetAudience: string;         // 目標對象
  tone: string;                   // 語氣
  sections: Array<{
    title: string;
    description: string;
  }>;
}
// 效果：建立新文件或替換現有大綱；每個 section 的 content 設為空陣列，isComplete=false
```

### `write_section`
**觸發時機**：Agent 為指定段落生成正文。

```typescript
// 參數
{
  sectionId: string;
  blocks: Array<{
    type: BlockType;
    content: string | string[][];
  }>;
}
// 效果：將 blocks 寫入對應 section，設 isComplete=true
```

### `refine_section`
**觸發時機**：使用者對某段落提供修改回饋。

```typescript
// 參數
{
  sectionId: string;
  blocks: Array<{
    type: BlockType;
    content: string | string[][];
  }>;
}
// 效果：以新 blocks 替換該 section 的 content（結構同 write_section）
```

### `update_block`
**觸發時機**：使用者選取單一 block 要求局部修改。

```typescript
// 參數
{
  sectionId: string;
  blockId: string;
  type: BlockType;
  content: string | string[][];
}
// 效果：只更新指定 block
```

### `get_document_state`
**觸發時機**：Agent 需要確認目前文件結構時呼叫。

```typescript
// 參數：{}（無）
// 回傳：完整 ProposalDoc JSON（供 Agent 理解文件進度）
```

### `publish_version`
**觸發時機**：使用者要求發布版本時，Agent 呼叫此工具。

```typescript
// 參數
{
  versionType: 'major' | 'minor' | 'patch';
  changeDescription: string;
}
// 效果：依 semantic versioning 計算新版本號；新增 VersionLog；存入 VersionSnapshot
```

---

## 4. 介面與互動規格

### 4.1 整體版面

```
┌─────────────────────────────────────────────────────┐
│  Header: 企劃書撰寫助手 | [新增文件] [匯出▼] [版本紀錄] │
├──────────────┬──────────────────────┬────────────────┤
│ 文件列表      │  文件畫布（A4 預覽）   │  AgentWindow   │
│ (左側欄 240px)│  (中央，可縮放)       │  (右側 380px)  │
│              │                      │                │
│  [+ 新增]    │  ┌─────────────────┐ │  (由 Hub 提供) │
│  ─────────   │  │  封面頁         │ │                │
│  企劃書 A    │  │  目錄           │ │                │
│  企劃書 B    │  │  第 1 節        │ │                │
│  ...         │  │  第 2 節 ...    │ │                │
│              │  └─────────────────┘ │                │
├──────────────┴──────────────────────┴────────────────┤
│  狀態列：IDLE / PLANNING / WRITING / REVIEWING + 進度  │
└─────────────────────────────────────────────────────┘
```

### 4.2 文件管理側欄（左欄 240px）

- **新增文件**：點擊後建立空白 `ProposalDoc`，立即載入工作區
- **文件列表**：顯示標題 + `updatedAt` 相對時間；點擊切換當前文件
- **右鍵 / 「⋯」選單**：
  - 重新命名（彈出 inline 輸入框）
  - 刪除（Confirm Dialog 確認後移除）
  - 匯出 JSON（下載 `.json` 備份）

### 4.3 文件畫布（A4 預覽）

- **比例**：寬度固定於容器，高度依 A4 比例（1:1.4142）自動延伸
- **縮放控制**：右上角 `- 100% +` 按鈕（50% ~ 200%，每次 ±10%）
- **自動渲染區塊**：
  - **封面頁（Cover Page）**：標題、用途、目標對象、版本號徽章、建立日期
  - **目錄（Table of Contents）**：自動列出各節標題，預估頁碼（靜態文字）
  - **內文節**：每節 `ProposalSection` 對應一組 Blocks

### 4.4 節區與 Block 編輯

- **節標題**：灰色分隔線 + 節名稱 + 完成徽章（✓ 已完成 / ○ 待填入）
- **Block 懸停**：顯示操作按鈕組：
  - ✏️ **手動編輯**：切換為 `contenteditable` textarea
  - ✨ **AI 修改**：聚焦 AgentWindow，預填「修改這個段落：」
  - 🗑️ **刪除**：移除 Block

- **Table Block**：以 `<table>` 渲染；編輯時以格狀 textarea 呈現
- **格式工具列**：選取文字時浮現（Bold / Italic / H2 / H3 / 清單）

### 4.5 段落導覽側欄（文件畫布左側，收合式）

- 列出文件所有 Section，點擊滾動至對應位置
- 顯示完成狀態（✓ / ○）
- 頂部提供 Undo / Redo 按鈕（20 層歷史）

### 4.6 版本紀錄 Modal

- **入口**：Header 的「版本紀錄」按鈕
- **內容**：
  - 已發布版本列表（版本號、時間、變更描述）
  - 「發布新版本」按鈕 → 呼叫 `publish_version` tool
  - 「還原至此版本」按鈕 → 讀取 VersionSnapshot 並套用

### 4.7 AgentWindow（右欄，Hub 提供）

Agent 使用對話窗執行以下互動：
- 接收使用者的文件需求描述
- 呼叫 `create_outline` 建立大綱後回應確認
- 逐一呼叫 `write_section` 並報告進度
- 識別 `refine` / `update` 意圖並呼叫對應 Tool
- 完成後提供建議的下一步按鈕（`toolFollowups`）

### 4.8 匯出功能

| 功能 | 說明 |
|------|------|
| 列印 / PDF | `window.print()` + CSS `@media print`，隱藏側欄 & AgentWindow |
| 匯出 JSON | 下載完整 `ProposalDoc` 物件為 `.json` 檔 |
| 匯入 JSON | 讀取 `.json` 還原文件到列表 |

---

## 5. 狀態管理

| 狀態 | 描述 | UI 表現 |
|------|------|---------|
| `idle` | 無作業進行中 | 狀態列：就緒 |
| `planning` | `create_outline` 執行中 | 狀態列：「AI 規劃大綱中…」+ Spinner |
| `writing` | `write_section` 執行中 | 狀態列：「撰寫第 N/M 節…」+ 進度條 |
| `reviewing` | `refine_section` / `update_block` 執行中 | 狀態列：「修改段落中…」+ Spinner |

---

## 6. 持久化策略

| 資料 | localStorage Key | 說明 |
|------|-----------------|------|
| 文件索引 | `class09-proposal-index` | `DocSummary[]`（id, title, updatedAt） |
| 文件本體 | `class09-proposal-doc-{id}` | 完整 `ProposalDoc` |
| 版本快照 | `class09-proposal-versions-{id}` | `VersionSnapshot[]`（上限 10 筆） |
| 當前開啟文件 | `class09-proposal-current` | 目前文件 ID（字串） |

每次文件狀態變更後自動存入 localStorage（透過 `useHistory` hook 管理，20 層 Undo/Redo）。

---

## 7. System Prompt 要點

```
你是一位專業的企劃書撰寫助理。你的職責是幫助使用者從零開始規劃並撰寫完整的企劃書文件。

工作流程：
1. 分析使用者需求 → 呼叫 create_outline 建立大綱
2. 確認大綱後 → 逐節呼叫 write_section 生成內容
3. 接收修改回饋 → 呼叫 refine_section 或 update_block
4. 需要了解文件狀態時 → 呼叫 get_document_state

輸出要求：
- 所有文件內容使用繁體中文
- 語氣專業、簡潔，避免贅詞
- 企劃書結構完整（背景、目標、執行計畫、預算、時程、預期成果）
- 表格使用 table block，列表使用 list_item block
```

---

## 8. 實作計畫（Sprint 拆分）

### Sprint 1 — 資料層 & 核心架構

| 任務 | 檔案 |
|------|------|
| 定義所有 TypeScript 介面 | `types.ts` |
| localStorage CRUD | `services/storageService.ts` |
| Undo/Redo hook | `hooks/useHistory.ts` |
| agentAppManifest 骨架 | `agentAppManifest.ts` |

### Sprint 2 — 文件畫布 UI

| 任務 | 檔案 |
|------|------|
| A4 文件容器 + 縮放控制 | `components/DocumentCanvas.tsx` |
| 封面頁 | `components/CoverPage.tsx` |
| 目錄 | `components/TableOfContents.tsx` |
| Block 渲染器 | `components/DocumentBlock.tsx` |
| 文件管理側欄 | `components/ProposalSidebar.tsx` |

### Sprint 3 — Tool Handlers & AI 整合

| 任務 | 檔案 |
|------|------|
| 5 個 Tool handler 實作 | `tools/proposalTools.ts` |
| MainView（整合所有元件）| `ProposalPage.tsx` |
| agentAppManifest 完整版 | `agentAppManifest.ts` |
| System Prompt 調優 | `agentAppManifest.ts` |

### Sprint 4 — 版本紀錄 & 匯出

| 任務 | 檔案 |
|------|------|
| VersionHistoryModal | `components/VersionHistoryModal.tsx` |
| 列印 CSS（`@media print`）| `ProposalPage.tsx` 內嵌 or CSS |
| JSON 匯入 / 匯出 | `services/storageService.ts` |
| CardWidget（儀表板卡片）| `CardWidget.tsx` |

---

## 9. 目錄結構（完成後）

```
src/agent-apps/class09-proposal/
├── SPEC.md                         ← 本文件
├── agentAppManifest.ts             ← App 註冊（含 systemPrompt & tools）
├── ProposalPage.tsx                ← MainView（整合入口）
├── CardWidget.tsx                  ← 儀表板卡片
├── types.ts                        ← 所有 TypeScript 介面
├── hooks/
│   └── useHistory.ts               ← Undo/Redo（20 層）
├── services/
│   └── storageService.ts           ← localStorage CRUD
├── tools/
│   └── proposalTools.ts            ← Tool handlers（create_outline 等）
└── components/
    ├── DocumentCanvas.tsx           ← A4 畫布 + 縮放
    ├── CoverPage.tsx                ← 封面頁
    ├── TableOfContents.tsx          ← 目錄
    ├── DocumentBlock.tsx            ← 單一 Block 渲染 & 編輯
    ├── ProposalSidebar.tsx          ← 左側文件列表 + 節導覽
    └── VersionHistoryModal.tsx      ← 版本紀錄彈窗
```
