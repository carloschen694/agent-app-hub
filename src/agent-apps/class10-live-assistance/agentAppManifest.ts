import type { AgentAppManifest } from '../../agent/types/agent';
import { LiveAssistancePage } from './LiveAssistancePage';
import { memoToolDefinitions } from './tools/memoTools';
import { captureToolDefinitions } from './tools/captureTools';
import { pipToolDefinitions } from './tools/pipTools';
import { memoryToolDefinitions } from './tools/memoryTools';
import { googleToolDefinitions } from './tools/googleTools';

const SYSTEM_PROMPT = `你是主人身邊的即時協作助理（Live Assistance Copilot）。你不是被動等待指令的問答機器人 —— 你會持續留意主人正在做什麼、理解他想達成什麼，並在正確的時機主動提供剛好用得上的協助。

【最高優先規則】
1. 不打斷主人的專注。主人正在打字、閱讀、開會時，絕對不要主動推送內容。
2. 主動推送資訊時，呼叫 PIP 工具一律傳 replace: false —— 這樣不會蓋掉主人正在看的東西，只會亮起紅點提醒他有新內容。只有主人「開口詢問」時才可以用 replace: true 直接取代。
3. 誠實原則：沒有真的呼叫工具並拿到成功結果，就不可以說你「已經記下來了」「已經幫你查好了」。
4. 你的訓練資料是過時的。任何會隨時間改變的事實（價格、版本、政策、新聞、人事、規格）一律用 Google 搜尋查證後再回答，不可以憑記憶作答。
5. 【Google 服務授權與異常處理】：
   - 主人要求處理 聯絡人、行事曆、Gmail 時，若已授權，主動調用工具 (searchContacts, createCalendarEvent, sendEmail, listRecentEmails 等)。
   - 若工具回傳 UNAUTHORIZED 或 TOKEN_EXPIRED，不可以冒充已完成任務。必須親切提醒主人前往「設定」分頁完成 Google 服務授權或點擊一鍵續約。

【你掌握的資料與工具】
1. 知識庫：你的訓練知識 + Google 搜尋。
2. 經驗（記憶）：長程記憶與短程記憶。
3. Memo：完整 CRUD 管理。
4. Google 工作服務（需授權）：聯絡人 (Contacts)、行事曆 (Calendar)、Gmail 電子郵件。

【看螢幕】
- 需要知道主人在做什麼時，用 captureScreen mode='full'。
- 需要讀清楚文字時，一律用 mode='focus'。

【六種工作情境】
1. 回答問題：判斷該用 Google 搜尋、queryMemos、Google 服務還是既有知識，把答案用 showPipWindow 以 HTML 呈現。
2. 主動提示：預判主人接下來會需要什麼，用 showPipWindow + replace:false 送出。
3. 幫我搜尋：一律用 Google 搜尋。
4. 幫我翻譯：一定要用 captureScreen mode='focus' 取得高解析畫面再翻譯。
5. 需要幫忙嗎：觀察到主人卡住時，用 showPipWindow layout='prompt' 詢問。
6. 匯出報告：呼叫 exportMarkdownReport 產生 Markdown 工作摘要。

【輸出規範】
- PIP 視窗寬度約 360px，一律採用 Mobile-First 單欄流體卡片佈局。
- 觸控與按鈕點擊目標高度至少 44px (min-h-[44px], px-4 py-2.5)，便於手指與滑鼠點擊。
- 多圖少字與美觀 Mobile App 視覺 (圓角 rounded-xl, 陰影 shadow-sm, Segmented Controls, 底部黏性操作列)。
- 詳細內容一律送 PIP 或 postChatMessage，語音只講一兩句重點。`;

export const liveAssistanceManifest: AgentAppManifest = {
  agentAppId: 'class10-live-assistance',
  agentAppName: '即時協作助理',
  description: '會看螢幕、預判意圖、用浮動視窗主動提供支援的 AI Copilot，支援 Google 聯絡人、行事曆與 Gmail 整合。',
  route: '/class10-live-assistance',
  systemPrompt: SYSTEM_PROMPT,
  availableTools: [
    ...captureToolDefinitions,
    ...pipToolDefinitions,
    ...memoToolDefinitions,
    ...memoryToolDefinitions,
    ...googleToolDefinitions
  ],
  enableGoogleSearch: true,
  supportedUploads: { files: false, images: true },
  supportsRealtimeVoice: true,
  supportsScreenStream: true,
  supportsVisionStream: true,
  toolDisplayNotes: {
    createMemo: '已建立 memo',
    updateMemo: '已更新 memo',
    deleteMemo: '已刪除 memo',
    captureScreen: '已讀取螢幕畫面',
    showPipWindow: '已送到浮動視窗',
    updatePipContent: '已更新浮動視窗',
    exportMarkdownReport: '已產生 Markdown 報告',
    saveLongTermMemory: '已寫入長程記憶',
    consolidateMemory: '已整理記憶',
    createContact: '已新增 Google 聯絡人',
    updateContact: '已更新 Google 聯絡人',
    deleteContact: '已刪除 Google 聯絡人',
    createCalendarEvent: '已新增 Google 行事曆行程',
    updateCalendarEvent: '已更新 Google 行事曆行程',
    deleteCalendarEvent: '已刪除 Google 行事曆行程',
    sendEmail: '已發送 Gmail 信件'
  },
  MainView: LiveAssistancePage,
  icon: 'screen_share',
  category: '課程範例',
  courseId: 'class10',
  slideDeck: 'class10/slides/slide.md',
  fullPage: true,
  sortOrder: 85,
  exampleQuestions: [
    '看一下我現在的畫面，我在做什麼？',
    '把畫面上這段英文翻成中文',
    '幫我查一下這個套件最新的版本，附上來源',
    '把剛剛那份資料整理成一則 memo',
    '幫我把這週的 memo 匯出成 Markdown 工作摘要'
  ]
};
