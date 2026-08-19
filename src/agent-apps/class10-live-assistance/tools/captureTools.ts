import { createGoogleGenAI } from '../../../shared/auth';
import { toBareBase64 } from '../../../agent/services/liveInteractionService';
import type { ToolDefinition } from '../../../agent/types/agent';
import type { ToolHandler } from '../../../agent/types/tool';
import {
  grabCenterFocus,
  grabCrop,
  grabFull,
  getScreenSize,
  isCapturing
} from '../services/screenCaptureService';

export const captureToolDefinitions: ToolDefinition[] = [
  {
    name: 'captureScreen',
    description:
      '擷取主人目前的螢幕畫面並讀取內容。兩種模式：full 送整個畫面（縮到約 1024px，適合了解「主人在做什麼」，但小字會看不清楚）；focus 以原始像素裁切指定區域（文字銳利，翻譯、讀程式碼、讀表格一律用這個）。要用 focus 但還不知道該看哪裡時，先呼叫一次 full，從回傳的畫面尺寸與內容判斷座標，再呼叫 focus。',
    parameters: {
      type: 'OBJECT',
      properties: {
        mode: {
          type: 'STRING',
          description: "'full' 或 'focus'",
          enum: ['full', 'focus']
        },
        purpose: {
          type: 'STRING',
          description:
            '你想從這張畫面得到什麼，例如「把畫面上的英文段落逐句翻成繁體中文」「找出錯誤訊息」。會直接影響回傳內容的品質，務必寫清楚。'
        },
        x: { type: 'NUMBER', description: 'focus 模式：裁切區左上角 X（螢幕實際像素座標）' },
        y: { type: 'NUMBER', description: 'focus 模式：裁切區左上角 Y（螢幕實際像素座標）' },
        width: { type: 'NUMBER', description: 'focus 模式：裁切寬度，建議 1024' },
        height: { type: 'NUMBER', description: 'focus 模式：裁切高度，建議 1024' }
      },
      required: ['mode', 'purpose']
    }
  }
];

export interface CaptureToolDeps {
  apiKey: string;
  /** Vision model used to read the captured frame. */
  model: string;
  /** Pushes the frame into the running voice session, if there is one. */
  sendLiveVideoFrame: (base64Jpeg: string) => boolean;
  /** Lets memo tools attach whatever was captured most recently. */
  setLastScreenshot: (dataUrl: string) => void;
}

export function createCaptureToolHandlers(deps: CaptureToolDeps): Record<string, ToolHandler> {
  return {
    captureScreen: async (args) => {
      if (!isCapturing()) {
        return {
          captured: false,
          reason: '螢幕分享尚未開啟。請告訴主人到主畫面按「開始螢幕分享」，瀏覽器需要他親自授權。'
        };
      }

      const mode = args.mode === 'focus' ? 'focus' : 'full';
      const purpose = (args.purpose as string) || '描述這張畫面的內容';
      const screen = getScreenSize();

      let frame: string;
      let region: { x: number; y: number; width: number; height: number } | null = null;
      if (mode === 'focus') {
        const hasRegion =
          typeof args.x === 'number' &&
          typeof args.y === 'number' &&
          typeof args.width === 'number' &&
          typeof args.height === 'number';
        if (hasRegion) {
          region = {
            x: args.x as number,
            y: args.y as number,
            width: args.width as number,
            height: args.height as number
          };
          frame = grabCrop(region);
        } else {
          frame = grabCenterFocus();
        }
      } else {
        frame = grabFull();
      }

      deps.setLastScreenshot(frame);
      // In a voice session the model can also look at the frame directly.
      const sentToLive = deps.sendLiveVideoFrame(frame);

      // The function response carries JSON, not images, so a separate vision
      // call reads the frame and returns text the main agent can reason over.
      const ai = createGoogleGenAI(deps.apiKey);
      const response = await ai.models.generateContent({
        model: deps.model,
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: toBareBase64(frame) } },
              {
                text: `這是主人螢幕的${mode === 'focus' ? '局部高解析' : '全螢幕'}畫面。\n\n任務：${purpose}\n\n只回覆任務要求的內容，不要加開場白。看不清楚的地方直接說看不清楚，不要猜測或編造。`
              }
            ]
          }
        ]
      });

      return {
        captured: true,
        mode,
        screenSize: screen,
        region,
        sentToVoiceSession: sentToLive,
        reading: response.text?.trim() ?? '',
        note:
          mode === 'full'
            ? '這是縮圖，小字可能不準。需要讀清楚文字時，請用上面的 screenSize 判斷座標後改用 focus 模式重抓。'
            : '這是原始像素裁切圖，文字應該清楚可讀。'
      };
    }
  };
}
