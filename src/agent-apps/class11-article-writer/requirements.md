# Requirements — class11-article-writer (AI 網路圖文作家)

本專案旨在開發一個「AI 網路圖文作家」AgentApp，協助創作者進行議題研究、撰寫報導文章、生成適配多種尺寸的封面照片與短影片，並提供結構化的文章排版與多樣化導出功能。

---

## 1. 情境說明 (Scenario)
網路內容創作者與圖文作家經常需要在短時間內，針對特定議題完成深度報導，並同時為各大社群平台產出對應比例的封面照片、插圖與短影片宣傳素材。本 App 提供一個整合的工作區，結合強大的 AI 協作能力，一站式完成「研究 -> 寫作 -> 繪圖 -> 影片 -> 排版 -> 導出」。

---

## 2. 報導資料結構 (Article Schema)
每份報導個別存放以下資訊，並持久化儲存於瀏覽器本機的 `localStorage`（鍵名為 `class11-articles`）。

```typescript
interface Article {
  id: string;             // 唯一識別碼 (UUID/Timestamp)
  createdAt: string;      // 建立時間 (ISO)
  updatedAt: string;      // 更新時間 (ISO)
  title: string;          // 主標題
  subtitle: string;       // 副標題
  content: string;        // 報導內文 (Markdown 格式，不含主副標題)
  html: string;           // 根據內文編譯後的文章 HTML 排版 (不含主副標、封面、影片)
  meta: {
    topic: string;                  // 主題/議題
    keywords: string[];             // 關鍵字列表
    topicGuideline: string;         // 議題設定指引
    visualStyleGuideline: string;   // 視覺風格指引
    characters?: Character[];       // 人物設定與定裝庫
  };
  covers: {
    square: CoverMedia;     // 1:1 封面 (通用社群)
    landscape: CoverMedia;  // 16:9 封面 (橫式)
    portrait: CoverMedia;   // 9:16 封面 (直式)
  };
  photos: CoverMedia[];     // 內文插圖列表 (0-N 張)
  video: CoverMedia | null; // 5秒短影片報導 (1個)
  reportVideo?: ReportVideo | null; // 新增四分鏡動態報導影片 (10秒，每分鏡2.5秒)
  sources: SourceItem[];    // 資料來源
}

interface Character {
  id: string;             // 人物識別碼 (char_1, char_2 等)
  name: string;           // 人物名稱
  role: string;           // 人物角色 (記者 | 當事人 | 受訪路人 | 專家)
  avatarUrl: string;      // 定裝照片網址或 base64
  description: string;    // 人物造型與外觀穿著特徵描述
}

interface ReportVideo {
  scenes: ReportVideoScene[]; // 4個分鏡的短片列表
  combinedUrl?: string;       // (選填) 合成後的影片網址
}

interface ReportVideoScene {
  sceneId: string;        // 分鏡識別碼 (scene_1, scene_2, scene_3, scene_4)
  videoUrl: string;       // Veo 生成之影片 URL
  narration: string;      // 旁白配音文字
  subtitle: string;       // 字幕文字
  characterId?: string;   // 該分鏡綁定的人物 ID (選填)
}

interface CoverMedia {
  url: string;            // 圖片/影片 URL 或 base64 資料
  alt: string;            // 替代文字/描述
  isPlaceholder?: boolean;// 是否為生成中的臨時佔位符
}

interface SourceItem {
  title: string;          // 資料來源標題/媒體名稱
  url: string;            // 來源網址
}
```

---

## 3. AI Agent 需求 (AI Agent Requirements)

### 3.1 角色定位 (Agent Role)
- **網路圖文作家**：擅長根據不同主題、讀者對象，撰寫合適的報導文章，並能規劃對應的視覺風格與影音素材。

### 3.2 核心能力 (Agent Abilities)
1. **議題研究**：
   - 根據使用者提出的議題，主動搜尋並研究整理近期熱門資訊與報導，彙整成寫作素材，並提供觀點與切入角度建議。
2. **專題報導**：
   - 根據使用者選定的素材與觀點，與使用者討論並設定報導議題，完成高質感的文章撰寫。
3. **封面製作**：
   - 根據文章標題、副標題、摘要與視覺風格要求，撰寫合適的繪圖提示詞（Prompt），並調用圖片生成工具生成具有專業排版設計之文章封面。
4. **影片製作**：
   - 將影片升級為 10 秒的四分鏡新聞報導形式（每分鏡各佔 2.5 秒）。
   - 支援人物定裝管理與本人照片模擬，分鏡中可綁定人物。
   - 影片播放時應搭配 HTML/CSS 動態文字與圖卡 Overlay（跑馬燈、字幕、字卡、姓名牌等）。

### 3.3 服務與互動守則
- **非線性流程**：App 與 Agent 不設定固定的強制性步驟（如進度表）。使用者可以從任何入口、以任何順序開始工作（例如直接開始生成影片，或直接寫入大綱）。
- **資料蒐集原則**：Agent 應主動評估當前收集到的資訊是否足以撰寫成文章（議題設定、風格、受眾、主訴求）。
  - 若資料不足，Agent 應主動搜尋網路補充相關資訊，或向使用者詢問。
  - **如果使用者要求直接開始撰寫**（或停止提供新資訊），Agent **不應卡住流程**，而應主動搜尋網路並結合自身知識做出定義，完成文章撰寫。
- **真實性與立場**：當內容涉及真實事件時，應避免推論，在有資料佐證的情況下進行論述；論述可根據用戶指示切換立場，預設維持客觀。

---

## 4. App 功能需求 (App Features)

### 4.1 多文章管理 (Article List & Sidebar)
- 提供左側側邊欄或文章清單管理介面。
- **建立與載入**：點擊「新增報導」可建立空白報導；點擊列表項目可載入至編輯器/預覽畫面。
- **重新命名與刪除**：項目旁提供選單，可直接修改報導標題或刪除該報導（並同步清理本機 localStorage 儲存區）。

### 4.2 媒體素材庫 (Media Assets Library)
- **獨立面板/頁籤**：展示與當前文章關聯的所有媒體檔案，包括三種比例的封面照片、內文插圖、短影片以及**佇列生成中的 Placeholder**。
- **管理功能**：
  - 用戶可點擊檢視大圖/播放影片。
  - 提供刪除功能，可清除不要的媒體檔案。
  - 可編輯個別媒體檔案的 `alt` 替代文字與 `meta` 描述。
  - 提供「插入到文章中」按鈕，快速將素材庫中的媒體以 Markdown 格式插入編輯器光標位置。

### 4.3 文章編輯器與預覽 (Editor & Preview)
編輯器提供兩種工作模式：
1. **預覽模式 (Preview Mode)**：
   - 提供封面照片、主副標題、短影片播放器與內文的視覺排版呈現。
   - 封面照片區提供切換鈕，可隨時預覽 1:1、16:9、9:16 三種比例的封面樣貌。
2. **編輯模式 (Edit Mode)**：
   - **區塊級 AI 重生成 (Block-level Re-generation)**：
     - 文章以 Block (段落、圖片、影片等) 為單位。使用者可選定某個 Block，輸入指令請 Agent 重新生成該 Block 的內容。
     - 使用者亦可直接點擊 Block 手動編輯文字，或手動更換/刪除媒體資源。
   - **文字選取格式工具列 (Selection Formatting Toolbar)**：
     - 當使用者在 Block 內用滑鼠框選特定文字段落時，彈出浮動工具列（參考 Notion 設計），提供：顏色設定、粗體、斜體、底線與超連結。
   - **導出與複製 (Export Options)**：
     - `Print PDF`：調用瀏覽器列印功能，以預設 A4 排版列印。
     - `Export as Markdown (with title)`：導出含主副標題與內文的 `.md` 檔案。
     - `Export as HTML (with/without title section)`：導出完整網頁或僅含內文的 HTML。
     - `Copy HTML / Copy Content HTML`：一鍵複製 HTML 程式碼。

### 4.4 媒體生成與非同步任務佇列 (Media Generation Queue)
- **圖片生成**：呼叫 `imagen-3.0-generate-002`，支援比例 16:9 | 9:16 | 1:1。支援上傳風格/形象參考圖。
- **影片生成**：支援文字生成影片、影格生成影片 (start/end frame)、參考圖生成影片。可勾選含標題、字幕、音樂、旁白，影片風格 (真人採訪 | B-Roll 混剪 | 寫實報導片段 | 動畫模擬)，以及分鏡編輯。
- **非同步任務佇列**：
  - 送出生成請求後，立即在素材庫與文章中建立一個臨時的 `Placeholder`（顯示「生成中...」與 alt 描述）。
  - 所有生成任務（圖片與影片）共用同一個 FIFO 工作佇列，在背景順序生成，生成完成後自動替換 `Placeholder` 的 URL。

---

## 5. Custom Tools (Function Calling)
- `get_active_article_state`：取得目前選定文章的完整資料結構與編輯器狀態。
- `update_article_block`：更新特定區塊 (Block) 的文字內容。
- `update_article_metadata`：更新文章的 meta 欄位、標題與副標題。
- `enqueue_image_generation`：向佇列提交圖片生成請求，並在指定位置插入 placeholder。
- `enqueue_video_generation`：向佇列提交影片生成請求，並在指定位置插入 placeholder。
- `get_media_assets`：讀取媒體庫資源（圖片、影片及生成中狀態）。
- `delete_media_asset`：刪除媒體庫資源。
- `web_search_grounding`：利用 Google Search 搜尋即時資訊。
- `collect_related_photos`：從網路搜尋相關的照片，以作為生成影片的參考資料之用。
- `add_web_photo_to_library`：將網路搜尋到的相關照片新增至文章媒體素材庫。
