import React, { useState, useRef, useEffect } from 'react';
import { useGoogleGenAI } from '../../../shared/hooks/useGoogleGenAI';

interface ImageGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  onEnqueueImage: (params: {
    prompt: string;
    size: '1:1' | '16:9' | '9:16';
    mode: 'text-to-image' | 'image-to-image' | 'reference-to-image';
    referenceImageBase64?: string;
    targetField: 'cover_square' | 'cover_landscape' | 'cover_portrait' | 'photo_list';
    model?: string;
  }) => void;
  initialParams?: {
    prompt: string;
    size: '1:1' | '16:9' | '9:16';
    mode: 'text-to-image' | 'image-to-image' | 'reference-to-image';
    referenceImageBase64?: string;
    model?: string;
  } | null;
}

export const ImageGenerator: React.FC<ImageGeneratorProps> = ({
  isOpen,
  onClose,
  onEnqueueImage,
  initialParams,
}) => {
  const ai = useGoogleGenAI();
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState<'1:1' | '16:9' | '9:16'>('1:1');
  const [mode, setMode] = useState<'text-to-image' | 'image-to-image' | 'reference-to-image'>('text-to-image');
  const [refImageBase64, setRefImageBase64] = useState<string>('');
  const [style, setStyle] = useState<string>('photo'); // photo | abstract | illustration | 3d
  const targetField = 'photo_list';
  const [model, setModel] = useState('gemini-3.1-flash-image');
  const [availableModels, setAvailableModels] = useState<string[]>([
    'gemini-3.1-flash-image',
    'gemini-3.1-flash-lite-image',
    'gemini-3-pro-image',
    'gemini-2.5-flash-image'
  ]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchModels = async () => {
      try {
        const pager = await ai.models.list();
        if (pager && pager.page) {
          const names = pager.page
            .map((m: any) => m.name.replace('models/', ''))
            .filter((name: string) => name.toLowerCase().includes('imagen') || name.toLowerCase().includes('image'));
          if (names.length > 0) {
            setAvailableModels(names);
            if (!names.includes(model)) {
              setModel(names[0]);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load image models from API:', err);
      }
    };

    fetchModels();
  }, [isOpen, ai]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOpen) return;
    if (initialParams) {
      setPrompt(initialParams.prompt);
      setSize(initialParams.size);
      setMode(initialParams.mode);
      setRefImageBase64(initialParams.referenceImageBase64 || '');
      if (initialParams.model) setModel(initialParams.model);
    } else {
      setPrompt('');
      setSize('1:1');
      setMode('text-to-image');
      setRefImageBase64('');
    }
  }, [isOpen, initialParams]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setRefImageBase64(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setRefImageBase64(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) {
      alert('請輸入提示詞！');
      return;
    }

    // Enhance prompt based on style and template specs
    let finalPrompt = prompt.trim();
    if (!initialParams) {
      let stylePrompt = '';
      switch (style) {
        case 'photo':
          stylePrompt = ', realistic photo, professional photography, high-resolution, detailed texture';
          break;
        case 'abstract':
          stylePrompt = ', abstract modern art, clean colors, symbolic graphic design, minimalism';
          break;
        case 'illustration':
          stylePrompt = ', hand-drawn digital illustration, warm lighting, flat design style, vector';
          break;
        case '3d':
          stylePrompt = ', 3D render, blender style, smooth shapes, studio soft lighting, cute illustration';
          break;
        default:
          break;
      }

      // Add layout template specs: keep center clean for title / text overlay if it's a cover
      let layoutPrompt = '';
      if (targetField !== 'photo_list') {
        layoutPrompt = ', designed as a clean cover background, composition keeps central area clean and uncluttered for text overlays, title safe area template';
      }

      finalPrompt = `${prompt.trim()}${stylePrompt}${layoutPrompt}`;
    }

    onEnqueueImage({
      prompt: finalPrompt,
      size,
      mode,
      referenceImageBase64: mode !== 'text-to-image' ? refImageBase64 : undefined,
      targetField,
      model,
    });

    // Reset prompt and close modal
    setPrompt('');
    setRefImageBase64('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">image_search</span>
            <h3 className="font-bold text-slate-800 text-sm">AI 圖片生成設定</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-150 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-slate-700">
          {/* Prompt */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              繪圖提示詞 (Prompt) <span className="text-red-500">*</span>
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full border border-slate-200 rounded-lg p-2.5 text-xs h-24 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none leading-relaxed"
              placeholder="例如：一位站在台北101頂樓俯瞰智慧城市交通的未來機器人程式設計師..."
              required
            />
          </div>

          {/* Style & Aspect Ratio */}
          {!initialParams ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700">插圖風格 (Style)</label>
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white focus:outline-none focus:border-blue-500"
                >
                  <option value="photo">寫實照片 (Realistic Photo)</option>
                  <option value="abstract">抽象概念 (Abstract Art)</option>
                  <option value="illustration">手繪插畫 (Illustration)</option>
                  <option value="3d">3D 渲染 (3D Render)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700">圖片長寬比 (Aspect Ratio)</label>
                <select
                  value={size}
                  onChange={(e) => setSize(e.target.value as any)}
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white focus:outline-none focus:border-blue-500"
                >
                  <option value="1:1">正方形 (1:1) - IG/Threads 通用</option>
                  <option value="16:9">橫式長方形 (16:9) - FB/YT 封面</option>
                  <option value="9:16">直式長方形 (9:16) - 限時動態/Reels</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-700">圖片長寬比 (Aspect Ratio)</label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value as any)}
                className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white focus:outline-none focus:border-blue-500"
              >
                <option value="1:1">正方形 (1:1) - IG/Threads 通用</option>
                <option value="16:9">橫式長方形 (16:9) - FB/YT 封面</option>
                <option value="9:16">直式長方形 (9:16) - 限時動態/Reels</option>
              </select>
            </div>
          )}

          {/* Model Selection */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700">生成模型 (Image Model)</label>
            <div className="flex gap-2">
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="flex-1 border border-slate-200 rounded-lg p-2 text-xs bg-white focus:outline-none focus:border-blue-500"
              >
                {availableModels.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="flex-1 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500"
                placeholder="或輸入自訂模型名稱"
              />
            </div>
          </div>

          {/* Mode */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700">生成模式 (Mode)</label>
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as any);
                if (e.target.value === 'text-to-image') setRefImageBase64('');
              }}
              className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white focus:outline-none focus:border-blue-500"
            >
              <option value="text-to-image">文字生成圖片 (Text to Image)</option>
              <option value="image-to-image">圖片修改 (Image to Image)</option>
              <option value="reference-to-image">參考相似圖 (Reference to Image)</option>
            </select>
          </div>

          {/* Reference Image Drag & Drop (Conditional) */}
          {mode !== 'text-to-image' && (
            <div className="flex flex-col gap-1.5 animate-slide-down">
              <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>上傳參考圖 (Reference Image)</span>
                {refImageBase64 && (
                  <button 
                    type="button"
                    onClick={() => setRefImageBase64('')}
                    className="text-red-500 hover:text-red-700 text-[10px]"
                  >
                    清除圖片
                  </button>
                )}
              </label>
              
              <div 
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:border-blue-400 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col items-center justify-center gap-2 min-h-[120px]"
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
                
                {refImageBase64 ? (
                  <div className="relative h-20 w-32 border border-slate-200 rounded overflow-hidden shadow-sm bg-black">
                    <img src={refImageBase64} className="h-full w-full object-contain" alt="Reference preview" />
                  </div>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-slate-400 text-2xl">
                      upload_file
                    </span>
                    <span className="text-[11px] text-slate-500">
                      拖曳圖片至此，或點擊選擇檔案上傳
                    </span>
                    <span className="text-[10px] text-slate-400">
                      (支援 JPG, PNG, WebP)
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Footer Submit */}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 rounded-lg transition-colors border border-slate-200"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm font-semibold transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">rocket_launch</span>
              送出並加入生成佇列
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
