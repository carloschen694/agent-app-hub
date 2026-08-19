import { describe, it, expect, beforeAll } from 'vitest';
import { parseGeminiError, buildContentsHistory } from './geminiService';
import { createGoogleGenAI } from '../../shared/auth';
import type { Message } from '../types/message';

// Mock window object for Node.js test environment
beforeAll(() => {
  global.window = {
    location: {
      hostname: 'localhost',
      origin: 'http://localhost:5173'
    }
  } as any;
});

describe('geminiService Unit Tests', () => {
  describe('parseGeminiError', () => {
    it('should parse 503 service busy error', () => {
      const error = new Error('503 Service Unavailable: overloaded');
      const result = parseGeminiError(error);
      expect(result.type).toBe('busy');
      expect(result.friendlyTitle).toContain('繁忙');
    });

    it('should parse invalid api key error', () => {
      const error = new Error('API_KEY_INVALID: API key not valid');
      const result = parseGeminiError(error);
      expect(result.type).toBe('api_key');
      expect(result.friendlyTitle).toContain('API Key');
    });

    it('should parse quota exceeded error', () => {
      const error = new Error('RESOURCE_EXHAUSTED: Quota exceeded');
      const result = parseGeminiError(error);
      expect(result.type).toBe('quota');
      expect(result.friendlyTitle).toContain('額度');
    });

    it('should fallback to unknown error for other errors', () => {
      const error = new Error('Some random network error');
      const result = parseGeminiError(error);
      expect(result.type).toBe('unknown');
      expect(result.friendlyTitle).toContain('未知錯誤');
    });
  });
});

describe('buildContentsHistory — 舊檢索結果折疊', () => {
  // 貼近真實檢索量級：courseRagService 的 MAX_TOTAL_CHARS 為 6000
  const slideContent = '這裡是很長的投影片內容。'.repeat(500);

  const courseCall = (id: string, slideNo: number): Message => ({
    id,
    sender: 'agent',
    content: `依據投影片，答案是 ${slideNo}。`,
    toolCallsInfo: [
      {
        name: 'queryCourseMaterials',
        args: { query: 'Tool Calling' },
        result: {
          query: 'Tool Calling',
          results: [
            {
              classId: 'class04',
              chapterTitle: 'Skills與工具函式(Tool Calling)實作',
              slideNo,
              slideTitle: '工具串接',
              sourceFile: 'class04/slides/slide.md',
              content: slideContent,
            },
          ],
        },
      },
    ],
  } as unknown as Message);

  const userMsg = (id: string, content: string): Message =>
    ({ id, sender: 'user', content } as unknown as Message);

  it('保留最近一輪的完整檢索內容', () => {
    const contents = buildContentsHistory([userMsg('u1', '問題一'), courseCall('a1', 7)]);
    const responses = JSON.stringify(contents);
    expect(responses).toContain(slideContent);
  });

  it('折疊較早輪次的檢索內容，只留來源引用', () => {
    const contents = buildContentsHistory([
      userMsg('u1', '問題一'),
      courseCall('a1', 7),
      userMsg('u2', '問題二'),
      courseCall('a2', 12),
    ]);

    const serialized = JSON.stringify(contents);
    // 舊輪次內容應消失，只出現一次（最近一輪）
    expect(serialized.split(slideContent).length - 1).toBe(1);
    expect(serialized).toContain('class04 Slide 07');
    expect(serialized).toContain('已於先前輪次檢索並用於回答');
  });

  it('context 不隨輪數線性膨脹（折疊前實測為 3.000 倍）', () => {
    const twoTurns = buildContentsHistory([userMsg('u1', 'q'), courseCall('a1', 1), userMsg('u2', 'q'), courseCall('a2', 2)]);
    const sixTurns = buildContentsHistory([
      userMsg('u1', 'q'), courseCall('a1', 1),
      userMsg('u2', 'q'), courseCall('a2', 2),
      userMsg('u3', 'q'), courseCall('a3', 3),
      userMsg('u4', 'q'), courseCall('a4', 4),
      userMsg('u5', 'q'), courseCall('a5', 5),
      userMsg('u6', 'q'), courseCall('a6', 6),
    ]);

    const growth = JSON.stringify(sixTurns).length / JSON.stringify(twoTurns).length;
    // 折疊前 6 輪 / 2 輪 = 3.000（每輪完整重播，精確線性）。折疊後殘餘的成長
    // 來自對話文字與摘要本身，那是應該保留的內容，不是重播的檢索結果。
    expect(growth).toBeLessThan(1.3);
  });

  it('functionCall 與 functionResponse 保持成對（Gemini contents 驗證要求）', () => {
    const contents = buildContentsHistory([
      userMsg('u1', 'q'), courseCall('a1', 1),
      userMsg('u2', 'q'), courseCall('a2', 2),
    ]);

    const callCount = contents.filter((c: any) => c.parts?.[0]?.functionCall).length;
    const responseCount = contents.filter((c: any) => c.parts?.[0]?.functionResponse).length;
    expect(callCount).toBe(2);
    expect(responseCount).toBe(2);
  });

  it('不影響沒有 results 結構的其他工具結果', () => {
    const other = {
      id: 'a1',
      sender: 'agent',
      content: '好了',
      toolCallsInfo: [{ name: 'someOtherTool', args: {}, result: { ok: true, value: 42 } }],
    } as unknown as Message;

    const contents = buildContentsHistory([userMsg('u1', 'q'), other, userMsg('u2', 'q'), courseCall('a2', 3)]);
    expect(JSON.stringify(contents)).toContain('"value":42');
  });
});

describe('auth helper - createGoogleGenAI', () => {
  it('creates a GoogleGenAI client directly with the given API key, no baseUrl override', () => {
    const realKey = 'AIzaSyTestKeyDirectGemini';
    const ai = createGoogleGenAI(realKey);

    const httpOptions = (ai as any)._httpOptions || (ai as any).httpOptions || {};
    expect(httpOptions.baseUrl).toBeUndefined();
    expect(ai).toBeDefined();
  });
});
