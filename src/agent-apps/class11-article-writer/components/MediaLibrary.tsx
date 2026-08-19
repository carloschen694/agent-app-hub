import React, { useState } from 'react';
import type { GlobalMediaItem } from '../types';

interface MediaLibraryProps {
  mediaList: GlobalMediaItem[];
  onDeleteMedia: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
  onOpenImageGen: () => void;
  onOpenVideoGen: () => void;
  onRecreateImage?: (initialParams: any) => void;
  onRecreateVideo?: (initialParams: any) => void;
  onSyncMedia?: (id: string) => void;
  
  // Selection mode props
  selectionMode?: 'image' | 'video' | 'any' | null;
  onSelectMedia?: (item: GlobalMediaItem) => void;
}

export const MediaLibrary: React.FC<MediaLibraryProps> = ({
  mediaList,
  onDeleteMedia,
  isOpen,
  onClose,
  onOpenImageGen,
  onOpenVideoGen,
  onRecreateImage,
  onRecreateVideo,
  onSyncMedia,
  selectionMode,
  onSelectMedia,
}) => {
  const [lightboxMedia, setLightboxMedia] = useState<{ url: string; type: 'image' | 'video'; alt: string } | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (!isOpen) return null;

  // Filter media list by selection mode
  const filteredList = selectionMode === 'image'
    ? mediaList.filter(item => item.type === 'image')
    : selectionMode === 'video'
      ? mediaList.filter(item => item.type === 'video')
      : mediaList;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in select-none">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[85vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">perm_media</span>
            <h3 className="font-bold text-slate-800 text-lg">
              {selectionMode ? `選擇媒體素材 (${selectionMode === 'image' ? '圖片' : selectionMode === 'video' ? '影片' : '全部'})` : '媒體素材庫'}
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-50 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Buttons Panel */}
        <div className="flex flex-wrap items-center gap-3 px-6 py-3 bg-slate-50 border-b border-slate-100">
          <button
            onClick={() => {
              onOpenImageGen();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <span className="material-symbols-outlined text-sm">image_search</span>
            AI 生成圖片
          </button>
          <button
            onClick={() => {
              onOpenVideoGen();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <span className="material-symbols-outlined text-sm">video_call</span>
            AI 生成影片
          </button>
          <div className="text-[11px] text-slate-500 ml-auto">
            已生成媒體：{filteredList.length} 個
          </div>
        </div>

        {/* Media Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredList.length === 0 ? (
            <div className="text-center py-24 text-slate-400 flex flex-col items-center gap-3">
              <span className="material-symbols-outlined text-5xl text-slate-200">
                photo_library
              </span>
              <p className="text-sm font-medium">目前素材庫沒有媒體檔案。</p>
              <p className="text-xs text-slate-500">點擊上方按鈕，透過 AI 繪圖與短影音生成！</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {filteredList.map((item) => {
                const isVideo = item.type === 'video';
                return (
                  <div 
                    key={item.id}
                    className="border border-slate-100 rounded-xl overflow-hidden shadow-sm flex flex-col bg-slate-50/50 hover:shadow-md transition-shadow"
                  >
                    {/* Media Display Area */}
                    <div className="relative aspect-video bg-slate-900 flex items-center justify-center overflow-hidden group">
                      {(item.isPlaceholder || item.url.startsWith('placeholder://')) ? (
                        <div className="absolute inset-0 bg-slate-800 flex flex-col items-center justify-center p-4 text-center">
                          {item.placeholderStatus === 'failed' ? (
                            <>
                              <span className="material-symbols-outlined text-red-500 text-2xl">
                                error
                              </span>
                              <span className="text-[11px] text-red-400 mt-1 font-semibold">
                                生成失敗
                              </span>
                              <span className="text-[9px] text-red-400 truncate max-w-[180px] mt-0.5 bg-red-950/40 px-1.5 py-0.5 rounded border border-red-900/50">
                                {item.error || '不明錯誤'}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-orange-400 text-3xl animate-spin">
                                sync
                              </span>
                              <span className="text-[11px] text-slate-400 mt-2 font-medium">
                                媒體非同步生成中...
                              </span>
                              <span className="text-[10px] text-slate-500 truncate max-w-[200px] mt-1 italic">
                                {item.alt}
                              </span>
                            </>
                          )}
                        </div>
                      ) : isVideo ? (
                        <video 
                          src={item.url} 
                          className="w-full h-full object-cover" 
                          preload="metadata"
                        />
                      ) : (
                        <img 
                          src={item.url} 
                          alt={item.alt} 
                          className="w-full h-full object-cover"
                        />
                      )}

                      {/* Hover Overlay */}
                      {(!item.isPlaceholder && !item.url.startsWith('placeholder://')) && (
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-3 transition-opacity">
                          <button
                            onClick={() => setLightboxMedia({ url: item.url, type: isVideo ? 'video' : 'image', alt: item.alt })}
                            className="bg-white/95 text-slate-800 p-2 rounded-full hover:bg-white shadow-sm flex items-center justify-center"
                            title="放大檢視"
                          >
                            <span className="material-symbols-outlined text-lg">zoom_in</span>
                          </button>
                        </div>
                      )}

                      {/* Tag */}
                      <span className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded font-medium">
                        {isVideo ? '影片' : '圖片'}
                      </span>
                    </div>

                    {/* Metadata & Actions */}
                    <div className="p-3 bg-white flex-1 flex flex-col justify-between gap-3 border-t border-slate-100">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                            {isVideo ? 'VIDEO' : 'IMAGE'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {(item.isPlaceholder || item.url.startsWith('placeholder://')) ? (item.placeholderStatus === 'failed' ? '❌ 生成失敗' : '⏳ 佇列排隊') : '✅ 已就緒'}
                          </span>
                        </div>
                        <p className={`text-xs text-slate-700 mt-1 leading-relaxed select-text ${expandedItems[item.id] ? '' : 'line-clamp-2 min-h-[2rem]'}`}>
                          {item.alt || <span className="text-slate-400 italic">無 Alt 敘述</span>}
                        </p>
                        
                        {expandedItems[item.id] && item.promptParams && (
                          <div className="mt-2 p-2 bg-slate-50/80 border border-slate-150 rounded-lg text-[10px] text-slate-550 font-mono space-y-1 select-text">
                            {item.promptParams.mode && <div><strong>模式:</strong> {item.promptParams.mode}</div>}
                            {item.promptParams.aspectRatio && <div><strong>比例:</strong> {item.promptParams.aspectRatio}</div>}
                            {item.promptParams.model && <div><strong>模型:</strong> {item.promptParams.model}</div>}
                          </div>
                        )}
                        
                        {item.alt && item.alt.length > 50 && (
                          <button
                            type="button"
                            onClick={() => toggleExpand(item.id)}
                            className="text-[10px] text-blue-600 hover:text-blue-800 font-bold mt-1.5 focus:outline-none flex items-center gap-0.5"
                          >
                            <span className="material-symbols-outlined text-xs">
                              {expandedItems[item.id] ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
                            </span>
                            {expandedItems[item.id] ? '收起提示詞' : '展開完整提示詞'}
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2 border-t border-slate-50 pt-2">
                        {selectionMode && !(item.isPlaceholder || item.url.startsWith('placeholder://')) ? (
                          <button
                            onClick={() => {
                              onSelectMedia?.(item);
                              onClose();
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold shadow-sm transition-colors border border-blue-600"
                          >
                            <span className="material-symbols-outlined text-xs font-bold">check_circle</span>
                            選擇此項目
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              if (isVideo) {
                                onRecreateVideo?.(item.promptParams || {
                                  prompt: item.alt || '',
                                  aspectRatio: '16:9',
                                  resolution: '720p',
                                  mode: 'text-to-video'
                                });
                              } else {
                                onRecreateImage?.(item.promptParams || {
                                  prompt: item.alt || '',
                                  size: '16:9',
                                  mode: 'text-to-image'
                                });
                              }
                              onClose();
                            }}
                            className="flex-1 flex items-center justify-center gap-1 py-1 text-slate-650 hover:text-blue-600 hover:bg-slate-50 rounded text-[11px] font-semibold transition-colors border border-slate-200"
                          >
                            <span className="material-symbols-outlined text-xs">refresh</span>
                            重新生成 / 編輯
                          </button>
                        )}
                        {onSyncMedia && !item.isPlaceholder && !item.url.startsWith('placeholder://') && (
                          <button
                            onClick={() => onSyncMedia(item.id)}
                            className="flex items-center justify-center p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors border border-blue-200"
                            title="同步/置換此媒體至網頁"
                          >
                            <span className="material-symbols-outlined text-sm">sync</span>
                          </button>
                        )}
                        <button
                          onClick={() => onDeleteMedia(item.id)}
                          className="flex items-center justify-center p-1.5 text-slate-400 hover:text-red-650 hover:bg-red-50 rounded transition-colors border border-slate-200"
                          title="刪除素材"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxMedia && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 cursor-pointer"
          onClick={() => setLightboxMedia(null)}
        >
          <button 
            className="absolute top-4 right-4 text-white/70 hover:text-white flex p-2 hover:bg-white/10 rounded-full"
            onClick={() => setLightboxMedia(null)}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
          <div className="max-w-4xl max-h-[85vh] flex flex-col items-center justify-center gap-3">
            {lightboxMedia.type === 'video' ? (
              <video 
                src={lightboxMedia.url} 
                className="max-w-full max-h-[75vh] rounded-lg shadow-2xl" 
                controls 
                autoPlay 
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <img 
                src={lightboxMedia.url} 
                alt={lightboxMedia.alt} 
                className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            )}
            <p className="text-white/90 text-center text-xs px-4 max-w-xl leading-relaxed mt-2 select-text">
              {lightboxMedia.alt}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
