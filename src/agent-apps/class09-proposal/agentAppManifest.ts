import type { AgentAppManifest, ToolDefinition } from '../../agent/types/agent';
import { ProposalPage } from './ProposalPage';
import { ProposalCard } from './CardWidget';

const systemPrompt = `你是一位專業的企劃書撰寫助理，擅長幫助使用者從零開始規劃並撰寫完整的企劃書文件。

⚠️ 【最高優先規則：絕對禁止跳過確認步驟】
在呼叫 create_outline 之後，你必須：
1. 在對話中列出大綱章節給使用者看
2. 明確詢問：「這份大綱架構是否符合您的需求？確認後我才開始撰寫內容。」
3. 停止並等待使用者回應

只有在使用者明確表示「確認」、「可以」、「開始寫」、「OK」等同意語意後，才可以呼叫 write_section。
禁止在沒有獲得使用者確認的情況下，連續呼叫 create_outline → write_section。

【標準工作流程】
Step 1. 分析使用者需求（主題、用途、目標對象、語氣）
Step 2. 呼叫 create_outline 建立大綱 → 在對話中展示章節列表 → 等待使用者確認 ⚠️ 此步驟必須暫停
Step 3. 使用者確認後 → 逐節呼叫 write_section 生成內容，每節完成後更新進度
Step 4. 全部完成 → 詢問是否需要修改、調整或發布版本

【工具使用時機】
- create_outline：使用者描述需求或要求「規劃大綱」時
- write_section：使用者明確確認大綱、說「開始撰寫」或「可以」後，才可使用
- refine_section：使用者對某節提出修改意見時
- update_block：使用者指定修改某個具體段落或區塊時
- get_document_state：需要查看目前文件結構、取得段落 ID 或確認完成進度時
- publish_version：使用者說「發布版本」或「記錄現在的進度」時

【輸出規範】
- 所有文件內容使用繁體中文
- 語氣專業、簡潔，避免贅詞
- 企劃書應涵蓋：背景說明、目標、執行計畫、時程、預算（如適用）、預期成果

【Markdown 撰寫規則 — 重要】
paragraph block 的 content 欄位支援完整 Markdown，**請以 Markdown 為主要撰寫格式**：
- 粗體用 \`**文字**\`、斜體用 \`*文字*\`、行內程式碼用 \`code\`
- 段落內的小標題用 \`### 小標\`（h3 層級）
- 段落內的列表用 \`- 項目\` 或 \`1. 項目\`（有序 / 無序）
- 需要特別強調的重點用 \`> 引用區塊\`
- 大量列表項目優先寫在 paragraph block 的 markdown 裡，而非拆成多個 list_item block

Block 類型使用原則：
- \`paragraph\`：主要內容，**大量使用 markdown 語法讓格式豐富**
- \`h2\`：節內的主要分區標題（大標）
- \`h3\`：節內的次級標題（小標），若標題不多可直接寫在 paragraph 的 \`### \` 裡
- \`list_item\`：短條列項目（每條一行，無子內容）
- \`table\`：需要 tableContent 二維陣列的表格資料

【互動原則】
- 回答簡短，重點留給工具呼叫和文件內容
- 完成每節後回報進度（「第 X/Y 節完成」）
- 完成全文後詢問是否需要修改或發布版本`;

const tools: ToolDefinition[] = [
  {
    name: 'get_document_state',
    description: '取得目前開啟文件的完整資料結構，包含所有段落 ID、標題、已生成的內容及完成狀態。在撰寫或修改任何內容前，應先呼叫此工具以確認段落 ID。',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'create_outline',
    description: '建立企劃書大綱。依使用者需求設定文件標題、用途、目標對象、語氣，並規劃各節結構。若目前無開啟文件，系統會自動建立新文件。',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: '企劃書標題' },
        purpose: { type: 'STRING', description: '文件用途或目的的一句話描述' },
        targetAudience: { type: 'STRING', description: '目標讀者或審核對象' },
        tone: { type: 'STRING', description: '文件語氣，例如：專業、活潑、正式、創意。預設為「專業」。' },
        sections: {
          type: 'ARRAY',
          description: '各節大綱清單',
          items: {
            type: 'OBJECT',
            properties: {
              title: { type: 'STRING', description: '節標題' },
              description: { type: 'STRING', description: '此節的內容說明（用於佔位符提示）' },
            },
            required: ['title'],
          },
        },
      },
      required: ['title', 'sections'],
    },
  },
  {
    name: 'write_section',
    description: '為指定段落生成正文內容。使用 blocks 陣列描述完整段落結構，區塊類型可混搭（h2/h3 小標、paragraph 段落、list_item 列表項目、table 表格）。',
    parameters: {
      type: 'OBJECT',
      properties: {
        sectionId: { type: 'STRING', description: '目標段落的 ID（請先呼叫 get_document_state 取得）' },
        blocks: {
          type: 'ARRAY',
          description: '段落內容區塊清單',
          items: {
            type: 'OBJECT',
            properties: {
              type: {
                type: 'STRING',
                description: '區塊類型：h2、h3、paragraph、list_item、table',
              },
              content: {
                type: 'STRING',
                description: '文字內容（table 類型請改用 tableContent）',
              },
              tableContent: {
                type: 'ARRAY',
                description: '表格內容（二維陣列，第一列為表頭）',
                items: { type: 'ARRAY', items: { type: 'STRING' } },
              },
            },
            required: ['type'],
          },
        },
      },
      required: ['sectionId', 'blocks'],
    },
  },
  {
    name: 'refine_section',
    description: '依使用者回饋修改指定段落的內容。以全新 blocks 取代原有內容（請保留使用者未要求刪除的核心資訊）。',
    parameters: {
      type: 'OBJECT',
      properties: {
        sectionId: { type: 'STRING', description: '要修改的段落 ID' },
        blocks: {
          type: 'ARRAY',
          description: '修改後的完整區塊清單（同 write_section 格式）',
          items: {
            type: 'OBJECT',
            properties: {
              type: { type: 'STRING', description: 'h2、h3、paragraph、list_item、table' },
              content: { type: 'STRING', description: '文字內容' },
              tableContent: {
                type: 'ARRAY',
                items: { type: 'ARRAY', items: { type: 'STRING' } },
              },
            },
            required: ['type'],
          },
        },
      },
      required: ['sectionId', 'blocks'],
    },
  },
  {
    name: 'update_block',
    description: '更新指定段落中的單一區塊內容（適用於局部微調，不需重寫整節）。',
    parameters: {
      type: 'OBJECT',
      properties: {
        sectionId: { type: 'STRING', description: '所在段落 ID' },
        blockId: { type: 'STRING', description: '目標區塊 ID' },
        type: { type: 'STRING', description: '區塊類型' },
        content: { type: 'STRING', description: '更新後的文字內容' },
      },
      required: ['sectionId', 'blockId', 'type', 'content'],
    },
  },
  {
    name: 'publish_version',
    description: '發布目前文件的版本快照，並自動遞增版本號。請根據本次修改幅度選擇版本類型。',
    parameters: {
      type: 'OBJECT',
      properties: {
        versionType: {
          type: 'STRING',
          description: '版本遞增類型：major（重大改版）、minor（新增段落/功能）、patch（小幅修改）',
        },
        changeDescription: {
          type: 'STRING',
          description: '本版本的變更摘要描述',
        },
      },
      required: ['versionType', 'changeDescription'],
    },
  },
];

export const agentAppManifest: AgentAppManifest = {
  agentAppId: 'class09-proposal',
  agentAppName: 'AI 企劃書撰寫助手',
  description: '透過對話式 AI 協助規劃大綱、逐節撰寫與修改，快速完成專業企劃書文件。',
  icon: 'description',
  route: '/class09-proposal',
  courseId: 'course09',
  sortOrder: 80,
  MainView: ProposalPage,
  CardWidget: ProposalCard,
  systemPrompt,
  availableTools: tools,
  exampleQuestions: [
    '幫我寫一份公司年度旅遊企劃書',
    '我需要一份新產品上市行銷企劃',
    '幫我規劃社區活動的活動企劃書',
    '請幫我建立一份軟體開發專案提案',
  ],
  toolFollowups: {
    create_outline: [
      { label: '✏️ 開始撰寫全文', action: '大綱確認，請開始逐節撰寫內容' },
      { label: '🔄 調整大綱', action: '請調整大綱結構' },
    ],
    write_section: [
      { label: '▶ 繼續撰寫下一節', action: '請繼續撰寫下一個段落' },
      { label: '🔍 修改這一節', action: '請修改剛才撰寫的段落' },
    ],
    update_block: [
      { label: '↩ 再改一次', action: '請再修改一次，調整得更精簡' },
      { label: '✓ 繼續下一節', action: '這一節修改完成，請繼續撰寫下一個段落' },
    ],
    publish_version: [
      { label: '📄 查看版本紀錄', action: '幫我說明版本紀錄的使用方式' },
    ],
  },
  toolDisplayNotes: {
    create_outline: '大綱已建立，可在左側文件畫布查看結構',
    write_section: '段落內容已更新',
    refine_section: '段落已修改',
    update_block: '區塊已更新',
    publish_version: '版本已發布',
  },
};
