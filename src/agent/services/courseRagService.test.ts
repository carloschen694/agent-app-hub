import { describe, it, expect } from 'vitest';
import { mergeAdjacentParts, MIN_SIMILARITY, MAX_TOTAL_CHARS, SIMILARITY_MARGIN } from './courseRagService';

const chunk = (over: Record<string, any> = {}) => ({
  id: 'x',
  classId: 'class04',
  chapterTitle: 'Skills與工具函式(Tool Calling)實作',
  conceptTags: [],
  slideNo: 8,
  slideTitle: '先介紹 Function Calling',
  section: 'narration' as const,
  sourceType: 'slide' as const,
  sourceFile: 'class04/slides/slide.md',
  title: 'Class 4 Slide 08',
  content: '內容',
  embedding: [],
  ...over,
});

describe('mergeAdjacentParts', () => {
  it('同一來源的片段合併為一則', () => {
    const merged = mergeAdjacentParts([
      chunk({ content: 'A', partIndex: 1 }),
      chunk({ content: 'B', partIndex: 2 }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].content).toBe('A\n\nB');
  });

  it('群組內依 partIndex 還原文件順序（傳入為相似度排序）', () => {
    // part3 比 part1 更相關時，直接串接會讓教材內容前後顛倒
    const merged = mergeAdjacentParts([
      chunk({ content: '第三段', partIndex: 3 }),
      chunk({ content: '第一段', partIndex: 1 }),
      chunk({ content: '第二段', partIndex: 2 }),
    ]);
    expect(merged[0].content).toBe('第一段\n\n第二段\n\n第三段');
  });

  it('保留相似度順序：最相關的來源排在前面', () => {
    const merged = mergeAdjacentParts([
      chunk({ slideNo: 8, content: '最相關' }),
      chunk({ slideNo: 2, content: '次相關' }),
    ]);
    expect(merged.map((m) => m.slideNo)).toEqual([8, 2]);
  });

  it('同一投影片的大綱與講述不合併（刻意分屬不同向量）', () => {
    const merged = mergeAdjacentParts([
      chunk({ section: 'outline', content: '大綱' }),
      chunk({ section: 'narration', content: '講述' }),
    ]);
    expect(merged).toHaveLength(2);
  });

  it('不同課別不合併', () => {
    const merged = mergeAdjacentParts([
      chunk({ classId: 'class04', sourceFile: 'class04/slides/slide.md' }),
      chunk({ classId: 'class03', sourceFile: 'class03/slides/slide.md' }),
    ]);
    expect(merged).toHaveLength(2);
  });

  it('回傳結構化引用欄位', () => {
    const [result] = mergeAdjacentParts([chunk()]);
    expect(result).toMatchObject({
      classId: 'class04',
      chapterTitle: 'Skills與工具函式(Tool Calling)實作',
      slideNo: 8,
      slideTitle: '先介紹 Function Calling',
      sourceFile: 'class04/slides/slide.md',
    });
  });
});

describe('檢索常數', () => {
  // 實測值，改動門檻前請重跑校準
  const OFF_TOPIC_MAX = 0.649; // Rust 寫 OS 核心（獅子頭 0.554、天氣 0.594、高鐵票 0.646）
  const ON_TOPIC_MIN = 0.675; // Antigravity —— class02 整堂課的主題

  it('絕對門檻落在「教材沒教」與「教材有教」之間', () => {
    expect(MIN_SIMILARITY).toBeGreaterThan(OFF_TOPIC_MAX);
    expect(MIN_SIMILARITY).toBeLessThan(ON_TOPIC_MIN);
  });

  it('門檻不得高到擋掉課程自己的主題（Antigravity 實測僅 0.675）', () => {
    expect(MIN_SIMILARITY).toBeLessThan(ON_TOPIC_MIN);
  });

  it('總預算低於舊版固定送出的 8000 字元（topK 4 × 每則 2000）', () => {
    expect(MAX_TOTAL_CHARS).toBeLessThan(8000);
  });

  it('相對門檻的餘裕夠小才有作用（實測 0.05 會保留 20 則、6508 字元）', () => {
    expect(SIMILARITY_MARGIN).toBeGreaterThan(0);
    expect(SIMILARITY_MARGIN).toBeLessThanOrEqual(0.03);
  });
});

describe('相對門檻的篩選行為', () => {
  // 重現 retrieveTopK 內的篩選邏輯，驗證兩道門檻的分工
  const applyCutoffs = (sims: number[], min = MIN_SIMILARITY, margin = SIMILARITY_MARGIN) => {
    const ranked = sims.filter((s) => s >= min).sort((a, b) => b - a);
    if (ranked.length === 0) return [];
    return ranked.filter((s) => s >= ranked[0] - margin);
  };

  it('教材沒教：絕對門檻擋下全部（實測天氣查詢 top1=0.594）', () => {
    expect(applyCutoffs([0.594, 0.576, 0.573, 0.549])).toEqual([]);
  });

  it('教材有教：保留主力，砍掉邊緣沾到的碎片', () => {
    // 實測「Tool Calling 怎麼實作」的分數分佈：0.05 餘裕會一路吃到 0.77 以下
    const kept = applyCutoffs([0.820, 0.818, 0.801, 0.772, 0.760]);
    expect(kept).toEqual([0.820, 0.818, 0.801]);
  });

  it('課程自己的主題不會被擋（Antigravity 實測 top1=0.675）', () => {
    expect(applyCutoffs([0.675, 0.668, 0.661, 0.640])).toEqual([0.675, 0.668, 0.661]);
  });

  it('分數集中時全部保留（都是同等相關的內容）', () => {
    expect(applyCutoffs([0.804, 0.804, 0.799, 0.793])).toHaveLength(4);
  });

  it('只有一則命中時不會被自己的餘裕排除', () => {
    expect(applyCutoffs([0.755, 0.60])).toEqual([0.755]);
  });
});
