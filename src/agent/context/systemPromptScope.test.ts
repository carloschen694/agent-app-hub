import { describe, expect, it } from 'vitest';
import { getScopeBlock, isShellContext, SHELL_APP_ID } from './systemPromptScope';

describe('isShellContext', () => {
  it('is true only for the dashboard (shell) app id', () => {
    expect(isShellContext(SHELL_APP_ID)).toBe(true);
    expect(isShellContext('class08-data-analysis')).toBe(false);
    expect(isShellContext('class09-proposal')).toBe(false);
    expect(isShellContext('')).toBe(false);
  });
});

describe('getScopeBlock', () => {
  it('restricts the shell agent to course content and instructs it to decline off-topic questions', () => {
    const block = getScopeBlock(SHELL_APP_ID, 'AI 小老師');
    expect(block).toContain('strictly limited to this course');
    expect(block).toContain('Do NOT answer such questions from your own general knowledge');
  });

  it('gives every non-shell agent-app full general-purpose capability with no course-topic restriction', () => {
    const block = getScopeBlock('class08-data-analysis', '數據分析');
    expect(block).toContain('using your full general knowledge and capability');
    expect(block).toContain('There is no course-topic restriction here');
    expect(block).not.toContain('strictly limited to this course');
    expect(block).toContain('數據分析');
  });

  it('falls back to the raw app id when no manifest name is available', () => {
    const block = getScopeBlock('class11-article-writer', undefined);
    expect(block).toContain('class11-article-writer');
  });
});
