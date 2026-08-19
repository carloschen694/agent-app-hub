
export interface Character {
  id: string;          // char_1, char_2 等
  name: string;        // 角色名字
  role: string;        // 角色類型 (記者 | 當事人 | 受訪路人 | 專家)
  avatarUrl: string;   // 頭像圖片網址 (可為Imagen生成或上載照片)
  description: string; // 人物造型描述
  voiceModel?: string;  // 語音模型
  voicePrompt?: string; // 聲音和口音提示詞 (如: 台灣腔調)
}

export interface ReportVideoScene {
  sceneId: string;     // scene_1, scene_2, scene_3, scene_4
  videoUrl: string;    // Veo 生成之影片 URL (包含 placeholder)
  imageUrl?: string;   // Imagen 生成之首影格靜態畫面 (Stage 1)
  narration: string;   // 旁白
  subtitle: string;    // 字幕
  characterId?: string;// 綁定人物庫 ID
  background?: string; // 場景/背景/地點
  camera?: string;     // 記者/角色運鏡方式
}

export interface ReportVideo {
  scenes: ReportVideoScene[];
  combinedUrl?: string; // (選填) 合成影片 URL
}

export interface Article {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  subtitle: string;
  content: string; // Markdown内文
  html: string; // 渲染后的内文HTML
  meta: {
    topic: string;
    keywords: string[];
    topicGuideline: string;
    visualStyleGuideline: string;
    characters?: Character[]; // 新增人物庫
  };
  covers: {
    square: CoverMedia;
    landscape: CoverMedia;
    portrait: CoverMedia;
  };
  photos: CoverMedia[];
  video: CoverMedia | null;
  reportVideo?: ReportVideo | null; // 新增四分鏡新聞短片
  sources: SourceItem[];
}

export interface CoverMedia {
  url: string;
  alt: string;
  isPlaceholder?: boolean;
  placeholderId?: string; // 對應 QueueItem.id
  placeholderStatus?: 'pending' | 'processing' | 'failed';
  error?: string;
  type?: 'image' | 'video';
  sources?: string[]; // 多段影片來源路徑，供 Player 自動跳轉播放
  promptParams?: {
    prompt: string;
    aspectRatio: '1:1' | '16:9' | '9:16';
    resolution?: '720p' | '1080p';
    mode?: string;
    model?: string;
    startFrame?: any;
    endFrame?: any;
    referenceImages?: any[];
    styleImage?: any;
  };
}

export interface GlobalMediaItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  alt: string;
  createdAt: string;
  isPlaceholder?: boolean;
  placeholderId?: string; // 對應 QueueItem.id
  placeholderStatus?: 'pending' | 'processing' | 'failed';
  error?: string;
  sources?: string[]; // 多段影片來源路徑
  promptParams?: any;
}

export interface SourceItem {
  title: string;
  url: string;
}

export interface QueueItem {
  id: string;
  type: 'image' | 'video';
  prompt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  error?: string;
  params: any;
  targetField?: string;
}

export interface VideoProject {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  aspectRatio: '1:1' | '16:9' | '9:16';
  resolution: '720p' | '1080p';
  model: string;
  characters: Character[];
  scenes: ReportVideoScene[];
  combinedUrl?: string;
  autoGenState?: 'idle' | 'generating_images' | 'generating_videos' | 'completed' | 'failed';
}
