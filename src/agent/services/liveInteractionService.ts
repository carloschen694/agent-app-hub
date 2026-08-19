import { GoogleGenAI, Modality } from '@google/genai';
import type { ToolDefinition } from '../types/agent';
import { executeTool, type ToolHandlerMap } from './toolExecutionService';

export type LiveInteractionStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'speaking'
  | 'interrupted'
  | 'error';

export interface LiveInteractionCallbacks {
  onStatusChange?: (status: LiveInteractionStatus) => void;
  onInputTranscript?: (text: string) => void;
  onOutputTranscript?: (text: string) => void;
  onInterrupted?: () => void;
  onError?: (error: unknown) => void;
}

export interface StartLiveInteractionOptions {
  apiKey: string;
  apiVersion?: 'v1alpha';
  model: string;
  systemPrompt: string;
  tools: ToolDefinition[];
  toolHandlers?: ToolHandlerMap;
  voiceName?: string;
  /**
   * Token/detail tradeoff for image and video input, e.g.
   * 'MEDIA_RESOLUTION_LOW' | 'MEDIA_RESOLUTION_MEDIUM' | 'MEDIA_RESOLUTION_HIGH'.
   */
  mediaResolution?: string;
  callbacks?: LiveInteractionCallbacks;
  GoogleGenAICtor?: typeof GoogleGenAI;
}

export interface LiveInteractionSession {
  stop: () => void;
  sendText: (text: string) => void;
  /**
   * Pushes one screen/camera frame into the live session as an image.
   * The Live API accepts at most 1 frame per second, so calls that arrive
   * sooner than MIN_VIDEO_FRAME_INTERVAL_MS are dropped rather than queued —
   * a stale frame is worthless to a realtime assistant.
   * Returns whether the frame was actually sent.
   */
  sendVideoFrame: (base64Jpeg: string) => boolean;
}

/** Live API limit: video frames are accepted at a maximum of 1 fps. */
export const MIN_VIDEO_FRAME_INTERVAL_MS = 1000;

export const DEFAULT_LIVE_MEDIA_RESOLUTION = 'MEDIA_RESOLUTION_MEDIUM';

/** Strips a `data:image/jpeg;base64,` prefix if the caller passed a data URL. */
export function toBareBase64(value: string): string {
  const commaIndex = value.indexOf(',');
  return value.startsWith('data:') && commaIndex >= 0 ? value.slice(commaIndex + 1) : value;
}

export function isLiveModel(model: string): boolean {
  return model.includes('live') || model.includes('exp') || model === 'gemini-2.5-flash' || model === 'gemini-1.5-flash';
}

export const LIVE_VOICES = [
  'Puck',
  'Charon',
  'Kore',
  'Fenrir',
  'Aoede',
  'Leda',
  'Orus',
  'Zephyr'
] as const;

export const DEFAULT_LIVE_VOICE = 'Puck';

/**
 * The @google/genai SDK's live.connect() promise only resolves via onopen
 * and never rejects, so a connection the server refuses to open (invalid or
 * expired credential, bad model) hangs forever without this guard.
 */
export const LIVE_CONNECT_TIMEOUT_MS = 15000;

/**
 * Style and honesty rules appended to the system prompt for live voice
 * sessions. Audio is the model's only direct output channel, so any detailed
 * deliverable must go through the postChatMessage tool — otherwise the model
 * tends to *say* it delivered content while nothing appears in chat.
 */
export const LIVE_VOICE_STYLE_PROMPT = `
---
VOICE RESPONSE RULES（語音對談守則）:
1. 這是「語音」對談：省略社交辭令、客套話與開場白，直接講重點，精準簡潔。
2. 除非使用者要求詳細說明，單次語音回覆以三句話為上限。
3. 誠實原則：絕對不要說你「已提供／已附上／已產生」任何報告、清單或文件，除非你在本次對話中確實呼叫了對應工具並收到成功結果。
4. 需要提供詳細資料、報告、比較表或任何長內容時：先呼叫 postChatMessage 工具把完整內容發佈到聊天視窗，再用一兩句話口頭總結重點，並請使用者到聊天視窗查看。
5. 判斷請求需要較長時間處理（大量資料蒐集、多主題研究）時：呼叫 planLongTasks 工具（務必附上 objective 一句話描述整體目標），系統會在背景執行並把進度與結果顯示在聊天視窗；你只需口頭告知使用者「任務已開始，可打開聊天視窗查看進度」。`;

export const POST_CHAT_MESSAGE_TOOL: ToolDefinition = {
  name: 'postChatMessage',
  description:
    '將詳細的文字內容（報告摘要、清單、比較表、長篇說明）以 Markdown 訊息發佈到聊天視窗供使用者閱讀。此工具只寫入聊天視窗，與 Main View 無關。語音對談中，所有詳細內容都必須透過此工具提供；語音本身只做一兩句話的重點摘要。',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: '內容標題（選填）' },
      content: {
        type: 'string',
        description: '要顯示在聊天視窗的完整內容，可使用 Markdown 格式'
      }
    },
    required: ['content']
  }
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function downsampleBuffer(buffer: Float32Array, inputRate: number, outputRate: number): Float32Array {
  if (outputRate === inputRate) return buffer;
  const ratio = inputRate / outputRate;
  const outputLength = Math.round(buffer.length / ratio);
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i += 1) {
    const start = Math.floor(i * ratio);
    const end = Math.floor((i + 1) * ratio);
    let sum = 0;
    let count = 0;
    for (let j = start; j < end && j < buffer.length; j += 1) {
      sum += buffer[j];
      count += 1;
    }
    output[i] = count > 0 ? sum / count : 0;
  }
  return output;
}

function float32ToPcm16Base64(buffer: Float32Array): string {
  const pcm = new Int16Array(buffer.length);
  for (let i = 0; i < buffer.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, buffer[i]));
    pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return arrayBufferToBase64(pcm.buffer);
}

function extractRate(mimeType?: string, fallback = 24000): number {
  const match = mimeType?.match(/rate=(\d+)/);
  return match ? Number(match[1]) : fallback;
}

interface PlaybackQueue {
  nextStartTime: number;
}

function playPcm16Audio(
  base64Data: string,
  mimeType: string | undefined,
  audioContext: AudioContext,
  activeSources: AudioBufferSourceNode[],
  playbackQueue: PlaybackQueue,
  onQueueDrained?: () => void
) {
  const rate = extractRate(mimeType);
  const pcm = new Int16Array(base64ToArrayBuffer(base64Data));
  const audioBuffer = audioContext.createBuffer(1, pcm.length, rate);
  const channel = audioBuffer.getChannelData(0);
  for (let i = 0; i < pcm.length; i += 1) {
    channel[i] = pcm[i] / 0x8000;
  }

  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);
  source.onended = () => {
    const index = activeSources.indexOf(source);
    if (index >= 0) activeSources.splice(index, 1);
    if (activeSources.length === 0) onQueueDrained?.();
  };
  activeSources.push(source);

  // Chunks must play back-to-back: schedule each one right after the
  // previous chunk ends, never on top of it.
  const startAt = Math.max(audioContext.currentTime, playbackQueue.nextStartTime);
  source.start(startAt);
  playbackQueue.nextStartTime = startAt + audioBuffer.duration;
}

async function createMicWorklet(audioContext: AudioContext): Promise<AudioWorkletNode> {
  const workletCode = `
class GeminiMicProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0]?.[0];
    if (input) {
      const copy = new Float32Array(input.length);
      copy.set(input);
      this.port.postMessage(copy, [copy.buffer]);
    }
    return true;
  }
}
registerProcessor('gemini-mic-processor', GeminiMicProcessor);
`;
  const workletUrl = URL.createObjectURL(
    new Blob([workletCode], { type: 'application/javascript' })
  );
  try {
    await audioContext.audioWorklet.addModule(workletUrl);
  } finally {
    URL.revokeObjectURL(workletUrl);
  }

  return new AudioWorkletNode(audioContext, 'gemini-mic-processor', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1]
  });
}

export async function startLiveInteraction({
  apiKey,
  apiVersion,
  model,
  systemPrompt,
  tools,
  toolHandlers = {},
  voiceName = DEFAULT_LIVE_VOICE,
  mediaResolution = DEFAULT_LIVE_MEDIA_RESOLUTION,
  callbacks,
  GoogleGenAICtor = GoogleGenAI
}: StartLiveInteractionOptions): Promise<LiveInteractionSession> {
  // Use GoogleGenAI directly without Gateway baseUrl for Live WebSocket,
  // as Gateway/BFF does not proxy Gemini Live WebSockets.
  const ai = new GoogleGenAICtor({
    apiKey,
    ...(apiVersion ? { httpOptions: { apiVersion } } : {})
  });
  callbacks?.onStatusChange?.('connecting');
  let liveSession: any;
  const mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  });
  const audioContext = new AudioContext();
  await audioContext.resume();
  const sourceNode = audioContext.createMediaStreamSource(mediaStream);
  const processor = await createMicWorklet(audioContext);
  const mutedOutput = audioContext.createGain();
  const activePlaybackSources: AudioBufferSourceNode[] = [];
  const playbackQueue: PlaybackQueue = { nextStartTime: 0 };
  mutedOutput.gain.value = 0;
  let cleanedUp = false;
  let resumptionHandle: string | null = null;
  let lastVideoFrameAt = 0;

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    try {
      processor.disconnect();
      sourceNode.disconnect();
      mutedOutput.disconnect();
    } catch {
      // Nodes may already be disconnected.
    }
    mediaStream.getTracks().forEach(track => track.stop());
    activePlaybackSources.splice(0).forEach(source => {
      try {
        source.stop();
      } catch {
        // Source may have already ended.
      }
    });
    void audioContext.close();
  };

  const connectLiveSession = async (handleToResume?: string | null) => {
    // The SDK's connect() promise only resolves via onopen and has no
    // reject path: if the server rejects the connection (invalid/expired
    // credential, bad model) before ever opening, it awaits forever. Race
    // it against a timeout so callers can't get stuck indefinitely. The
    // timer is cleared as soon as the race settles either way — an
    // uncleared Promise.race loser that rejects later (here, ~15s after a
    // perfectly successful connect) becomes an unhandled rejection on its
    // own, independent of whichever branch actually won.
    let timeoutId!: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error('Live 連線逾時，請確認您填的 API Key 或 Live token 沒有過期或無效。')),
        LIVE_CONNECT_TIMEOUT_MS
      );
    });
    try {
      liveSession = await Promise.race([
        ai.live.connect({
          model,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName }
              }
            },
            systemInstruction: { parts: [{ text: systemPrompt }] },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            mediaResolution,
            sessionResumption: handleToResume ? { handle: handleToResume } : {},
            contextWindowCompression: { slidingWindow: {} },
            realtimeInputConfig: {
              automaticActivityDetection: {
                disabled: false,
                startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH',
                endOfSpeechSensitivity: 'END_SENSITIVITY_LOW'
              }
            },
            tools: [
              { googleSearch: {} },
              ...(tools.length > 0
                ? [{
                    functionDeclarations: tools.map(tool => ({
                      name: tool.name,
                      description: tool.description,
                      parameters: tool.parameters
                    }))
                  }]
                : [])
            ]
          } as any,
          callbacks: {
            onopen: () => callbacks?.onStatusChange?.('listening'),
            onmessage: async (response: any) => {
              if (response.sessionResumptionUpdate?.handle) {
                resumptionHandle = response.sessionResumptionUpdate.handle;
              }
              if (response.toolCall?.functionCalls?.length) {
                const functionResponses = await Promise.all(
                  response.toolCall.functionCalls.map(async (call: any) => ({
                    id: call.id,
                    name: call.name,
                    response: await executeTool(call.name, call.args ?? {}, toolHandlers)
                  }))
                );
                liveSession.sendToolResponse({ functionResponses });
                return;
              }

              const content = response.serverContent;
              if (content?.inputTranscription?.text) {
                callbacks?.onInputTranscript?.(content.inputTranscription.text);
              }
              if (content?.outputTranscription?.text) {
                callbacks?.onOutputTranscript?.(content.outputTranscription.text);
              }
              if (content?.interrupted) {
                callbacks?.onStatusChange?.('interrupted');
                activePlaybackSources.splice(0).forEach(source => {
                  try {
                    source.stop();
                  } catch {
                    // Source may have already ended.
                  }
                });
                // Drop any audio scheduled in the future so the next reply
                // starts immediately instead of after the cancelled tail.
                playbackQueue.nextStartTime = 0;
                callbacks?.onInterrupted?.();
                callbacks?.onStatusChange?.('listening');
              }
              const audioParts = content?.modelTurn?.parts?.filter((part: any) => part.inlineData) ?? [];
              if (audioParts.length > 0) {
                callbacks?.onStatusChange?.('speaking');
                for (const part of audioParts) {
                  playPcm16Audio(
                    part.inlineData.data,
                    part.inlineData.mimeType,
                    audioContext,
                    activePlaybackSources,
                    playbackQueue,
                    () => {
                      if (!cleanedUp) callbacks?.onStatusChange?.('listening');
                    }
                  );
                }
              }
            },
            onerror: (error: unknown) => {
              cleanup();
              callbacks?.onStatusChange?.('error');
              callbacks?.onError?.(error);
            },
            onclose: (event: any) => {
              if (cleanedUp) return;
              if (resumptionHandle) {
                // Attempt seamless reconnection using the last resumption handle.
                connectLiveSession(resumptionHandle).catch(() => {
                  cleanup();
                  callbacks?.onStatusChange?.('idle');
                });
                return;
              }
              // A close with no resumption handle while we never called stop()
              // ourselves is not a normal end of conversation — it's usually an
              // expired/invalid/rejected credential or a model/config error from
              // Google. Surface it instead of silently going idle.
              cleanup();
              callbacks?.onStatusChange?.('error');
              callbacks?.onError?.(new Error(
                event?.reason ? `Live 連線已中斷：${event.reason}` : 'Live 連線意外中斷，請重新開始語音對話。'
              ));
            }
          }
        } as any),
        timeoutPromise
      ]);
    } finally {
      clearTimeout(timeoutId);
    }
  };

  await connectLiveSession();

  processor.port.onmessage = (event: MessageEvent<Float32Array>) => {
    const input = event.data;
    const downsampled = downsampleBuffer(input, audioContext.sampleRate, 16000);
    liveSession.sendRealtimeInput({
      audio: {
        data: float32ToPcm16Base64(downsampled),
        mimeType: 'audio/pcm;rate=16000'
      }
    });
  };

  sourceNode.connect(processor);
  processor.connect(mutedOutput);
  mutedOutput.connect(audioContext.destination);
  callbacks?.onStatusChange?.('listening');

  return {
    stop: () => {
      try {
        liveSession.sendRealtimeInput({ audioStreamEnd: true });
        cleanup();
        liveSession.close();
      } finally {
        callbacks?.onStatusChange?.('idle');
      }
    },
    sendText: (text: string) => {
      liveSession.sendRealtimeInput({ text });
    },
    sendVideoFrame: (base64Jpeg: string) => {
      if (cleanedUp || !base64Jpeg) return false;
      const now = Date.now();
      if (now - lastVideoFrameAt < MIN_VIDEO_FRAME_INTERVAL_MS) return false;
      lastVideoFrameAt = now;
      liveSession.sendRealtimeInput({
        video: { data: toBareBase64(base64Jpeg), mimeType: 'image/jpeg' }
      });
      return true;
    }
  };
}
