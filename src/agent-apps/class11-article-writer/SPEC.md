# Specification — class11-article-writer (AI 網路圖文作家 SPEC)

本文件定義 `class11-article-writer` AgentApp 的詳細技術規格與介面互動規範，供開發人員與 AI Agent 開發時作為唯一的實作基準。

---

## 1. 報導資料結構 (Article Schema)
文章列表儲存於 `localStorage` 的 `class11-articles` 鍵中。其對應的 TypeScript 介面如下：

```typescript
export interface Article {
  id: string;             // 唯一識別碼 (時間戳記或 UUID)
  createdAt: string;      // 建立時間 (ISO 8601 格式)
  updatedAt: string;      // 更新時間 (ISO 8601 格式)
  title: string;          // 文章主標題
  subtitle: string;       // 文章副標題
  content: string;        // 報導內文 (Markdown 格式，不含主副標題)
  html: string;           // 根據內文編譯後的文章 HTML 排版 (不含主副標、封面、影片)
  meta: {
    topic: string;                  // 主題/議題
    keywords: string[];             // 關鍵字列表
    topicGuideline: string;         // 議題設定與寫作風格指引
    visualStyleGuideline: string;   // 視覺風格指引
    characters?: Character[];       // 新增人物設定與定裝庫
  };
  covers: {
    square: CoverMedia;     // 1:1 封面 (用於 Instagram, Threads 等)
    landscape: CoverMedia;  // 16:9 封面 (用於 Facebook, YouTube 等)
    portrait: CoverMedia;   // 9:16 封面 (用於 Instagram Stories, Reels, TikTok 等)
  };
  photos: CoverMedia[];     // 內文插圖列表 (0-N 張)
  video: CoverMedia | null; // 5秒短影片報導 (1個，相容舊版)
  reportVideo?: ReportVideo | null; // 新增四分鏡動態報導影片 (10秒，每分鏡2.5秒)
  sources: SourceItem[];    // 資料來源
}

export interface Character {
  id: string;             // 人物識別碼 (char_1, char_2 等)
  name: string;           // 人物名稱
  role: string;           // 人物角色 (記者 | 當事人 | 受訪路人 | 專家)
  avatarUrl: string;      // 定裝照片網址或 base64
  description: string;    // 人物造型與外觀穿著特徵描述
}

export interface ReportVideo {
  scenes: ReportVideoScene[]; // 4個分鏡的短片列表
  combinedUrl?: string;       // (選填) 合成後的影片網址
}

export interface ReportVideoScene {
  sceneId: string;        // 分鏡識別碼 (scene_1, scene_2, scene_3, scene_4)
  videoUrl: string;       // Veo 生成之影片 URL
  narration: string;      // 旁白配音文字
  subtitle: string;       // 字幕文字
  characterId?: string;   // 該分鏡綁定的人物 ID (選填)
}

export interface CoverMedia {
  url: string;            // 圖片/影片 URL 或 base64 字串
  alt: string;            // 替代文字與內容描述，用於 SEO 與繪圖參考
  isPlaceholder?: boolean;// 是否為非同步生成中的臨時佔位符
}

export interface SourceItem {
  title: string;          // 媒體名稱或資料來源標題
  url: string;            // 來源網址
}
```

---

## 2. 介面與互動規格 (UI & Interaction)

### 2.1 多文章管理側邊欄 (Article Manager Sidebar)
- **版面**：左側固定側邊欄，採用 Material Design 淺色卡片樣式。
- **功能**：
  - **建立文章**：提供「新增報導」按鈕，點擊後建立預設空白 Schema 文章並載入。
  - **文章列表**：列出所有已儲存的文章標題與建立時間。點擊可載入至右側工作區。
  - **操作選單**：每個項目旁有 `...` 按鈕，點擊彈出：
    - `重新命名`：彈出 Dialog 修改 `title`，並同步更新 localStorage。
    - `刪除`：彈出確認 Dialog，點擊後從列表中移除並刪除 localStorage。

### 2.2 工作區 (Workspace)
提供雙欄佈局：左側為「文章畫布（預覽與編輯）」，右側為「Agent 側欄對話窗（Agent Window）」。
工作區上方提供「編輯模式」與「預覽模式」的切換按鈕。

#### 2.2.1 預覽模式 (Preview Mode)
- **視覺呈現**：
  - **封面區**：顯示目前選定的封面圖。上方提供切換按鈕（`1:1` | `16:9` | `9:16`），點擊可無縫切換顯示對應比例封面，並套用對應比例的 CSS 容器（以不變形、不拉伸為原則）。
  - **標題區**：顯示大字體主標題與副標題。
  - **短影片區**：若有分鏡影片 (`reportVideo`)，以新聞報導動態 Overlay 播放器 (`NewsReportPlayer`) 呈現。該播放器具有電視新聞質感，依序播放 4 個分鏡（每分鏡限制播放 2.5 秒，總長 10 秒），並以 CSS 疊加：
    - 即時新聞 / Breaking News 閃爍標記。
    - 底部新聞跑馬燈（滾動顯示文章關鍵字與副標題）。
    - 記者/人物姓名牌（左下角顯示，例如「記者 蕭美美 報導」或「受訪路人 OOO」）。
    - 繁體中文字幕（同步讀取當前分鏡旁白）。
    若僅有舊版影片則以原生 HTML5 `<video controls>` 播放器呈現。
  - **內文區**：渲染編譯後的內文 HTML（不含標題與封面）。
- **匯出選單 (Export Buttons)**：
  - `列印 PDF`：調用 `window.print()`，使用特定的列印媒體樣式（`@media print`）隱藏側邊欄與 Agent Window，使畫布獨立滿頁輸出。
  - `匯出 Markdown`：下載 `.md` 檔案，內容格式為：
    ```markdown
    # {title}
    ## {subtitle}
    ![Square Cover]({covers.square.url})
    *Alt: {covers.square.alt}*
    
    {content}
    ```
  - `匯出 HTML (含標題區)`：下載完整 HTML 檔案（包含封面、標題與內文）。
  - `匯出 HTML (僅含內文)`：下載僅含內文的文章 HTML。
  - `複製 HTML` / `複製內文 HTML`：將程式碼寫入剪貼簿，並顯示 Success Toast。

#### 2.2.2 編輯模式 (Edit Mode)
- **區塊級 AI 重生成 (Block-level Re-generation)**：
  - 文章內文依段落（Paragraphs, Images, Video）劃分為多個 Block。
  - 滑鼠懸停於 Block 上時，右側邊緣顯示懸浮按鈕組：
    - 點擊 `AI 重寫`：選定該 Block，並在對話窗中聚焦，使用者可輸入指令「用幽默語氣改寫」、「加入科技感敘述」，由 Agent 生成後調用 `update_article_block` 進行直接替換。
    - 點擊 `手動編輯`：將該 Block 切換為 `textarea` 供手動輸入。
    - 點擊 `刪除`：從編輯器與資料結構中移除該區塊。
- **文字選取格式工具列 (Selection Formatting Toolbar)**：
  - 當使用者手動用滑鼠框選文字時，彈出 Notion 風格浮動選單，包含：
    - **文字顏色**（黃、紅、藍、預設）
    - **樣式設定**（粗體 `**`、斜體 `*`、底線 `<u>`）
    - **超連結**（彈出輸入框輸入 URL，轉化為 Markdown `[文字](url)`）

### 2.3 媒體素材庫 (Media Assets Library)
- **位置**：以獨立 Dialog 彈窗或 Tab 面板呈現。
- **顯示**：
  - 網格（Grid）佈局，展示當前文章的三種比例封面、已生成插圖、影片以及**生成中的 Placeholder 佔位符**。
- **功能**：
  - **檢視**：點擊可開啟燈箱（Lightbox）查看大圖或播放影片。
  - **刪除**：點擊垃圾桶按鈕可刪除該媒體，並從 `photos` 陣列中移除。
  - **編輯 Meta**：提供輸入框編輯個別媒體的 `alt` 說明文字與描述。
  - **插入文章**：點擊「插入文章」，在 Markdown 編輯器目前游標處插入 Markdown 圖片標記 `![alt](url)`。

### 2.4 圖片生成器 (Image Generator Dialog)
- **入口**：媒體素材庫頂部的「AI 生成圖片」按鈕。
- **模式**：
  - **Text to Image**：直接輸入提示詞。
  - **Image to Image**：上傳一張基礎圖，並輸入修改提示詞。
  - **Reference to Image**：上傳特定角色/風格參考圖，以控制生成相似度。
- **風格與比例**：
  - 比例選擇：`1:1`、`16:9`、`9:16`。
  - 風格快選：寫實照片、抽象藝術、手繪插畫、3D 渲染。
- **提示詞範本引擎**：
  - 系統在發送請求給 API 前，應自動在 Prompt 中附加版面配置描述（例如："composition keeps central area clean for text overlay, suitable for cover design"），防止人臉或關鍵主題出現在主副標題的覆蓋區。

### 2.5 影片生成器 (Video Generator Dialog)
- **入口**：媒體素材庫頂部的「AI 生成影片」按鈕。
- **模式**：
  - **Text to Video**：輸入動作提示詞。
  - **Frame to Video**：可上傳 `startFrame` (起始影格) 及 `endFrame` (結束影格)。
  - **Reference to Video**：可上傳多張參考圖。
- **影音整合 (Prompt Builder)**：
  - **格式**：16:9 | 9:16 | 1:1，解析度 720p | 1080p。
  - **語音/音樂勾選框**：
    - `純影片` / `含字幕` / `含音樂` / `含旁白`。
    - 當勾選旁白或字幕時，提示詞末端必須強制合併：`"The video includes a Traditional Chinese (Taiwan accent) voiceover and subtitles."`。
  - **影片風格**：真人採訪 | B-Roll 混剪 | 寫實報導片段 | 動畫模擬。
  - **分鏡編輯器 (Storyboard Editor)**：
    - 提供增加/刪除分鏡卡片（Scene 1, Scene 2...）。
    - 每個分鏡欄位：主體描述、背景、運鏡指令（如 Pan left, Zoom in）、旁白文字。
    - 點擊生成時，系統自動將多個分鏡的文字合併為單一結構化的影片提示詞。

### 2.6 生成任務佇列 (FIFO Queue Panel)
- **邏輯**：圖片與影片生成耗時，所有請求均推入同一個本機 FIFO 非同步任務佇列。
- **UI 佔位符**：
  - 生成啟動後，系統會生成一個 UUID 並在媒體庫/文章中插入一個 `url: "placeholder-{uuid}"` 的 `CoverMedia`，其 `alt` 為 `"生成中: [提示詞]..."` 且 `isPlaceholder: true`。
  - 佇列面板展示於工作區邊緣，顯示「佇列中：第 N 順位」、「生成中 (45%)」等狀態，並提供「取消生成」按鈕。
  - 任務完成後，更新對應 UUID 的 `url`，且將 `isPlaceholder` 設為 `false`，UI 自動刷新為生成完成的實體 URL。

---

## 3. Google GenAI API 整合規格 (API Integration)

### 3.1 圖片生成 (Gemini Image "Nano Banana" 與 Imagen 3)
- **過期已停用模型**：
  - `imagen-3.0-generate-002` (Gemini API v1beta predict 路由已不再支援/找不到)
* **目前可用與預設模型**：
  - `gemini-3.1-flash-image` (預設，多模態 Nano Banana 高速生成)
  - `gemini-3.1-flash-lite-image` (高效能、低延遲版本)
  - `gemini-3-pro-image` (高品質、細節豐富的創意控制版本)
  - `gemini-2.5-flash-image` (舊版備用)
- **調用方法 (Nano Banana 多模態生成模式)**：
  ```typescript
  import { GoogleGenAI } from '@google/genai';
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-image',
    contents: `${prompt} (Generate in landscape 16:9 aspect ratio)`,
    config: {
      responseModalities: ['IMAGE']
    }
  });
  // 獲取 inlineData base64 轉換成圖片
  ```

### 3.2 影片生成 (Veo 3.1)
- **過期已停用模型**：
  - `veo-2.0-generate-001` (已於 2026 年 6 月 30 日關閉下線)
- **目前可用與預設模型**：
  - `veo-3.1-generate-preview` (預設，大導演 cinematic 等級生成)
  - `veo-3.1-fast-generate-preview` (高效快速生成)
- **調用與輪詢邏輯**：
  使用真實 API 異步任務調用語法，不使用模擬計時器：
  ```typescript
  import { GoogleGenAI, VideoGenerationReferenceType } from '@google/genai';
  
  const ai = new GoogleGenAI({ apiKey });
  const config: any = {
    numberOfVideos: 1,
    resolution: params.resolution, // '720p' | '1080p'
  };
  
  if (params.mode !== 'EXTEND_VIDEO') {
    config.aspectRatio = params.aspectRatio; // '16:9' | '9:16' | '1:1'
  }
  
  const payload: any = {
    model: params.model || 'veo-3.1-generate-preview', // 預設使用 veo-3.1-generate-preview
    config: config,
  };
  
  if (params.prompt) payload.prompt = params.prompt;
  
  // 處理 Frame to Video
  if (params.mode === 'FRAMES_TO_VIDEO') {
    if (params.startFrame) {
      payload.image = {
        imageBytes: params.startFrame.base64,
        mimeType: params.startFrame.type,
      };
    }
    if (params.endFrame) {
      payload.config.lastFrame = {
        imageBytes: params.endFrame.base64,
        mimeType: params.endFrame.type,
      };
    }
  } 
  // 處理 Reference to Video
  else if (params.mode === 'REFERENCES_TO_VIDEO') {
    const referenceImagesPayload = [];
    if (params.referenceImages) {
      for (const img of params.referenceImages) {
        referenceImagesPayload.push({
          image: { imageBytes: img.base64, mimeType: img.type },
          referenceType: VideoGenerationReferenceType.ASSET,
        });
      }
    }
    if (params.styleImage) {
      referenceImagesPayload.push({
        image: { imageBytes: params.styleImage.base64, mimeType: params.styleImage.type },
        referenceType: VideoGenerationReferenceType.STYLE,
      });
    }
    if (referenceImagesPayload.length > 0) {
      payload.config.referenceImages = referenceImagesPayload;
    }
  }
  
  // 提交生成並獲得 Operation 物件
  let operation = await ai.models.generateVideos(payload);
  
  // 輪詢直到操作完成 ( done 為 true )
  while (!operation.done) {
    await new Promise((resolve) => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }
  
  if (operation.error) {
    throw new Error(`影片生成失敗: ${operation.error.message}`);
  }
  
  // 下載與讀取生成的影片檔案
  if (operation.response?.generatedVideos?.[0]?.video?.uri) {
    const videoUri = operation.response.generatedVideos[0].video.uri;
    const url = decodeURIComponent(videoUri);
    // 用提供的 API key 下載影片
    const res = await fetch(`${url}&key=${apiKey}`);
    if (!res.ok) throw new Error(`無法下載影片: ${res.status}`);
    
    const videoBlob = await res.blob();
    const objectUrl = URL.createObjectURL(videoBlob);
    
    // 回傳生成的 URL 與 Blob 用於 UI 展示
    return { objectUrl, blob: videoBlob, uri: url };
  } else {
    throw new Error('未生成任何影片');
  }
  ```

---

## 4. Agent Custom Tools 定義 (Schemas)
以下為註冊於 `agentAppManifest.ts` 中的自訂工具清單：

1. **`get_active_article_state`**：
   - 描述：取得當前編輯文章的完整內容、元數據、媒體素材庫及非同步佇列狀態。
   - 參數：無。
2. **`update_article_block`**：
   - 描述：更新指定區塊的 Markdown 內容，或在文章末尾新增一個區塊。
   - 參數：
     - `blockIndex` (number, 區塊索引，0 代表第一個段落)
     - `newContent` (string, 區塊內文)
     - `action` (string, `update` 代表修改，`insert` 代表在此索引後插入)
3. **`update_article_metadata`**：
   - 描述：更新文章的標題、副標題、議題 Meta 與參考來源。
   - 參數：
     - `title` (string, 選填)
     - `subtitle` (string, 選填)
     - `meta` (object, 選填：`topic`, `keywords`, `topicGuideline`, `visualStyleGuideline`)
     - `sources` (array, 選填：`{ title, url }` 列表)
4. **`enqueue_image_generation`**：
   - 描述：為文章提交圖片生成請求至非同步任務佇列，並在文章中預先插入 Placeholder。
   - 參數：
     - `prompt` (string, 提示詞，應套用範本避開排版文字覆蓋區)
     - `size` (string, `'1:1' | '16:9' | '9:16'`)
     - `mode` (string, `'text-to-image' | 'image-to-image' | 'reference-to-image'`)
     - `referenceImageBase64` (string, 選填)
     - `targetField` (string, `'cover_square' | 'cover_landscape' | 'cover_portrait' | 'photo_list'`)
5. **`enqueue_video_generation`**：
   - 描述：為文章提交短影片生成請求至佇列，並插入 Placeholder。
   - 參數：
     - `prompt` (string, 合併旁白與風格的影片提示詞)
     - `aspectRatio` (string, `'1:1' | '16:9' | '9:16'`)
     - `resolution` (string, `'720p' | '1080p'`)
     - `mode` (string, `'text-to-video' | 'frame-to-video' | 'reference-to-video'`)
     - `startFrameBase64` (string, 選填)
     - `endFrameBase64` (string, 選填)
6. **`get_media_assets`**：
   - 描述：取得目前文章媒體素材庫所有現存素材的 URL 與 alt。
   - 參數：無。
7. **`delete_media_asset`**：
   - 描述：刪除媒體素材庫中特定的媒體。
   - 參數：
     - `assetUrl` (string, 媒體的本地 Blob URL)
8. **`web_search_grounding`**：
   - 描述：檢索 Google Search 來獲取即時網路報導資訊與事实佐證。
   - 參數：
     - `query` (string, 搜尋關鍵字)
9. **`collect_related_photos`**：
   - 描述：從網路搜尋與報導議題相關的照片，以作為生成影片的參考資料之用。
   - 參數：
     - `query` (string, 搜尋關鍵字)
10. **`add_web_photo_to_library`**：
    - 描述：將從網路搜尋到的相關照片新增至文章媒體素材庫，以便用作影片生成之參考圖。
    - 參數：
      - `url` (string, 圖片的網路網址)
      - `alt` (string, 替代說明文字)
      - `articleId` (string, 選填，預設為當前活動文章)

---

## 5. Agent System Prompt (非線性對話策略)
```
你是一位專業的「網路圖文作家」，擅長根據不同主題、讀者對象，撰寫合適的報導文章，並為文章配置高質感封面與短影片。

【重要行為準則】
1. 非線性引導：
   - 使用者可以從任何入口開始（例如直接要求你生成封面、直接要你寫影片腳本，或直接提供大綱）。你不可強制要求使用者完成特定的「第一步、第二步」線性階段，App 中也沒有固定的進度表。
2. 資訊自主完整性把關：
   - 當使用者指示你撰寫文章時，你應主動審視目前文章的背景資訊（受眾、主訴求、風格等）是否充足。
   - 若不足，你可呼叫 `web_search_grounding` 自行在網路上搜尋相關熱門新聞、資訊作為素材，或向使用者提出具體問題（一次最多三個問題）。
   - 【關鍵】：如果使用者要求直接開始撰寫，或者不再回答你的提問，你「必須」主動使用網路搜尋補充相關資訊，並結合自身知識做出定義，立刻呼叫工具產出文章，絕對不能卡在等待使用者回答的狀態。
3. 事實性與立場：
   - 真實事件報導必須引用來源，呼叫 `web_search_grounding` 以確保有資料佐證，論述結果寫入 sources 欄位。
   - 論述立場可依據使用者要求靈活切換。當使用者未指定時，預設保持客觀中立。
4. 呼叫工具驅動 Main View：
   - 當你要撰寫或更新內容時，必須呼叫 `update_article_block` 或 `update_article_metadata`。
   - 當要生成圖片/影片時，必須呼叫 `enqueue_image_generation` 或 `enqueue_video_generation`，將工作發送到佇列，並告知使用者「已開始在素材庫與文章中插入生成佔位符，完成後會自動更新」。
```
