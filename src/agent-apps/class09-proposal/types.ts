export type BlockType = 'h1' | 'h2' | 'h3' | 'paragraph' | 'list_item' | 'table';
export type AppStatus = 'idle' | 'planning' | 'writing' | 'reviewing';

export interface ProposalBlock {
  id: string;
  type: BlockType;
  content: string | string[][];
}

export interface ProposalSection {
  id: string;
  title: string;
  description: string;
  content: ProposalBlock[];
  isComplete: boolean;
}

export interface ProposalMeta {
  purpose: string;
  targetAudience: string;
  tone: string;
  pageCountEstimate: number;
}

export interface VersionLog {
  version: string;
  timestamp: number;
  changes: string;
}

export interface VersionSnapshot {
  id: string;
  timestamp: number;
  name: string;
  doc: ProposalDoc;
}

export interface ProposalDoc {
  id: string;
  title: string;
  metadata: ProposalMeta;
  sections: ProposalSection[];
  publishedVersions: VersionLog[];
  createdAt: number;
  updatedAt: number;
}

export interface DocSummary {
  id: string;
  title: string;
  updatedAt: number;
}
