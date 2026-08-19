import type { ToolDefinition, AgentAppManifest } from '../../agent/types/agent';
import { ArticleWriterPage } from './ArticleWriterPage';

const articleWriterSystemPrompt = `你是一位專業的「網路圖文作家」，擅長根據不同主題、讀者對象，撰寫合適的報導文章，並為文章配置高質感封面與短影片。

【對話中斷點判定與跳過規則（彈性 UX 處理）】
1. **模糊需求 -> 啟動對話中斷點**：如果使用者給予的起始 Prompt 資訊較為簡單或模糊（例如只說「寫一篇 AI 課文章」），你必須啟動互動檢查哨。在完成每個階段 of 工具呼叫後暫停對話，詢問並與使用者對齊下一步，直到使用者明確指示「由你決定」為止。
2. **完整規劃 -> 流程直通（不打斷）**：如果使用者在一開始的 Prompt 中就已經給定了完整且清晰的需求（例如同時給出了標題、大綱、以及視覺風格參考網站，並明確指示「直接幫我產出 HTML」），你應展現高效率，**不應反覆詢問打斷**，直接連續呼叫工具完成所有階段。

【核心創作 SOP 檢查哨】
1. **建立文章實例**：首先，呼叫 \`create_article\` 工具建立一篇新的 Article 實例。
2. **對齊主題與 Meta (Gate 1)**：與使用者討論主標題、副標題與關鍵字。若為模糊需求，呼叫 \`update_article_metadata\` 後必須暫停並詢問使用者意見。
3. **確認視覺風格與網站樣式提取 (Gate 2)**：
   - 視覺風格指引 (\`visualStyleGuideline\`) 應存放**實際的網頁設計與 CSS 配色規範（包括主色、背景色、字型等）**，以便生成符合目標品牌風格的 HTML。
   - **樣式提取**：如果使用者提供了一個參考網站的網址，你必須先使用搜尋或讀取網頁的工具抓取該網站，分析其主色、字型、背景配色與卡片樣式等特徵，整理成結構化的 CSS 風格規範，寫入 \`visualStyleGuideline\` 中。
   - 若為模糊需求，設定完後暫停，詢問使用者是否滿意此風格設定。
4. **撰寫內文資料源 (Gate 3)**：撰寫純 Markdown 格式的正文。呼叫 \`update_article_content\` 後，若為模糊需求，請暫停並向使用者呈現內容大綱以供確認。
5. **規劃並提交新聞報導影音生成 (Gate 4)**：
   - 根據報導內容，規劃一個包含 4 個分鏡、總長 10 秒（每分鏡 2.5 秒，共 10 秒）的新聞報導影片腳本：
     - Scene 1: 記者開場（記者對鏡頭說話開場）
     - Scene 3: 街訪段落（採訪路人，視情況加入）
     - Scene 4: 記者結語（記者對鏡頭講話收尾）
     - Scene 2: B-roll 相關畫面
   - 建立角色造型，並使用定裝 ID（如 Character #1、#2）。
   - 當使用者提供人像照片，請將其綁定為對應人物，並呼叫 \`enqueue_video_generation\` 傳入參考圖。
   - 如需搜尋相關參考圖片，可先呼叫 \`collect_related_photos\`，並呼叫 \`add_web_photo_to_library\` 儲存搜尋到的真實照片，以便用作影片生成參考。
   - 呼叫 \`enqueue_video_generation\` 提交佇列，其會同步回傳 \`placeholderUrl\`。
   - 你不用等待生成完畢，請直接將預留協定網址填入 Article 屬性（如封面 \`covers.landscape\`）中。
   - 若為模糊需求，提交佇列後告知使用者「圖片與報導短片已排程生成，獲得 placeholder 協定，我們現在可以開始為您設計網頁版面了。」
6. **設計最終視覺網頁 HTML (Gate 5)**：
   - 使用前述的 CSS 配色與網格版面指引，撰寫高度精美的 RWD 網頁 HTML（包含完整的 \`<style>\`、圓角、陰影、首字放大等設計），呼叫 \`update_article_html\`。
   - 撰寫 HTML 時，**直接在 <img> 及 <video> 的 src 中使用對應的 placeholder 協定網址**。後台完成生成後會由前端系統自動將其置換為真實圖片，你無須等待。
   - **可編輯區塊標記**：為了讓使用者能在預覽畫面上直接點選特定區塊進行 AI 重新設計或重寫，在輸出 HTML 時，請為所有主要的文章區塊、卡片容器、特色引用或重要段落元素，加上 \`class="ai-editable"\` 與一個唯一的 \`id\`（例如 \`<div id="block_sec_1" class="ai-editable">...</div>\`）。

【視覺網頁 HTML/CSS 寫作與排版規範 - 必須嚴格遵守】
當你為文章設計與撰寫最終視覺 HTML 時（呼叫 \`update_article_html\`），你必須為此文章編排豐富、美觀且專業的排版，包含 CSS 樣式與響應式 (RWD) 機制，不得僅輸出陽春的文字。請遵循以下設計指引：

1. **視覺整合範圍**：
   - 輸出的 HTML 必須是「完整且自成一體 (Self-contained)」的網頁，包含完整的 \`<style>\` 與排版，並將主標題 (title)、副標題 (subtitle)、橫式封面 (landscape cover)、內容 (Markdown content 解析後) 以及宣傳影片 (video) 等資訊，整合成一個美感一致的視覺網頁。
   
2. **視覺設計與排版美感**：
   - **字型與排版**：使用現代質感字型（如 system-ui, -apple-system, Roboto, sans-serif 或優雅的 serif 字型，如 Playfair Display/Georgia 用於新聞報導）。設定適當的 \`line-height\` (預設 1.7 到 1.8) 與段落間距，以提供極佳的閱讀體驗。
   - **配色方案**：應根據文章的「主題分類」與「視覺風格指引 (visualStyleGuideline)」量身打造配色。例如：
     - 若為科技主題，可使用深色模式（Dark Theme）配以極光藍/霓虹紫點綴，加上微發光邊框；
     - 若為人文/環境/綠能主題，可使用溫暖的淺米色或純白背景，配以森林綠/落葉棕，採用紙張質感（Card/Paper style）排版；
     - 若為政治或商業新聞，使用嚴謹的社論風（Editorial），以精緻的雙欄或單欄網格排版，主色採深海藍。
   - **版面布局**：使用 CSS Grid 或 Flexbox 實作精美的網頁排版。可以利用大滿幅 Header 放置 16:9 橫式封面圖作為背景或 Hero Image。標題與副標題應搭配合理的文字陰影或半透明玻璃砂紙疊層 (Glassmorphism)。
   
3. **內文元素美化**：
   - **首字放大 (Drop Caps)**：在文章的第一段文字開頭使用 Drop Cap（首字放大），增強社論質感。
   - **重點引言 (Blockquotes)**：文章中的重要段落或專家發言，應使用帶有左側粗邊線、背景微透、字體傾斜放大且帶有雙引號裝飾的精美 Blockquote 樣式。
   - **內文插圖卡片**：將 \`photos\` 陣列中的插圖合理穿插到 HTML 內文中（例如使用 float、交錯排列或三欄網格），並加上細邊框、陰影及居中的斜體說明文字 (caption)。
   - **宣傳短影片**：若有影片，應以居中對齊的精緻影音卡片形式呈現，影片元件應具有圓角、陰影、黑色背景，甚至加上虛擬的電視或平板邊框。
   
4. **響應式標準 (RWD)**：
   - Container 的寬度應限制在合適的範圍（例如最大寬度 \`800px\`），並有良好的左右內邊距 (\`padding\`)。
   - 確保在手機尺寸（如 \`< 640px\`）時，字體大小、圖片高度、雙欄網格能自動轉為單欄，標題字體縮小，完美契合行動裝置閱讀。
   
5. **程式碼完整性**：
   - 請直接輸出完整的 HTML 內容（包含 \`<!DOCTYPE html>\`, \`<html>\`, \`<head>\`, \`<style>\`, \`<body>\` 結構），並確保包含所有需要的 CSS 樣式。不需要有任何引言或程式碼區塊外圍的 markdown 標記（只回傳純 HTML 原始碼給工具參數）。

【行為與非同步說明】
- 當你提交圖片或影片生成佇列時，請向使用者說明「已加入背景佇列並獲得暫存佔位符（placeholder://...），生成完畢後系統會自動更新」。
- 回答時請簡短扼要，把重點留給工具呼叫和內容本身。`;

const articleWriterTools: ToolDefinition[] = [
  {
    name: 'get_active_article_state',
    description: '取得指定或當前選定文章的完整資料結構與編輯器狀態（含標題、副標、內文、Meta、媒體素材庫及非同步佇列狀態）。在編寫或重寫任何內容前，應先呼叫此工具取得最新內容。',
    parameters: {
      type: 'OBJECT',
      properties: {
        articleId: { type: 'STRING', description: '目標文章 ID。如果未指定，預設為當前活動文章。' }
      }
    }
  },
  {
    name: 'update_article_content',
    description: '更新指定或當前選定文章的 Markdown 內文資料源（不含 HTML/CSS 視覺樣式，僅含純正文文字結構）。',
    parameters: {
      type: 'OBJECT',
      properties: {
        content: { type: 'STRING', description: '新的 Markdown 格式正文內容。' },
        articleId: { type: 'STRING', description: '目標文章 ID。如果未指定，預設為當前活動文章。' }
      },
      required: ['content']
    }
  },
  {
    name: 'update_article_html',
    description: '更新指定或當前選定文章的最終視覺 HTML 網頁程式碼（包含視覺樣式、排版與內容元素）。當正文 Content 與相關封面素材都準備完成後，應呼叫此工具美化產出。',
    parameters: {
      type: 'OBJECT',
      properties: {
        html: { type: 'STRING', description: '完整的最終 HTML 代碼。' },
        articleId: { type: 'STRING', description: '目標文章 ID。如果未指定，預設為當前活動文章。' }
      },
      required: ['html']
    }
  },
  {
    name: 'update_article_metadata',
    description: '更新指定或當前文章的 Meta 欄位、主標題、副標題與參考來源列表。',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: '文章主標題' },
        subtitle: { type: 'STRING', description: '文章副標題' },
        articleId: { type: 'STRING', description: '目標文章 ID。如果未指定，預設為當前活動文章。' },
        meta: {
          type: 'OBJECT',
          description: '主題設定與寫作風格指引',
          properties: {
            topic: { type: 'STRING', description: '主題/議題' },
            keywords: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: '關鍵字列表'
            },
            topicGuideline: { type: 'STRING', description: '議題設定與寫作風格指引' },
            visualStyleGuideline: { type: 'STRING', description: '視覺風格指引' }
          }
        },
        sources: {
          type: 'ARRAY',
          description: '資料來源列表',
          items: {
            type: 'OBJECT',
            properties: {
              title: { type: 'STRING', description: '資料來源標題/媒體名稱' },
              url: { type: 'STRING', description: '來源網址' }
            },
            required: ['title', 'url']
          }
        }
      }
    }
  },
  {
    name: 'enqueue_image_generation',
    description: '向背景任務佇列提交圖片生成請求。該工具會立即同步回傳暫存 URL (格式為 placeholder://image/{taskId})，你可以立刻將其作為圖片網址填入 Article 對應的欄位或 HTML 原始碼中，不需要等待生成結束。',
    parameters: {
      type: 'OBJECT',
      properties: {
        prompt: { type: 'STRING', description: '圖片生成提示詞（需描述寫實/抽象/手繪風格，並預留排版文字區空間描述）。' },
        size: { type: 'STRING', description: '圖片長寬比例，可為 "1:1"、"16:9"、"9:16"。' },
        mode: { type: 'STRING', description: '圖片生成模式，可為 "text-to-image"、"image-to-image"、"reference-to-image"。' },
        referenceImageBase64: { type: 'STRING', description: '參考圖片的 base64 資料（選填，用於 image-to-image 或 reference-to-image）。' },
        targetField: { type: 'STRING', description: '生成的圖片應儲存的目標欄位，可為 "cover_square"、"cover_landscape"、"cover_portrait" 或 "photo_list"。' },
        model: { type: 'STRING', description: '自訂 Gemini/Imagen 圖片模型名稱（如 "gemini-3.1-flash-image" 或 "gemini-3-pro-image"）。選填。' },
        articleId: { type: 'STRING', description: '目標文章 ID。如果未指定，預設為當前活動文章。' }
      },
      required: ['prompt', 'size', 'mode', 'targetField']
    }
  },
  {
    name: 'enqueue_video_generation',
    description: '向背景任務佇列提交影片生成請求。該工具會立即同步回傳暫存 URL (格式為 placeholder://video/{taskId})，你可以立刻將其作為影片網址填入 Article 對應的欄位或 HTML 原始碼中，不需要等待生成結束。',
    parameters: {
      type: 'OBJECT',
      properties: {
        prompt: { type: 'STRING', description: '影片生成提示詞（包含運鏡指令，若勾選旁白/字幕，應合併繁中台灣口音指令）。' },
        aspectRatio: { type: 'STRING', description: '影片長寬比例，可為 "1:1"、"16:9"、"9:16"。' },
        resolution: { type: 'STRING', description: '解析度，可為 "720p" 或 "1080p"。' },
        mode: { type: 'STRING', description: '影片生成模式，可為 "text-to-video" | "frame-to-video" | "reference-to-video"。' },
        startFrameBase64: { type: 'STRING', description: '起始影格的 base64 資料（選填，用於 frame-to-video）。' },
        endFrameBase64: { type: 'STRING', description: '結束影格的 base64 資料（選填，用於 frame-to-video）。' },
        model: { type: 'STRING', description: '自訂 Veo 影片模型名稱（如 "veo-3.1-generate-preview"）。選填。' },
        articleId: { type: 'STRING', description: '目標文章 ID。如果未指定，預設為當前活動文章。' }
      },
      required: ['prompt', 'aspectRatio', 'resolution', 'mode']
    }
  },
  {
    name: 'get_media_assets',
    description: '取得指定或當前文章媒體素材庫所有現存素材的 URL 與 alt，包括正在生成中的 Placeholder。',
    parameters: {
      type: 'OBJECT',
      properties: {
        articleId: { type: 'STRING', description: '目標文章 ID。如果未指定，預設為當前活動文章。' }
      }
    }
  },
  {
    name: 'delete_media_asset',
    description: '從媒體素材庫中刪除指定的媒體素材。',
    parameters: {
      type: 'OBJECT',
      properties: {
        assetUrl: { type: 'STRING', description: '欲刪除的媒體本地 Blob URL。' },
        articleId: { type: 'STRING', description: '目標文章 ID。如果未指定，預設為當前活動文章。' }
      },
      required: ['assetUrl']
    }
  },
  {
    name: 'web_search_grounding',
    description: '檢索 Google Search 來獲取即時網路報導資訊、正反觀點與事實佐證。',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: '搜尋關鍵字' }
      },
      required: ['query']
    }
  },
  {
    name: 'list_articles',
    description: '瀏覽並列出工作區目前所有現存文章列表，取得所有文章的 ID、標題、副標題與時間戳記。',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'create_article',
    description: '新增一篇空白文章（需要提供標題與副標題），並自動切換至該篇新文章。',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: '新文章的主標題。' },
        subtitle: { type: 'STRING', description: '新文章的副標題。' },
        topic: { type: 'STRING', description: '此報導的主題議題。選填。' }
      },
      required: ['title', 'subtitle']
    }
  },
  {
    name: 'switch_active_article',
    description: '切換當前選定的文章（載入指定文章 ID 進行瀏覽與個別編輯）。',
    parameters: {
      type: 'OBJECT',
      properties: {
        articleId: { type: 'STRING', description: '目標文章 ID。' }
      },
      required: ['articleId']
    }
  },
  {
    name: 'delete_article',
    description: '刪除工作區中指定的文章 ID。',
    parameters: {
      type: 'OBJECT',
      properties: {
        articleId: { type: 'STRING', description: '欲刪除的文章 ID。' }
      },
      required: ['articleId']
    }
  },
  {
    name: 'collect_related_photos',
    description: '從網路搜尋與報導議題相關的照片，以作為生成影片的參考資料之用。',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: '搜尋關鍵字，例如 "台北街景"、"AI 伺服器照片"' }
      },
      required: ['query']
    }
  },
  {
    name: 'add_web_photo_to_library',
    description: '將從網路搜尋到的相關照片新增至文章媒體素材庫，以便用作影片生成之參考圖。',
    parameters: {
      type: 'OBJECT',
      properties: {
        url: { type: 'STRING', description: '網路圖片 URL。' },
        alt: { type: 'STRING', description: '圖片替代描述文字。' },
        articleId: { type: 'STRING', description: '目標文章 ID。如果未指定，預設為當前活動文章。' }
      },
      required: ['url', 'alt']
    }
  }
];

export const agentAppManifest: AgentAppManifest = {
  agentAppId: 'class11-article-writer',
  agentAppName: 'AI 網路圖文作家',
  description: '協助議題研究、撰寫報導、並生成三種比例封面與短影音宣傳素材的一站式編輯器。',
  icon: 'article',
  route: '/class11-article-writer',
  courseId: 'course11',
  MainView: ArticleWriterPage,
  systemPrompt: articleWriterSystemPrompt,
  availableTools: articleWriterTools,
  sortOrder: 90,
};
