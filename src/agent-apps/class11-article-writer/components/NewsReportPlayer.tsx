import React, { useState, useEffect, useRef } from 'react';
import type { Article, ReportVideo, Character } from '../types';

interface NewsReportPlayerProps {
  reportVideo: ReportVideo;
  article: Article;
}

export const NewsReportPlayer: React.FC<NewsReportPlayerProps> = ({ reportVideo, article }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  const scenes = reportVideo.scenes || [];
  const activeScene = scenes[currentIdx];

  // Get current character info
  const characters = article.meta.characters || [];
  const boundCharacter = activeScene?.characterId 
    ? characters.find((c: Character) => c.id === activeScene.characterId)
    : null;

  useEffect(() => {
    // Reset index when scenes change
    setCurrentIdx(0);
    setIsPlaying(false);
  }, [reportVideo]);

  // Handle play/pause changes
  useEffect(() => {
    const activeVideo = videoRefs.current[currentIdx];
    if (!activeVideo) return;

    if (isPlaying) {
      activeVideo.play().catch(err => console.warn('Video play failed:', err));
    } else {
      activeVideo.pause();
    }
  }, [isPlaying, currentIdx]);

  const handleTimeUpdate = (idx: number) => {
    const video = videoRefs.current[idx];
    if (!video) return;

    // Enforce 5.0s per scene limit
    if (video.currentTime >= 5.0) {
      video.pause();
      video.currentTime = 0;
      
      const nextIdx = (idx + 1) % scenes.length;
      setCurrentIdx(nextIdx);
      
      // Auto-play the next video
      setTimeout(() => {
        const nextVideo = videoRefs.current[nextIdx];
        if (nextVideo && isPlaying) {
          nextVideo.play().catch(err => console.warn('Next video play failed:', err));
        }
      }, 50);
    }
  };

  const handleVideoEnded = (idx: number) => {
    const video = videoRefs.current[idx];
    if (video) {
      video.currentTime = 0;
    }
    const nextIdx = (idx + 1) % scenes.length;
    setCurrentIdx(nextIdx);
    
    setTimeout(() => {
      const nextVideo = videoRefs.current[nextIdx];
      if (nextVideo && isPlaying) {
        nextVideo.play().catch(err => console.warn('Next video play failed:', err));
      }
    }, 50);
  };

  const togglePlay = () => {
    setIsPlaying(prev => !prev);
  };

  if (scenes.length === 0) {
    return (
      <div className="w-full aspect-[16/9] bg-slate-900 rounded-xl flex items-center justify-center text-xs text-slate-400">
        無效的新聞報導影片資料
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Player Screen */}
      <div className="relative w-full aspect-[16/9] bg-slate-950 rounded-xl overflow-hidden shadow-lg select-none group border border-slate-800">
        
        {/* Videos Container */}
        {scenes.map((scene, idx) => {
          const isPlaceholder = scene.videoUrl.startsWith('placeholder-') || scene.videoUrl.startsWith('placeholder://');
          return (
            <div 
              key={scene.sceneId} 
              className={`absolute inset-0 transition-opacity duration-300 ${idx === currentIdx ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
            >
              {isPlaceholder ? (
                <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-4 text-center">
                  <span className="animate-spin text-2xl text-orange-400 material-symbols-outlined mb-2">sync</span>
                  <span className="text-xs text-slate-350 font-bold">分鏡 #{idx + 1} 影片生成中...</span>
                  <span className="text-[10px] text-slate-500 mt-1 max-w-[80%] truncate">{scene.subtitle}</span>
                </div>
              ) : (
                <video
                  ref={el => { videoRefs.current[idx] = el; }}
                  src={scene.videoUrl}
                  className="w-full h-full object-cover"
                  onTimeUpdate={() => handleTimeUpdate(idx)}
                  onEnded={() => handleVideoEnded(idx)}
                  playsInline
                  muted
                />
              )}
            </div>
          );
        })}

        {/* ================= NEWS OVERLAYS ================= */}
        {isPlaying && (
          <>
            {/* 1. Breaking News Red Flashing Badge (SNG Live) */}
            <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-red-650 text-white font-black text-[9px] tracking-wider px-2 py-1 rounded shadow-md animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping"></span>
              SNG LIVE 即時新聞
            </div>

            {/* 2. Top-Right Scene indicator */}
            <div className="absolute top-3 right-3 z-20 bg-black/60 backdrop-blur-sm text-slate-300 text-[9px] font-bold px-2 py-1 rounded border border-slate-700">
              分鏡 {currentIdx + 1} / {scenes.length} : {activeScene?.subtitle ? activeScene.subtitle.slice(0, 15) + '...' : `分鏡 #${currentIdx + 1}`}
            </div>

            {/* 3. Nameplate Banner (Left-Bottom, above subtitles) */}
            {boundCharacter && (
              <div className="absolute bottom-16 left-4 z-20 flex items-center bg-slate-900/95 border border-slate-700 rounded-lg overflow-hidden shadow-lg animate-fade-in max-w-[200px]">
                {boundCharacter.avatarUrl && (
                  <img src={boundCharacter.avatarUrl} className="w-8 h-8 object-cover border-r border-slate-700" alt="avatar" />
                )}
                <div className="px-2 py-0.5 flex flex-col justify-center">
                  <span className="text-[10px] font-bold text-white leading-tight">{boundCharacter.name}</span>
                  <span className="text-[8px] text-slate-400 leading-none mt-0.5">{boundCharacter.role}</span>
                </div>
              </div>
            )}

            {/* 4. Subtitles Overlay (Center-Bottom) */}
            {activeScene?.subtitle && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 w-fit max-w-[85%] text-center">
                <div className="bg-black/75 backdrop-blur-sm text-white font-semibold text-xs py-1 px-3.5 rounded-full shadow-md leading-relaxed tracking-wide inline-block border border-white/5">
                  {activeScene.subtitle}
                </div>
              </div>
            )}

            {/* 5. News Ticker (Bottom Scroll Banner) */}
            <div className="absolute bottom-0 left-0 right-0 h-6 bg-blue-900 border-t border-blue-800 z-20 flex items-center overflow-hidden">
              <div className="bg-orange-500 text-white font-black text-[9px] px-3 h-full flex items-center z-30 uppercase tracking-widest">
                焦點
              </div>
              <div className="flex-1 relative h-full flex items-center overflow-hidden select-none">
                <div className="absolute whitespace-nowrap text-white text-[10px] font-bold tracking-wide animate-marquee pl-4">
                  【頭條】{article.title} —— {article.subtitle} || 關鍵熱詞：{article.meta.keywords.join(', ') || '無'} || 獨家深入報導...
                </div>
              </div>
            </div>
          </>
        )}

        {/* Play/Pause Button Overlay on Hover */}
        <div 
          onClick={togglePlay}
          className="absolute inset-0 z-25 bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200 cursor-pointer"
        >
          <div className="bg-black/60 backdrop-blur-sm p-3.5 rounded-full border border-white/10 hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-white text-3xl">
              {isPlaying ? 'pause' : 'play_arrow'}
            </span>
          </div>
        </div>
      </div>

      {/* Controller Buttons */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlay}
            className="flex items-center gap-1 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-sm">{isPlaying ? 'pause' : 'play_arrow'}</span>
            {isPlaying ? '暫停報導' : '播放新聞報導'}
          </button>

          <span className="text-[10px] text-slate-400 font-medium">
            總長度 {scenes.length * 5} 秒 ({scenes.length} 個分鏡各 5 秒)
          </span>
        </div>

        {/* Scene Selector dots */}
        <div className="flex gap-1.5">
          {scenes.map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                setCurrentIdx(idx);
                setIsPlaying(true);
              }}
              className={`h-2 w-2 rounded-full transition-all duration-300 ${idx === currentIdx ? 'bg-blue-600 w-4' : 'bg-slate-300 hover:bg-slate-400'}`}
              title={`切換分鏡 ${idx + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Marquee Keyframes Style Injection */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          animation: marquee 20s linear infinite;
        }
      `}</style>
    </div>
  );
};
