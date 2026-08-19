import React, { useState, useEffect } from 'react';
import { useGoogleGenAI } from '../../../shared/hooks/useGoogleGenAI';

interface SingleVideoGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  onEnqueueVideo: (params: {
    prompt: string;
    aspectRatio: '1:1' | '16:9' | '9:16';
    resolution: '720p' | '1080p';
    mode: 'text-to-video';
    model?: string;
  }) => void;
  initialParams?: {
    prompt: string;
    aspectRatio: '1:1' | '16:9' | '9:16';
    resolution?: '720p' | '1080p';
    model?: string;
  } | null;
}

export const SingleVideoGenerator: React.FC<SingleVideoGeneratorProps> = ({
  isOpen,
  onClose,
  onEnqueueVideo,
  initialParams,
}) => {
  const ai = useGoogleGenAI();
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16'>('16:9');
  const [resolution, setResolution] = useState<'720p' | '1080p'>('720p');
  const [model, setModel] = useState('veo-3.1-generate-preview');
  const [availableModels, setAvailableModels] = useState<string[]>([
    'veo-3.1-generate-preview',
    'veo-3.1-fast-generate-preview'
  ]);

  useEffect(() => {
    if (!isOpen) return;

    const fetchModels = async () => {
      try {
        const pager = await ai.models.list();
        if (pager && pager.page) {
          const names = pager.page
            .map((m: any) => m.name.replace('models/', ''))
            .filter((name: string) => name.toLowerCase().includes('veo') || name.toLowerCase().includes('video'));
          if (names.length > 0) {
            setAvailableModels(names);
            if (!names.includes(model)) {
              setModel(names[0]);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load video models from API:', err);
      }
    };

    fetchModels();
  }, [isOpen, ai]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOpen) return;
    if (initialParams) {
      setPrompt(initialParams.prompt);
      setAspectRatio(initialParams.aspectRatio);
      if (initialParams.resolution) setResolution(initialParams.resolution);
      if (initialParams.model) setModel(initialParams.model);
    } else {
      setPrompt('');
      setAspectRatio('16:9');
      setResolution('720p');
    }
  }, [isOpen, initialParams]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    onEnqueueVideo({
      prompt: prompt.trim(),
      aspectRatio,
      resolution,
      mode: 'text-to-video',
      model
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in text-slate-750">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-orange-500 font-bold">video_call</span>
            <h3 className="font-bold text-slate-800 text-sm">AI 單一影片生成器 (Veo)</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500">影片生成提示詞 (Prompt)</label>
            <textarea
              required
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="border border-slate-200 rounded-lg p-3 text-xs h-28 focus:outline-none focus:border-blue-500 resize-none leading-relaxed"
              placeholder="描述您想生成的影片場景，例如：航拍海浪拍打金黃色沙灘，清晨陽光溫暖照耀，鏡頭緩慢向海平面拉遠..."
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500">影片比例</label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as any)}
                className="border border-slate-200 rounded-lg p-2 text-xs bg-white focus:outline-none focus:border-blue-500"
              >
                <option value="16:9">橫式長方形 (16:9)</option>
                <option value="9:16">直式長方形 (9:16)</option>
                <option value="1:1">正方形 (1:1)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500">解析度</label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value as any)}
                className="border border-slate-200 rounded-lg p-2 text-xs bg-white focus:outline-none focus:border-blue-500"
              >
                <option value="720p">720p (HD)</option>
                <option value="1080p">1080p (Full HD)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500">Veo 生成模型</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="border border-slate-200 rounded-lg p-2 text-xs bg-white focus:outline-none focus:border-blue-500"
              >
                {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 rounded-lg transition-colors border border-slate-200 font-semibold"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm font-semibold transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm font-bold">send</span>
              提交生成佇列
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
