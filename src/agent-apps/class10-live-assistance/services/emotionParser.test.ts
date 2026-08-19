import { describe, it, expect } from 'vitest';
import { parseStreamEmotion, normalizeChunkText } from './emotionParser';

describe('emotionParser', () => {
  it('normalizes chunk text by stripping redundant whitespace and line breaks', () => {
    expect(normalizeChunkText('  好的  \n  這份   資料  ')).toBe('好的 這份 資料');
  });

  it('matches emotion keywords correctly from text buffer', () => {
    const result1 = parseStreamEmotion('I am super happy to help with this!');
    expect(result1.mood).toBe('happy');
    expect(result1.gesture).toBe('nod');

    const result2 = parseStreamEmotion('讓我想想，思考一下這個問題');
    expect(result2.mood).toBe('thinking');
    expect(result2.gesture).toBe('tilt_head');

    const result3 = parseStreamEmotion('這是普通的文字內容');
    expect(result3.mood).toBe('neutral');
  });
});
