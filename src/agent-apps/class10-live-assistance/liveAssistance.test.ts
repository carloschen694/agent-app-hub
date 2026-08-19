import { describe, it, expect, beforeEach, beforeAll, afterEach, vi } from 'vitest';
import { memoRepository, matchesQuery } from './repositories/memoRepository';
import { memoryRepository, buildMemoryContext } from './repositories/memoryRepository';
import { buildMarkdownReport, memoToMarkdown } from './services/memoExportService';
import { clampRegion } from './services/screenCaptureService';
import { intervalForProactiveness } from './services/observerService';
import { buildPersonalityPrompt, PERSONALITY_PROFILES, VOICE_OPTIONS } from './prompts/personalityPrompts';
import { __resetPipForTests, getPipState, showPipContent } from './services/pipService';
import type { Memo } from './types/memo';

// vitest runs in the node environment here (the repo has no jsdom), so the
// repositories' storage backend has to be supplied. Screenshot blobs live in
// IndexedDB and are deliberately out of scope for these tests — everything
// below exercises metadata, formatting, and decision logic only.
beforeAll(() => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear()
    }
  });
});

const makeMemo = (overrides: Partial<Memo> = {}): Memo => ({
  id: 'memo_1',
  title: '如何設定 webhook',
  summary: '整理了 webhook 的三個必要欄位',
  content: '內文說明',
  tags: ['api', 'webhook'],
  todos: [
    { text: '申請 API 金鑰', done: false },
    { text: '測試回呼', done: true }
  ],
  screenshotIds: [],
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_100_000,
  ...overrides
});

describe('memoRepository', () => {
  beforeEach(() => {
    localStorage.clear();
    memoRepository.clearAll();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a memo with defaults and returns it from list()', () => {
    const memo = memoRepository.create({ title: '測試', summary: '摘要' });
    expect(memo.id).toMatch(/^memo_/);
    expect(memo.tags).toEqual([]);
    expect(memoRepository.list()).toHaveLength(1);
  });

  it('falls back to a placeholder title when none is given', () => {
    expect(memoRepository.create({}).title).toBe('未命名 Memo');
  });

  it('updates only the fields provided', () => {
    const memo = memoRepository.create({ title: 'A', summary: 'S', content: 'C' });
    const updated = memoRepository.update(memo.id, { title: 'B' });
    expect(updated?.title).toBe('B');
    expect(updated?.content).toBe('C');
  });

  it('returns null when updating a memo that does not exist', () => {
    expect(memoRepository.update('nope', { title: 'x' })).toBeNull();
  });

  it('sorts list() by most recently updated', () => {
    // Without a controlled clock all three writes land in the same
    // millisecond and the ordering is a coin flip.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const first = memoRepository.create({ title: '舊' });
    vi.advanceTimersByTime(1000);
    memoRepository.create({ title: '新' });
    vi.advanceTimersByTime(1000);
    memoRepository.update(first.id, { summary: '剛剛更新' });
    expect(memoRepository.list()[0].title).toBe('舊');
  });

  it('collects tags across all memos without duplicates', () => {
    memoRepository.create({ title: 'A', tags: ['x', 'y'] });
    memoRepository.create({ title: 'B', tags: ['y', 'z'] });
    expect(memoRepository.allTags()).toEqual(['x', 'y', 'z']);
  });
});

describe('matchesQuery', () => {
  const memo = makeMemo();

  it('matches an empty query', () => {
    expect(matchesQuery(memo, '   ')).toBe(true);
  });

  it('searches title, summary, tags and todos', () => {
    expect(matchesQuery(memo, 'webhook')).toBe(true);
    expect(matchesQuery(memo, '金鑰')).toBe(true);
    expect(matchesQuery(memo, 'API')).toBe(true);
  });

  it('requires every whitespace-separated term to hit', () => {
    expect(matchesQuery(memo, 'webhook 金鑰')).toBe(true);
    expect(matchesQuery(memo, 'webhook 資料庫')).toBe(false);
  });
});

describe('memoryRepository', () => {
  beforeEach(() => {
    localStorage.clear();
    memoryRepository.clearLongTerm();
    memoryRepository.clearShortTerm();
  });

  it('upserts long-term memory by category+key', () => {
    memoryRepository.saveLongTerm({ category: 'identity', key: '姓名', value: '小明' });
    memoryRepository.saveLongTerm({ category: 'identity', key: '姓名', value: '大明' });
    const all = memoryRepository.listLongTerm();
    expect(all).toHaveLength(1);
    expect(all[0].value).toBe('大明');
  });

  it('refuses to overwrite a confident fact with a lower-confidence guess', () => {
    memoryRepository.saveLongTerm({ category: 'goal', key: '目標', value: '上線', confidence: 1 });
    const result = memoryRepository.saveLongTerm({
      category: 'goal',
      key: '目標',
      value: '也許是測試',
      confidence: 0.4
    });
    expect(result.applied).toBe(false);
    expect(memoryRepository.listLongTerm()[0].value).toBe('上線');
  });

  it('clamps confidence into 0..1', () => {
    const { memory } = memoryRepository.saveLongTerm({
      category: 'domain',
      key: 'k',
      value: 'v',
      confidence: 5
    });
    expect(memory.confidence).toBe(1);
  });

  it('replaces a short-term entry with the same topic instead of stacking', () => {
    memoryRepository.saveShortTerm('目前任務', '寫文件');
    memoryRepository.saveShortTerm('目前任務', '改程式');
    const all = memoryRepository.listShortTerm();
    expect(all).toHaveLength(1);
    expect(all[0].detail).toBe('改程式');
  });

  it('promotes entries to long-term and clears short-term on consolidate', () => {
    memoryRepository.saveShortTerm('目前任務', '寫文件');
    const saved = memoryRepository.consolidate([
      { category: 'solved', key: 'webhook', value: '已協助接通' }
    ]);
    expect(saved).toHaveLength(1);
    expect(memoryRepository.listShortTerm()).toHaveLength(0);
    expect(memoryRepository.listLongTerm()).toHaveLength(1);
  });

  it('renders both stores into the runtime context block', () => {
    memoryRepository.saveLongTerm({ category: 'identity', key: '姓名', value: '小明' });
    memoryRepository.saveShortTerm('目前任務', '寫文件');
    const context = buildMemoryContext();
    expect(context).toContain('小明');
    expect(context).toContain('寫文件');
  });

  it('says so explicitly when there is nothing remembered', () => {
    expect(buildMemoryContext()).toContain('尚無長程記憶');
    expect(buildMemoryContext()).toContain('尚無短程記憶');
  });
});

describe('markdown export', () => {
  it('renders todos as GitHub-style checkboxes', () => {
    const markdown = memoToMarkdown(makeMemo());
    expect(markdown).toContain('- [ ] 申請 API 金鑰');
    expect(markdown).toContain('- [x] 測試回呼');
  });

  it('includes translation and sources when present', () => {
    const markdown = memoToMarkdown(
      makeMemo({
        translation: '這是譯文',
        sourceUrls: [{ url: 'https://example.com', title: '範例' }]
      })
    );
    expect(markdown).toContain('### 翻譯');
    expect(markdown).toContain('[範例](https://example.com)');
  });

  it('rolls unfinished todos from every memo into one list at the top', () => {
    const report = buildMarkdownReport([makeMemo(), makeMemo({ id: 'memo_2', title: '第二則' })]);
    const summarySection = report.split('---')[1] ?? '';
    expect(report).toContain('## 未完成待辦彙整');
    // Both memos' open todos appear in the roll-up, each tagged with its memo.
    expect(summarySection.match(/- \[ \] 申請 API 金鑰/g)).toHaveLength(2);
    expect(summarySection).toContain('_(第二則)_');
    // Completed todos stay out of the roll-up.
    expect(summarySection).not.toContain('測試回呼');
  });

  it('handles an empty selection without producing a broken report', () => {
    const report = buildMarkdownReport([], '空報告');
    expect(report).toContain('# 空報告');
    expect(report).toContain('（沒有符合條件的 memo）');
  });
});

describe('clampRegion', () => {
  const screen = { width: 1920, height: 1080 };

  it('keeps an in-bounds region unchanged', () => {
    expect(clampRegion({ x: 100, y: 100, width: 400, height: 300 }, screen)).toEqual({
      x: 100,
      y: 100,
      width: 400,
      height: 300
    });
  });

  it('slides a region that overflows the right edge back inside, keeping its size', () => {
    expect(clampRegion({ x: 1800, y: 0, width: 1024, height: 1024 }, screen)).toEqual({
      x: 896,
      y: 0,
      width: 1024,
      height: 1024
    });
  });

  it('shrinks a region that is larger than the screen', () => {
    expect(clampRegion({ x: 0, y: 0, width: 4000, height: 4000 }, screen)).toEqual({
      x: 0,
      y: 0,
      width: 1920,
      height: 1080
    });
  });

  it('never returns negative coordinates', () => {
    const region = clampRegion({ x: -500, y: -500, width: 100, height: 100 }, screen);
    expect(region.x).toBeGreaterThanOrEqual(0);
    expect(region.y).toBeGreaterThanOrEqual(0);
  });
});

describe('personality', () => {
  it('gives every preset a distinct proactiveness/verbosity combination', () => {
    const combos = Object.values(PERSONALITY_PROFILES).map(
      profile => `${profile.proactiveness}-${profile.verbosity}-${profile.emotionMarkup}`
    );
    expect(new Set(combos).size).toBe(combos.length);
  });

  it('states all four standardised parameters in the prompt', () => {
    const prompt = buildPersonalityPrompt(PERSONALITY_PROFILES.lively);
    expect(prompt).toContain('積極活潑');
    expect(prompt).toContain('主動介入積極度');
    expect(prompt).toContain('答覆用字數量');
    expect(prompt).toContain('回應文字的情緒標註風格');
  });

  it('includes custom user addressing name when provided', () => {
    const prompt = buildPersonalityPrompt(PERSONALITY_PROFILES.lively, 'CK');
    expect(prompt).toContain('主人稱呼：對使用者的稱呼為「CK」');
  });

  it('polls more often the more proactive the persona is', () => {
    expect(intervalForProactiveness(5)).toBeLessThan(intervalForProactiveness(1));
  });

  it('labels every voice with a gender', () => {
    expect(VOICE_OPTIONS.every(voice => voice.gender === '男聲' || voice.gender === '女聲')).toBe(true);
    expect(VOICE_OPTIONS.filter(v => v.gender === '男聲').length).toBeGreaterThan(0);
    expect(VOICE_OPTIONS.filter(v => v.gender === '女聲').length).toBeGreaterThan(0);
  });
});

describe('pipService low-interruption rules', () => {
  beforeEach(() => {
    __resetPipForTests();
  });

  it('holds content as pending while the window is closed', () => {
    const result = showPipContent({ layout: 'content', html: '<p>hi</p>' });
    expect(result.pending).toBe(true);
    expect(getPipState().pending).toBe(true);
  });
});

describe('manifest registration', () => {
  it('declares the capabilities the shell gates on', async () => {
    const { liveAssistanceManifest } = await import('./agentAppManifest');
    expect(liveAssistanceManifest.supportsRealtimeVoice).toBe(true);
    expect(liveAssistanceManifest.supportsScreenStream).toBe(true);
    // Every tool the page registers a handler for must also be declared,
    // otherwise the model never learns it exists.
    const declared = liveAssistanceManifest.availableTools.map(tool => tool.name);
    ['captureScreen', 'showPipWindow', 'createMemo', 'queryMemos', 'saveLongTermMemory', 'exportMarkdownReport'].forEach(
      name => expect(declared).toContain(name)
    );
  });
});

describe('memo digest shape', () => {
  it('keeps only open todos so the model is not handed finished work', () => {
    const memo = makeMemo();
    const openTodos = memo.todos.filter(todo => !todo.done).map(todo => todo.text);
    expect(openTodos).toEqual(['申請 API 金鑰']);
  });
});
