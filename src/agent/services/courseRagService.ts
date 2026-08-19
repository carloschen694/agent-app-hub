import { createGoogleGenAI } from '../../shared/auth';

export interface CourseRagChunk {
  id: string;
  classId: string;
  chapterTitle: string;
  conceptTags: string[];
  slideNo: number | null;
  slideTitle: string | null;
  section: 'outline' | 'narration' | null;
  sourceType: 'slide' | 'speaker' | 'example_readme' | 'example_code';
  sourceFile: string;
  title: string;
  content: string;
  partIndex?: number;
}

/** 回傳給模型的結構化引用，讓回答能指到「第幾堂第幾張投影片」。 */
export interface CourseRagResult {
  classId: string;
  chapterTitle: string;
  slideNo: number | null;
  slideTitle: string | null;
  sourceFile: string;
  content: string;
}

interface EmbeddingChunk extends CourseRagChunk {
  embedding: number[];
}

let courseEmbeddings: EmbeddingChunk[] | null = null;
const EMBEDDING_MODEL = 'gemini-embedding-2';
const EMBEDDING_DIMENSIONS = 768;

/**
 * 絕對門檻：判斷問題是否落在課程範圍內。低於此值一律不採用 —— 寧可回空陣列讓
 * 模型說「教材沒有提到」，也不要餵雜訊。
 *
 * 0.66 取自對真實索引的實測。gemini-embedding-2 的相似度地板偏高且分佈壓縮，
 * 兩類查詢的分界很窄（0.649 ~ 0.675，僅 0.026 寬），憑直覺訂會出錯：
 *   教材沒教   0.554（獅子頭）0.594（天氣）0.615（量子糾纏）0.646（訂高鐵票）0.649（Rust 寫 OS）
 *   教材有教   0.675（Antigravity）0.713（比價助手）0.725（企劃寫手）0.732（Live API）
 *
 * 特別注意 0.675 的 Antigravity —— class02 整堂課就叫「利用 Antigravity 製作第一個
 * AI 助理」。門檻若訂到 0.70，agent 會對著課程自己的主題說「教材沒教」。
 * 精準度交由 SIMILARITY_MARGIN 負責，此處只需分辨「是否在課程範圍內」。
 * 調整前請重跑校準，並務必納入冷門但確實有教的主題。
 */
export const MIN_SIMILARITY = 0.66;

/**
 * 相對門檻：只保留與最高分差距在此範圍內的 chunk，負責精準度。
 *
 * 絕對門檻擋得掉「教材沒教」，但擋不掉「教材有教、但這則只是邊緣沾到」。由於分數
 * 分佈極度壓縮（前 20 名常只差 0.05），餘裕必須很小才有作用。實測「Tool Calling
 * 怎麼實作」在不同餘裕下的表現：
 *   0.02 →  3 則   288 字元（過緊，主力內容被砍）
 *   0.03 →  7 則   891 字元
 *   0.05 → 20 則  6508 字元（形同無效，且僅約半數屬正確課別）
 *
 * 0.03 下典型查詢落在 243~891 字元，問整堂課主題的寬問題才到約 2700。
 */
export const SIMILARITY_MARGIN = 0.03;

/** 單次檢索送進 context 的總量上限（chunk 已在建索引時切到 1500 字元以內，此為第二道防線）。 */
export const MAX_TOTAL_CHARS = 6000;

const DEFAULT_TOP_K = 8;

async function loadEmbeddings(): Promise<EmbeddingChunk[]> {
  if (courseEmbeddings) return courseEmbeddings;
  try {
    const response = await fetch('/data/course_rag_embeddings.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    courseEmbeddings = await response.json() as EmbeddingChunk[];
    return courseEmbeddings;
  } catch (e) {
    console.error('Failed to load course RAG embeddings dynamically:', e);
    return [];
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function embedQuery(apiKey: string, query: string): Promise<number[]> {
  const ai = createGoogleGenAI(apiKey);
  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: query,
    config: { outputDimensionality: EMBEDDING_DIMENSIONS },
  });

  const embedding = response.embeddings?.[0]?.values;
  if (!embedding || !Array.isArray(embedding)) {
    throw new Error('Embedding response is invalid');
  }
  return embedding;
}

/**
 * 同一份來源的片段合併，避免重複來源各自佔用一則。
 *
 * 群組維持相似度順序（最相關的來源先呈現），但群組「內部」依 partIndex 還原文件
 * 順序 —— 傳入的 chunk 是相似度排序，直接串接會讓 part3 排在 part1 前面，教材被打亂。
 */
export function mergeAdjacentParts(chunks: EmbeddingChunk[]): CourseRagResult[] {
  const groups = new Map<string, EmbeddingChunk[]>();

  for (const chunk of chunks) {
    const key = `${chunk.sourceFile}#${chunk.slideNo ?? ''}#${chunk.section ?? ''}`;
    const group = groups.get(key);
    if (group) group.push(chunk);
    else groups.set(key, [chunk]);
  }

  return [...groups.values()].map((group) => {
    const ordered = [...group].sort((a, b) => (a.partIndex ?? 0) - (b.partIndex ?? 0));
    const [first] = ordered;
    return {
      classId: first.classId,
      chapterTitle: first.chapterTitle,
      slideNo: first.slideNo,
      slideTitle: first.slideTitle,
      sourceFile: first.sourceFile,
      content: ordered.map((c) => c.content).join('\n\n'),
    };
  });
}

export interface RetrieveOptions {
  topK?: number;
  classId?: string;
  minSimilarity?: number;
  similarityMargin?: number;
  maxTotalChars?: number;
}

export async function retrieveTopK(
  apiKey: string,
  query: string,
  options: RetrieveOptions = {}
): Promise<CourseRagResult[]> {
  const {
    topK = DEFAULT_TOP_K,
    classId,
    minSimilarity = MIN_SIMILARITY,
    similarityMargin = SIMILARITY_MARGIN,
    maxTotalChars = MAX_TOTAL_CHARS,
  } = options;

  try {
    const embeddings = await loadEmbeddings();
    if (embeddings.length === 0) {
      return [];
    }

    const candidates = classId
      ? embeddings.filter((chunk) => chunk.classId === classId)
      : embeddings;
    if (candidates.length === 0) {
      return [];
    }

    const queryEmbedding = await embedQuery(apiKey, query);

    // 先算分、後組裝：內容只在勝出者上取用，不再對全庫做無謂的字串處理
    const ranked = candidates
      .map((chunk) => ({ chunk, similarity: cosineSimilarity(queryEmbedding, chunk.embedding) }))
      .filter((entry) => entry.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity);

    if (ranked.length === 0) {
      return [];
    }

    // 絕對門檻擋「教材沒教」，相對門檻擋「有教但只是邊緣沾到」
    const cutoff = ranked[0].similarity - similarityMargin;
    const scored = ranked.filter((entry) => entry.similarity >= cutoff);

    const selected: EmbeddingChunk[] = [];
    let totalChars = 0;
    for (const entry of scored) {
      if (selected.length >= topK) break;
      if (totalChars + entry.chunk.content.length > maxTotalChars) continue;
      selected.push(entry.chunk);
      totalChars += entry.chunk.content.length;
    }

    return mergeAdjacentParts(selected);
  } catch (error) {
    console.error('Course RAG query failed:', error);
    return [];
  }
}
