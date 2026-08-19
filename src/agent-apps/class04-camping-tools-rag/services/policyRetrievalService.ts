import { createGoogleGenAI } from '../../../shared/auth';
import policyEmbeddingsData from '../data/policy_embeddings.json';
import policyChunksData from '../data/policy_chunks.json';
import type { PolicyChunk, PolicyEmbeddingChunk, RetrievedPolicyChunk } from '../types/policy';

const policyEmbeddings: PolicyEmbeddingChunk[] = policyEmbeddingsData as PolicyEmbeddingChunk[];
const policyChunks: PolicyChunk[] = policyChunksData as PolicyChunk[];

/** 與離線產生 policy_embeddings.json 時相同的 embedding 模型設定，確保向量空間可比較 */
const EMBEDDING_MODEL = 'gemini-embedding-2';
const EMBEDDING_DIMENSIONS = 768;

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

/** 將使用者查詢轉成 embedding（沿用與離線產生資料時一致的 model / outputDimensionality 設定） */
async function embedQuery(apiKey: string, query: string): Promise<number[]> {
  const ai = createGoogleGenAI(apiKey);
  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: query,
    config: { outputDimensionality: EMBEDDING_DIMENSIONS },
  });

  const embedding = response.embeddings?.[0]?.values;
  if (!embedding || !Array.isArray(embedding)) {
    throw new Error('Embedding 回傳格式異常，無法取得向量');
  }
  return embedding;
}

/** 對查詢做 embedding，與所有 chunk 逐筆比較 cosine similarity，回傳 top-k 相關 chunk */
async function retrieveTopK(apiKey: string, query: string, topK = 3): Promise<RetrievedPolicyChunk[]> {
  const queryEmbedding = await embedQuery(apiKey, query);

  const scored = policyEmbeddings.map((chunk) => ({
    id: chunk.id,
    title: chunk.title,
    section_path: chunk.section_path,
    content: chunk.content,
    similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, topK);
}

function getAllChunks(): PolicyChunk[] {
  return policyChunks;
}

export const policyRetrievalService = {
  retrieveTopK,
  getAllChunks,
  cosineSimilarity,
};
