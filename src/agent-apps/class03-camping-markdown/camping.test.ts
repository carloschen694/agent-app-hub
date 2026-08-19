import { describe, it, expect } from 'vitest';
import { campingMarkdownSystemPrompt } from './prompts/campingMarkdownPrompt';

describe('class03-camping-markdown', () => {
  it('should compile system prompt correctly and contain store details', () => {
    expect(campingMarkdownSystemPrompt).toContain('客服助理');
    expect(campingMarkdownSystemPrompt).toContain('露營裝備出租店');
    expect(campingMarkdownSystemPrompt).toContain('商品清單');
  });
});
