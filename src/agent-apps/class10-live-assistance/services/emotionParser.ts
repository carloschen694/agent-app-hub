export type AvatarMood = 'happy' | 'thinking' | 'surprised' | 'sad' | 'neutral';

export interface EmotionParseResult {
  mood: AvatarMood;
  gesture?: string;
  cleanedText: string;
}

export function normalizeChunkText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

const LEXICON: Array<{ keywords: string[]; mood: AvatarMood; gesture?: string }> = [
  {
    keywords: ['happy', 'cheerful', 'excited', 'joyful', '開心', '太棒了', '好的', '沒問題', '棒'],
    mood: 'happy',
    gesture: 'nod'
  },
  {
    keywords: ['thinking', 'curious', 'puzzled', 'wondering', '思考', '疑問', '想想', '確認', '研究'],
    mood: 'thinking',
    gesture: 'tilt_head'
  },
  {
    keywords: ['surprised', 'astonished', 'amazing', '驚訝', '居然', '哇', '太神奇'],
    mood: 'surprised'
  },
  {
    keywords: ['sad', 'sorry', 'apologetic', 'regret', '抱歉', '遺憾', '可惜', '糟糕'],
    mood: 'sad',
    gesture: 'shake'
  }
];

export function parseStreamEmotion(textBuffer: string): EmotionParseResult {
  const cleanedText = normalizeChunkText(textBuffer);
  const lowerText = cleanedText.toLowerCase();

  for (const item of LEXICON) {
    if (item.keywords.some(kw => lowerText.includes(kw.toLowerCase()))) {
      return {
        mood: item.mood,
        gesture: item.gesture,
        cleanedText
      };
    }
  }

  return {
    mood: 'neutral',
    cleanedText
  };
}
