import { Type } from '@google/genai';
import { createGoogleGenAI } from '../../../shared/auth';
import { grabFull, isCapturing } from './screenCaptureService';
import { buildObserverPrompt } from '../prompts/observerPrompt';
import { toBareBase64 } from '../../../agent/services/liveInteractionService';

/**
 * The proactive "watching" channel.
 *
 * This deliberately does NOT ride the live voice session: a Live API session
 * that carries video is capped at 2 minutes, which is useless for an
 * assistant meant to watch all afternoon. Instead a cheap unary call reads
 * one low-resolution frame every N seconds and decides whether anything is
 * worth surfacing. Voice stays on its own, longer-lived session.
 */

export interface ObserverVerdict {
  /** One line describing what the user appears to be doing. */
  activity: string;
  /** The goal the user seems to be working toward, if inferable. */
  intent?: string;
  /** True when the user looks stuck (case 5). */
  strugglingSignal: boolean;
  /** Whether anything is worth putting on screen at all. */
  shouldNotify: boolean;
  /** Markdown-ish body for the overlay when shouldNotify is true. */
  note?: string;
  /** A short question to ask when strugglingSignal is true. */
  offer?: string;
}

const VERDICT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    activity: { type: Type.STRING, description: '一句話描述使用者目前正在做什麼' },
    intent: { type: Type.STRING, description: '推測使用者想達成的目標' },
    strugglingSignal: { type: Type.BOOLEAN, description: '使用者是否看起來卡住了' },
    shouldNotify: { type: Type.BOOLEAN, description: '是否值得主動提示（絕大多數情況應為 false）' },
    note: { type: Type.STRING, description: 'shouldNotify 為 true 時要顯示的提示內容' },
    offer: { type: Type.STRING, description: 'strugglingSignal 為 true 時要問使用者的一句話' }
  },
  required: ['activity', 'strugglingSignal', 'shouldNotify']
};

export interface ObserverOptions {
  apiKey: string;
  model: string;
  intervalMs: number;
  /** Personality + memory text, so the observer judges in context. */
  buildContext: () => string;
  onVerdict: (verdict: ObserverVerdict, frameDataUrl: string) => void;
  onError?: (error: unknown) => void;
  onTick?: (at: number) => void;
}

export interface ObserverHandle {
  stop: () => void;
}

/**
 * Maps the personality's proactiveness dial onto how often we look at the
 * screen. A pushier assistant checks more often; a reserved one stays quiet
 * and costs fewer tokens.
 */
export function intervalForProactiveness(level: number): number {
  const table: Record<number, number> = {
    1: 120_000,
    2: 90_000,
    3: 60_000,
    4: 40_000,
    5: 25_000
  };
  return table[level] ?? 60_000;
}

export function startObserver(options: ObserverOptions): ObserverHandle {
  const ai = createGoogleGenAI(options.apiKey);
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastActivity = '';

  const tick = async () => {
    if (stopped) return;
    try {
      if (isCapturing()) {
        const frame = grabFull(0.6);
        const response = await ai.models.generateContent({
          model: options.model,
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType: 'image/jpeg', data: toBareBase64(frame) } },
                { text: buildObserverPrompt(options.buildContext(), lastActivity) }
              ]
            }
          ],
          config: {
            responseMimeType: 'application/json',
            responseSchema: VERDICT_SCHEMA as any
          }
        });

        const text = response.text?.trim();
        if (text) {
          const verdict = JSON.parse(text) as ObserverVerdict;
          lastActivity = verdict.activity ?? lastActivity;
          options.onVerdict(verdict, frame);
        }
        options.onTick?.(Date.now());
      }
    } catch (error) {
      // A single bad frame or transient API error must not kill the loop.
      options.onError?.(error);
    } finally {
      if (!stopped) timer = setTimeout(tick, options.intervalMs);
    }
  };

  timer = setTimeout(tick, options.intervalMs);

  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
    }
  };
}
