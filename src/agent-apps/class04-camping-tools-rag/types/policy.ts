export interface PolicyChunk {
  id: string;
  source: string;
  title: string;
  section_path: string[];
  content: string;
}

export interface PolicyEmbeddingChunk extends PolicyChunk {
  embedding_model: string;
  embedding_dimensions: number;
  embedding: number[];
}

export interface RetrievedPolicyChunk {
  id: string;
  title: string;
  section_path: string[];
  content: string;
  similarity: number;
}
