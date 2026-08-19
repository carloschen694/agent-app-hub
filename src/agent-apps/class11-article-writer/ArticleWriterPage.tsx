import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAgent } from '../../agent/hooks/useAgent';
import { marked } from 'marked';
import type { Article, QueueItem, CoverMedia, SourceItem, GlobalMediaItem } from './types';
import { MediaLibrary } from './components/MediaLibrary';
import { ImageGenerator } from './components/ImageGenerator';
import { SingleVideoGenerator } from './components/SingleVideoGenerator';
import { VideoProjectEditor } from './components/VideoProjectEditor';
import { QueuePanel } from './components/QueuePanel';
import { NewsReportPlayer } from './components/NewsReportPlayer';
import { generateImage, generateVideo, GenerationMode } from './services/mediaGenerationService';


// --- IndexedDB Persistence for Media ---
const DB_NAME = 'class11_media_db';
const DB_VERSION = 1;
const STORE_NAME = 'media_blobs';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
};

export const saveMediaBlob = async (id: string, blob: Blob): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(blob, id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('Failed to save media blob to IndexedDB:', e);
  }
};

export const getMediaBlob = async (id: string): Promise<Blob | null> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('Failed to get media blob from IndexedDB:', e);
    return null;
  }
};

const deleteMediaBlob = async (id: string): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('Failed to delete media blob from IndexedDB:', e);
  }
};

const LOCAL_STORAGE_KEY = 'class11_articles';
const ACTIVE_ARTICLE_ID_KEY = 'class11_active_article_id';

const applyMetaToHtml = (html: string, article: Article, activeCoverRatio: '1:1' | '16:9' | '9:16' = '16:9') => {
  if (!html) return getDefaultHtml(article, activeCoverRatio);

  let updated = html;

  // 1. Update <title>
  if (/<title>/i.test(updated)) {
    updated = updated.replace(/<title>(.*?)<\/title>/gi, `<title>${article.title}</title>`);
  }

  // 2. Update <h1> (Title)
  if (/<h1/i.test(updated)) {
    updated = updated.replace(/<h1([^>]*)>(.*?)<\/h1>/gi, `<h1$1>${article.title}</h1>`);
  }

  // 3. Update Subtitle
  if (/<div[^>]*class="[^"]*subtitle[^"]*"[^>]*>/i.test(updated)) {
    updated = updated.replace(/<div([^>]*class="[^"]*subtitle[^"]*"[^>]*)>(.*?)<\/div>/gi, `<div$1>${article.subtitle}</div>`);
  } else if (/<p[^>]*class="[^"]*subtitle[^"]*"[^>]*>/i.test(updated)) {
    updated = updated.replace(/<p([^>]*class="[^"]*subtitle[^"]*"[^>]*)>(.*?)<\/p>/gi, `<p$1>${article.subtitle}</p>`);
  } else if (/<h2[^>]*class="[^"]*subtitle[^"]*"[^>]*>/i.test(updated)) {
    updated = updated.replace(/<h2([^>]*class="[^"]*subtitle[^"]*"[^>]*)>(.*?)<\/h2>/gi, `<h2$1>${article.subtitle}</h2>`);
  } else if (/<h2/i.test(updated)) {
    updated = updated.replace(/<h2([^>]*)>(.*?)<\/h2>/gi, `<h2$1>${article.subtitle}</h2>`);
  }

  // 4. Update Cover Image
  const cover = activeCoverRatio === '1:1' 
    ? article.covers.square 
    : activeCoverRatio === '9:16' 
      ? article.covers.portrait 
      : article.covers.landscape;
  
  if (cover && cover.url) {
    if (cover.placeholderId) {
      updated = updated.replaceAll(`placeholder://image/${cover.placeholderId}`, cover.url);
    }
    if (/<img[^>]*cover[^>]*src="([^"]*)"/i.test(updated)) {
      updated = updated.replace(/(<img[^>]*cover[^>]*src=")([^"]*)(")/gi, `$1${cover.url}$3`);
    } else if (/<img[^>]*src="([^"]*)"[^>]*cover/i.test(updated)) {
      updated = updated.replace(/(<img[^>]*src=")([^"]*)("[^>]*cover)/gi, `$1${cover.url}$3`);
    } else {
      // Fallback: replace the first image src
      if (/<img/i.test(updated)) {
        updated = updated.replace(/(<img[^>]*src=")([^"]*)(")/i, `$1${cover.url}$3`);
      }
    }
  }

  // 5. Update Video URL
  if (article.video && article.video.url) {
    if (article.video.placeholderId) {
      updated = updated.replaceAll(`placeholder://video/${article.video.placeholderId}`, article.video.url);
    }
    if (/<video[^>]*src="([^"]*)"/i.test(updated)) {
      updated = updated.replace(/(<video[^>]*src=")([^"]*)(")/gi, `$1${article.video.url}$3`);
    } else if (/<source[^>]*src="([^"]*)"/i.test(updated)) {
      updated = updated.replace(/(<source[^>]*src=")([^"]*)(")/gi, `$1${article.video.url}$3`);
    }
  }

  return updated;
};

const injectPreviewStyles = (html: string): string => {
  const helperStyles = `
    <style id="iframe-placeholder-helpers">
      img[src^="placeholder://"] {
        display: block !important;
        min-height: 220px !important;
        background: #f8fafc !important;
        border: 2px dashed #cbd5e1 !important;
        border-radius: 12px !important;
        position: relative !important;
        content: "" !important;
      }
      img[src^="placeholder://"]::after {
        content: "🎨 AI 影像生成中...\\n「" attr(alt) "」" !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        text-align: center !important;
        position: absolute !important;
        top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important;
        color: #64748b !important;
        font-size: 13px !important;
        font-weight: 500 !important;
        font-family: system-ui, -apple-system, sans-serif !important;
        padding: 1.5rem !important;
        box-sizing: border-box !important;
        white-space: pre-wrap !important;
        background: #f8fafc !important;
        border-radius: 12px !important;
      }
      video[src^="placeholder://"] {
        display: none !important;
      }
      .preview-hover-block {
        outline: 2px dashed #3b82f6 !important;
        outline-offset: 4px !important;
        cursor: pointer !important;
        transition: outline 0.15s ease-in-out !important;
      }
    </style>
  `;

  const helperScript = `
    <script id="iframe-editor-runtime">
      (function() {
        let currentHovered = null;
        document.addEventListener('mouseover', function(e) {
          const target = e.target.closest('.ai-editable') || e.target.closest('p, h1, h2, h3, h4, h5, h6, blockquote, li, .with-placeholder-background, img, video');
          if (!target) return;
          if (currentHovered && currentHovered !== target) {
            currentHovered.classList.remove('preview-hover-block');
          }
          currentHovered = target;
          currentHovered.classList.add('preview-hover-block');
        });

        document.addEventListener('mouseout', function(e) {
          if (currentHovered) {
            currentHovered.classList.remove('preview-hover-block');
            currentHovered = null;
          }
        });

        document.addEventListener('mousedown', function(e) {
          const target = e.target.closest('.ai-editable') || e.target.closest('p, h1, h2, h3, h4, h5, h6, blockquote, li, .with-placeholder-background, img, video');
          if (!target) {
            window.parent.postMessage({ type: 'CLEAR_SELECTION' }, '*');
          }
        });

        document.addEventListener('click', function(e) {
          const target = e.target.closest('.ai-editable') || e.target.closest('p, h1, h2, h3, h4, h5, h6, blockquote, li, .with-placeholder-background, img, video');
          if (!target) return;
          e.preventDefault();
          e.stopPropagation();

          const rect = target.getBoundingClientRect();
          window.parent.postMessage({
            type: 'ELEMENT_CLICKED',
            tagName: target.tagName.toLowerCase(),
            id: target.getAttribute('id') || '',
            className: target.className || '',
            outerHTML: target.outerHTML,
            innerHTML: target.innerHTML,
            textContent: target.textContent || '',
            src: target.getAttribute('src') || '',
            alt: target.getAttribute('alt') || '',
            style: target.getAttribute('style') || '',
            rect: {
              top: rect.top,
              bottom: rect.bottom,
              left: rect.left,
              right: rect.right,
              width: rect.width,
              height: rect.height
            }
          }, '*');
        });
      })();
    </script>
  `;

  let updated = html;
  if (updated.includes('</head>')) {
    updated = updated.replace('</head>', `${helperStyles}</head>`);
  } else {
    updated = updated + helperStyles;
  }

  if (updated.includes('</body>')) {
    updated = updated.replace('</body>', `${helperScript}</body>`);
  } else {
    updated = updated + helperScript;
  }

  return updated;
};

export const updateMedia = (html: string, placeholderId?: string): string => {
  if (!html || typeof window === 'undefined') return html;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  let changed = false;

  const savedMedia = JSON.parse(localStorage.getItem('class11_global_media') || '[]');

  const getReadyUrl = (taskId: string): string | null => {
    const mediaItem = savedMedia.find((m: any) => m.placeholderId === taskId || m.id === taskId);
    if (mediaItem && !mediaItem.isPlaceholder && mediaItem.url) {
      return mediaItem.url;
    }
    return null;
  };

  const updateElementMedia = (el: Element, targetId: string) => {
    const readyUrl = getReadyUrl(targetId);
    if (!readyUrl) return;

    const tagName = el.tagName.toLowerCase();

    // Case 1: <img> tag
    if (tagName === 'img') {
      const currentSrc = el.getAttribute('src') || '';
      if (currentSrc.startsWith('placeholder://image/') || currentSrc.includes(targetId)) {
        el.setAttribute('src', readyUrl);
        changed = true;
      }
    }
    // Case 2: <video> tag (or nested <source>)
    else if (tagName === 'video') {
      const currentSrc = el.getAttribute('src') || '';
      if (currentSrc.startsWith('placeholder://video/') || currentSrc.includes(targetId)) {
        el.setAttribute('src', readyUrl);
        changed = true;
      } else {
        el.querySelectorAll('source').forEach((source) => {
          const sourceSrc = source.getAttribute('src') || '';
          if (sourceSrc.startsWith('placeholder://video/') || sourceSrc.includes(targetId)) {
            source.setAttribute('src', readyUrl);
            changed = true;
          }
        });
      }
    }
    // Case 2b: <source> tag directly
    else if (tagName === 'source') {
      const sourceSrc = el.getAttribute('src') || '';
      if (sourceSrc.startsWith('placeholder://video/') || sourceSrc.includes(targetId)) {
        el.setAttribute('src', readyUrl);
        changed = true;
      }
    }
    // Case 3: Element with background image style (or explicit placeholder-background container)
    else {
      const styleAttr = el.getAttribute('style') || '';
      if (styleAttr.includes('placeholder://') || styleAttr.includes(targetId)) {
        const updatedStyle = styleAttr.replaceAll(`placeholder://image/${targetId}`, readyUrl)
                                      .replaceAll(`placeholder://video/${targetId}`, readyUrl)
                                      .replaceAll(targetId, readyUrl);
        if (updatedStyle !== styleAttr) {
          el.setAttribute('style', updatedStyle);
          changed = true;
        }
      }
    }
  };

  if (placeholderId) {
    // 1. Search by ID first
    const targetEl = doc.getElementById(placeholderId);
    if (targetEl) {
      updateElementMedia(targetEl, placeholderId);
    }
    // 2. Fallback: search any element whose src or style contains placeholderId
    const query = `[src*="${placeholderId}"], [style*="${placeholderId}"]`;
    doc.querySelectorAll(query).forEach((el) => {
      updateElementMedia(el, placeholderId);
    });
  } else {
    // A. Search by explicit element IDs
    doc.querySelectorAll('[id]').forEach((el) => {
      const id = el.getAttribute('id') || '';
      updateElementMedia(el, id);
    });
    // B. Search all img elements with placeholder src
    doc.querySelectorAll('img[src^="placeholder://"]').forEach((el) => {
      const src = el.getAttribute('src') || '';
      const match = src.match(/placeholder:\/\/(?:image|video)\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        updateElementMedia(el, match[1]);
      }
    });
    // C. Search all video/source elements with placeholder src
    doc.querySelectorAll('video[src^="placeholder://"], source[src^="placeholder://"]').forEach((el) => {
      const src = el.getAttribute('src') || '';
      const match = src.match(/placeholder:\/\/(?:image|video)\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        updateElementMedia(el, match[1]);
      }
    });
    // D. Search all elements with placeholder style (background images)
    doc.querySelectorAll('[style*="placeholder://"]').forEach((el) => {
      const styleAttr = el.getAttribute('style') || '';
      const match = styleAttr.match(/placeholder:\/\/(?:image|video)\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        updateElementMedia(el, match[1]);
      }
    });
  }

  const prefix = html.trim().toLowerCase().startsWith('<!doctype') ? '<!DOCTYPE html>\n' : '';
  return changed ? prefix + doc.documentElement.outerHTML : html;
};

export const syncHtmlToMeta = (html: string, currentArticle: Article): Partial<Article> => {
  if (!html || typeof window === 'undefined') return {};
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const updates: Partial<Article> = {};

  // 1. Extract Title
  const titleTag = doc.querySelector('title')?.textContent || '';
  const h1Tag = doc.querySelector('h1')?.textContent || '';
  const extractedTitle = (titleTag || h1Tag).trim();
  if (extractedTitle && extractedTitle !== currentArticle.title) {
    updates.title = extractedTitle;
  }

  // 2. Extract Subtitle
  const subtitleTag = doc.querySelector('.subtitle')?.textContent || doc.querySelector('h2')?.textContent || '';
  const extractedSubtitle = subtitleTag.trim();
  if (extractedSubtitle && extractedSubtitle !== currentArticle.subtitle) {
    updates.subtitle = extractedSubtitle;
  }

  // 3. Scan placeholders in HTML to make sure they are registered in covers / photos / video
  const updatedCovers = { ...currentArticle.covers };
  let updatedVideo = currentArticle.video ? { ...currentArticle.video } : null;
  const updatedPhotos = [...currentArticle.photos];
  let coversChanged = false;
  let videoChanged = false;
  let photosChanged = false;

  // Scan <img> elements
  doc.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') || '';
    const alt = img.getAttribute('alt') || '';
    const id = img.getAttribute('id') || '';
    if (src.startsWith('placeholder://image/') && id) {
      if (updatedCovers.square.placeholderId === id) {
        if (updatedCovers.square.alt !== alt) {
          updatedCovers.square = { ...updatedCovers.square, alt };
          coversChanged = true;
        }
      } else if (updatedCovers.landscape.placeholderId === id) {
        if (updatedCovers.landscape.alt !== alt) {
          updatedCovers.landscape = { ...updatedCovers.landscape, alt };
          coversChanged = true;
        }
      } else if (updatedCovers.portrait.placeholderId === id) {
        if (updatedCovers.portrait.alt !== alt) {
          updatedCovers.portrait = { ...updatedCovers.portrait, alt };
          coversChanged = true;
        }
      } else {
        const idx = updatedPhotos.findIndex(p => p.placeholderId === id || p.url === src);
        if (idx !== -1) {
          if (updatedPhotos[idx].alt !== alt) {
            updatedPhotos[idx] = { ...updatedPhotos[idx], alt };
            photosChanged = true;
          }
        } else {
          updatedPhotos.push({
            url: src,
            alt: alt || 'AI Generated Image',
            isPlaceholder: true,
            placeholderId: id,
            placeholderStatus: 'pending',
            type: 'image'
          });
          photosChanged = true;
        }
      }
    }
  });

  // Scan <video> elements
  doc.querySelectorAll('video').forEach((vid) => {
    const src = vid.getAttribute('src') || '';
    const alt = vid.getAttribute('alt') || vid.getAttribute('title') || 'AI Generated Video';
    const id = vid.getAttribute('id') || '';
    if (src.startsWith('placeholder://video/') && id) {
      if (updatedVideo && updatedVideo.placeholderId === id) {
        if (updatedVideo.alt !== alt) {
          updatedVideo = { ...updatedVideo, alt };
          videoChanged = true;
        }
      } else if (!updatedVideo || updatedVideo.placeholderId !== id) {
        updatedVideo = {
          url: src,
          alt: alt,
          isPlaceholder: true,
          placeholderId: id,
          placeholderStatus: 'pending',
          type: 'video'
        };
        videoChanged = true;
      }
    }
  });

  // Scan .with-placeholder-background background styles
  doc.querySelectorAll('.with-placeholder-background').forEach((el) => {
    const id = el.getAttribute('id') || '';
    const styleAttr = el.getAttribute('style') || '';
    const alt = el.getAttribute('alt') || '';
    if (id && styleAttr.includes('placeholder://image/')) {
      const placeholderUrl = `placeholder://image/${id}`;
      if (updatedCovers.square.placeholderId === id) {
        if (updatedCovers.square.alt !== alt) {
          updatedCovers.square = { ...updatedCovers.square, alt };
          coversChanged = true;
        }
      } else if (updatedCovers.landscape.placeholderId === id) {
        if (updatedCovers.landscape.alt !== alt) {
          updatedCovers.landscape = { ...updatedCovers.landscape, alt };
          coversChanged = true;
        }
      } else if (updatedCovers.portrait.placeholderId === id) {
        if (updatedCovers.portrait.alt !== alt) {
          updatedCovers.portrait = { ...updatedCovers.portrait, alt };
          coversChanged = true;
        }
      } else {
        const idx = updatedPhotos.findIndex(p => p.placeholderId === id || p.url === placeholderUrl);
        if (idx !== -1) {
          if (updatedPhotos[idx].alt !== alt) {
            updatedPhotos[idx] = { ...updatedPhotos[idx], alt };
            photosChanged = true;
          }
        } else {
          updatedPhotos.push({
            url: placeholderUrl,
            alt: alt || 'AI Generated Background Image',
            isPlaceholder: true,
            placeholderId: id,
            placeholderStatus: 'pending',
            type: 'image'
          });
          photosChanged = true;
        }
      }
    }
  });

  if (coversChanged) updates.covers = updatedCovers;
  if (videoChanged) updates.video = updatedVideo;
  if (photosChanged) updates.photos = updatedPhotos;

  return updates;
};

const getDefaultHtml = (article: Article, activeCoverRatio: '1:1' | '16:9' | '9:16' = '16:9') => {
  const cover = activeCoverRatio === '1:1' 
    ? article.covers.square 
    : activeCoverRatio === '9:16' 
      ? article.covers.portrait 
      : article.covers.landscape;

  const coverHtml = cover && cover.url 
    ? `<div style="text-align: center; margin-bottom: 2rem;">
         <img src="${cover.url}" alt="${cover.alt}" style="max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);" />
       </div>`
    : '';

  let videoHtml = '';
  let activeReportVideo = article.reportVideo;
  if (!activeReportVideo && article.video && article.video.sources && article.video.sources.length > 0) {
    activeReportVideo = {
      scenes: article.video.sources.map((src, idx) => ({
        sceneId: `scene_${idx + 1}`,
        videoUrl: src,
        subtitle: `分鏡 #${idx + 1} 新聞片段`,
        narration: ''
      }))
    };
  }

  if (activeReportVideo && activeReportVideo.scenes && activeReportVideo.scenes.length > 0) {
    const scenes = activeReportVideo.scenes;
    const tickerText = `【頭條】${article.title} —— ${article.subtitle} || 關鍵熱詞：${article.meta.keywords.join(', ') || '無'} || 獨家深入報導...`;
    
    const videoElements = scenes.map((s, idx) => {
      const isPlaceholder = s.videoUrl.startsWith('placeholder-') || s.videoUrl.startsWith('placeholder://');
      if (isPlaceholder) {
        return `<div id="news-scene-fallback-${idx}" class="news-scene-fallback" style="position: absolute; inset: 0; background: #1e293b; display: ${idx === 0 ? 'flex' : 'none'}; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: #94a3b8; font-size: 0.85rem; padding: 2rem; box-sizing: border-box;">
                  <div style="font-weight: bold; margin-bottom: 0.5rem;">新聞分鏡 ${idx + 1} 影片生成中...</div>
                  <div style="font-size: 0.75rem; color: #64748b;">"${s.subtitle}"</div>
                </div>`;
      }
      return `<video id="news-video-${idx}" src="${s.videoUrl}" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: ${idx === 0 ? 'block' : 'none'};" muted playsinline></video>`;
    }).join('\n');

    const scenesData = JSON.stringify(scenes.map((s) => {
      const char = article.meta.characters?.find(c => c.id === s.characterId);
      return {
        subtitle: s.subtitle,
        charName: char?.name || '',
        charRole: char?.role || '',
        charAvatar: char?.avatarUrl || ''
      };
    }));

    videoHtml = `
      <div class="news-player-wrapper" style="margin-top: 2rem; position: relative; width: 100%; aspect-ratio: 16/9; background: #000; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.2); font-family: sans-serif;">
        ${videoElements}
        
        <div class="news-live-badge" style="position: absolute; top: 12px; left: 12px; z-index: 10; background: #dc2626; color: #fff; font-size: 10px; font-weight: 900; padding: 4px 8px; border-radius: 4px; display: flex; align-items: center; gap: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
          <span style="height: 6px; width: 6px; border-radius: 50%; background: #fff; display: inline-block;"></span>
          SNG LIVE 即時新聞
        </div>
        
        <div id="news-play-overlay" style="position: absolute; inset: 0; z-index: 15; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.2s;">
          <div style="background: rgba(0,0,0,0.6); padding: 12px 16px; border-radius: 50px; border: 1px solid rgba(255,255,255,0.2); color: #fff; font-weight: bold; font-size: 14px;">
            播放新聞報導 (20秒)
          </div>
        </div>

        <div id="news-nameplate" style="position: absolute; bottom: 60px; left: 16px; z-index: 10; display: none; align-items: center; background: rgba(15, 23, 42, 0.95); border: 1px solid #334155; border-radius: 6px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
          <img id="news-nameplate-avatar" src="" style="width: 32px; height: 32px; object-fit: cover; display: none; border-right: 1px solid #334155;" />
          <div style="padding: 2px 8px; display: flex; flex-direction: column;">
            <span id="news-nameplate-name" style="font-size: 10px; font-weight: bold; color: #fff;"></span>
            <span id="news-nameplate-role" style="font-size: 8px; color: #94a3b8; margin-top: 1px;"></span>
          </div>
        </div>

        <div id="news-subtitles" style="position: absolute; bottom: 32px; left: 50%; transform: translateX(-50%); z-index: 10; width: 85%; text-align: center; display: none;">
          <div id="news-subtitle-box" style="background: rgba(0,0,0,0.75); color: #fff; font-size: 12px; font-weight: bold; padding: 4px 14px; border-radius: 20px; display: inline-block; box-shadow: 0 2px 5px rgba(0,0,0,0.1);"></div>
        </div>

        <div style="position: absolute; bottom: 0; left: 0; right: 0; height: 24px; background: #1e3a8a; border-top: 1px solid #1d4ed8; z-index: 10; display: flex; align-items: center; overflow: hidden;">
          <div style="background: #f97316; color: #fff; font-size: 9px; font-weight: 900; padding: 0 12px; height: 100%; display: flex; align-items: center; z-index: 12;">焦點</div>
          <div style="flex: 1; position: relative; height: 100%; overflow: hidden;">
            <div style="position: absolute; white-space: nowrap; color: #fff; font-size: 10px; font-weight: bold; animation: html-marquee 20s linear infinite; padding-left: 10px; height: 100%; display: flex; align-items: center;">
              ${tickerText}
            </div>
          </div>
        </div>
      </div>
      
      <script>
        (function() {
          const scenes = ${scenesData};
          let currentIdx = 0;
          let isPlaying = false;
          let playTimer = null;
          
          const overlay = document.getElementById('news-play-overlay');
          const subtitles = document.getElementById('news-subtitles');
          const subtitleBox = document.getElementById('news-subtitle-box');
          const nameplate = document.getElementById('news-nameplate');
          const npAvatar = document.getElementById('news-nameplate-avatar');
          const npName = document.getElementById('news-nameplate-name');
          const npRole = document.getElementById('news-nameplate-role');
          
          const videos = [];
          for (let i = 0; i < scenes.length; i++) {
            const v = document.getElementById('news-video-' + i);
            const fallback = document.getElementById('news-scene-fallback-' + i);
            videos.push(v || fallback);
          }

          function updateOverlays() {
            const scene = scenes[currentIdx];
            if (scene) {
              if (scene.subtitle) {
                subtitles.style.display = 'block';
                subtitleBox.textContent = scene.subtitle;
              } else {
                subtitles.style.display = 'none';
              }
              
              if (scene.charName) {
                nameplate.style.display = 'flex';
                npName.textContent = scene.charName;
                npRole.textContent = scene.charRole;
                if (scene.charAvatar) {
                  npAvatar.src = scene.charAvatar;
                  npAvatar.style.display = 'block';
                } else {
                  npAvatar.style.display = 'none';
                }
              } else {
                nameplate.style.display = 'none';
              }
            }
          }

          function showScene(idx) {
            videos.forEach((v, i) => {
              if (!v) return;
              if (i === idx) {
                if (v.tagName === 'VIDEO') {
                  v.style.display = 'block';
                  if (isPlaying) {
                    v.currentTime = 0;
                    v.play().catch(() => {});
                  }
                } else {
                  v.style.display = 'flex';
                }
              } else {
                v.style.display = 'none';
                if (v.tagName === 'VIDEO') {
                  v.pause();
                }
              }
            });
            currentIdx = idx;
            updateOverlays();
          }

          function nextScene() {
            const nextIdx = (currentIdx + 1) % scenes.length;
            showScene(nextIdx);
          }

          function togglePlay() {
            if (isPlaying) {
              isPlaying = false;
              overlay.querySelector('div').textContent = '播放新聞報導 (20秒)';
              overlay.style.display = 'flex';
              const currentVideo = videos[currentIdx];
              if (currentVideo && currentVideo.tagName === 'VIDEO') {
                currentVideo.pause();
              }
              clearInterval(playTimer);
            } else {
              isPlaying = true;
              overlay.style.display = 'none';
              showScene(currentIdx);
              
              playTimer = setInterval(() => {
                nextScene();
              }, 5000);
            }
          }

          overlay.addEventListener('click', togglePlay);
          
          const style = document.createElement('style');
          style.innerHTML = '@keyframes html-marquee { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }';
          document.head.appendChild(style);
        })();
      </script>
    `;
  } else if (article.video && article.video.url) {
    videoHtml = `<div style="margin-top: 2rem; border-radius: 12px; overflow: hidden; background: #000; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
         <video src="${article.video.url}" controls style="width: 100%; display: block;"></video>
       </div>`;
  }

  const contentHtml = article.content
    ? marked.parse(article.content)
    : '<p style="color: #64748b; font-style: italic; text-align: center;">尚未撰寫任何內文，請在此處編輯或請 AI Agent 撰寫...</p>';

  const sourcesHtml = article.sources && article.sources.length > 0
    ? `<div style="margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid #e2e8f0; font-size: 0.85rem; color: #64748b;">
         <h4 style="font-weight: bold; margin-bottom: 0.5rem;">參考來源：</h4>
         <ul style="list-style-type: disc; padding-left: 1.25rem; margin: 0; line-height: 1.6;">
           ${article.sources.map(src => `<li><a href="${src.url}" target="_blank" style="color: #2563eb; text-decoration: underline;">${src.title}</a> (${src.url})</li>`).join('')}
         </ul>
       </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${article.title}</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      line-height: 1.7;
      color: #1e293b;
      margin: 0;
      padding: 0;
      background: #ffffff;
    }
    .article-container {
      max-width: 700px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
    }
    h1 {
      font-size: 2.25rem;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.25;
      margin-bottom: 0.5rem;
    }
    .subtitle {
      font-size: 1.125rem;
      color: #64748b;
      margin-bottom: 2rem;
    }
    .markdown-content img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
    }
  </style>
</head>
<body>
  <div class="article-container">
    <h1>${article.title}</h1>
    <div class="subtitle">${article.subtitle}</div>
    ${coverHtml}
    <div class="markdown-content">
      ${contentHtml}
    </div>
    ${videoHtml}
    ${sourcesHtml}
  </div>
</body>
</html>`;
};

const DEFAULT_ARTICLE = (id: string): Article => ({
  id,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  title: '新報導文章',
  subtitle: '在此處輸入副標題',
  content: '歡迎與 AI 圖文作家協作！\n\n這是您的第一段內容。當您完成報導後，可以隨時在右側的 Agent Window 輸入：「幫我寫作內文，並為我排版一個具有視覺美感的網頁 HTML」，AI 將自動完成內容創作與視覺網頁設計。',
  html: '',
  meta: {
    topic: '未分類議題',
    keywords: [],
    topicGuideline: '',
    visualStyleGuideline: '寫實照片風格',
    characters: []
  },
  covers: {
    square: { url: '', alt: '' },
    landscape: { url: '', alt: '' },
    portrait: { url: '', alt: '' }
  },
  photos: [],
  video: null,
  reportVideo: null,
  sources: []
});

export const ArticleWriterPage: React.FC = () => {
  const { registerToolHandlers, setRuntimeContext, setUiState, settings } = useAgent();

  // Articles State
  const [articles, setArticles] = useState<Record<string, Article>>({});
  const [activeArticleId, setActiveArticleId] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Dynamic Agent locking state
  const [lockedArticleIds, setLockedArticleIds] = useState<Record<string, boolean>>({});
  const lockTimeoutsRef = useRef<Record<string, any>>({});

  const lockArticle = useCallback((articleId: string) => {
    setLockedArticleIds(prev => ({ ...prev, [articleId]: true }));
    if (lockTimeoutsRef.current[articleId]) {
      clearTimeout(lockTimeoutsRef.current[articleId]);
    }
    lockTimeoutsRef.current[articleId] = setTimeout(() => {
      setLockedArticleIds(prev => ({ ...prev, [articleId]: false }));
      delete lockTimeoutsRef.current[articleId];
    }, 4500); // 4.5 seconds auto unlock
  }, []);
  
  // UI Panels State
  const [activeTab, setActiveTab] = useState<'meta' | 'content' | 'html'>('meta');
  const [searchQuery, setSearchQuery] = useState('');
  const [contentMode, setContentMode] = useState<'edit' | 'preview'>('edit');
  const [htmlMode, setHtmlMode] = useState<'preview' | 'code'>('preview');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [selectedBlockHtml, setSelectedBlockHtml] = useState('');
  const [selectionCoords, setSelectionCoords] = useState<{ top: number; left: number } | null>(null);
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);

  const activeCoverRatio = '16:9';
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);

  const insertTextAtCursor = (textToInsert: string) => {
    const textarea = contentTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const val = activeArticle.content || '';
    const updated = val.substring(0, start) + textToInsert + val.substring(end);

    updateActiveDoc({
      content: updated,
      html: marked.parse(updated) as string
    });

    // Restore focus and selection
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + textToInsert.length;
    }, 50);
  };

  const handleIframeLoad = () => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow || !iframe.contentDocument) return;
    // Reset selection state on iframe load
    setSelectedText('');
    setSelectionCoords(null);
    setSelectedBlockHtml('');
  };

  const handleRegenerateBlock = () => {
    if (!selectedText) return;
    
    // Open the sidebar first
    setUiState({ isOpened: true });

    // Wait a tick for the sidebar DOM to render
    setTimeout(() => {
      const el = (document.getElementById('chat-input') || document.querySelector('textarea[placeholder*="AI Assistant"]') || document.querySelector('textarea[placeholder*="Message AI"]')) as HTMLTextAreaElement;
      if (el) {
        el.value = `我選取了網頁中的以下區塊 HTML：\n\`\`\`html\n${selectedBlockHtml || selectedText}\n\`\`\`\n\n請幫我重新撰寫/重新設計這一區塊，我的具體修改要求是：`;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.focus();
        el.selectionStart = el.value.length;
        el.selectionEnd = el.value.length;
      }
    }, 100);

    setSelectedText('');
    setSelectionCoords(null);
    setSelectedBlockHtml('');
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;
      const data = event.data;

      if (data.type === 'ELEMENT_CLICKED') {
        const iframe = iframeRef.current;
        if (!iframe) return;
        const iframeRect = iframe.getBoundingClientRect();

        const isMedia = data.tagName === 'img' || 
                        data.tagName === 'video' || 
                        data.className.includes('with-placeholder-background');

        if (isMedia) {
          const targetId = data.id;
          if (!targetId) return;
          const mediaType = (data.tagName === 'video') ? 'video' : 'image';
          
          setMediaSelectionMode(mediaType);
          setOnSelectCallback(() => (item: GlobalMediaItem) => {
            const currentArticles = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
            const article = currentArticles[activeArticleId] as Article;
            if (article) {
              const finalMedia: CoverMedia = {
                url: item.url,
                alt: item.alt || '',
                isPlaceholder: false,
                placeholderId: targetId,
                type: item.type,
                promptParams: item.promptParams
              };
              
              if (article.covers.square.placeholderId === targetId) {
                article.covers.square = finalMedia;
              } else if (article.covers.landscape.placeholderId === targetId) {
                article.covers.landscape = finalMedia;
              } else if (article.covers.portrait.placeholderId === targetId) {
                article.covers.portrait = finalMedia;
              } else if (article.video?.placeholderId === targetId) {
                article.video = finalMedia;
              } else {
                const photoIdx = article.photos.findIndex(p => p.placeholderId === targetId);
                if (photoIdx !== -1) {
                  article.photos[photoIdx] = finalMedia;
                }
              }
              const originalHtml = article.html || getDefaultHtml(article, activeCoverRatio);
              article.html = updateMedia(originalHtml, targetId);
              updateActiveDoc(article);
            }
            setIsMediaLibraryOpen(false);
            setMediaSelectionMode(null);
            setOnSelectCallback(null);
          });
          setIsMediaLibraryOpen(true);
        } else {
          setSelectionCoords({
            top: iframeRect.top + data.rect.bottom + window.scrollY,
            left: iframeRect.left + data.rect.left + window.scrollX + (data.rect.width / 2)
          });
          setSelectedText(data.textContent);
          setSelectedBlockHtml(data.outerHTML);
        }
      } else if (data.type === 'CLEAR_SELECTION') {
        setSelectedText('');
        setSelectionCoords(null);
        setSelectedBlockHtml('');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [activeArticleId, activeCoverRatio, articles]);


  const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);
  const [isImageGenOpen, setIsImageGenOpen] = useState(false);
  const [globalMedia, setGlobalMedia] = useState<GlobalMediaItem[]>([]);
  const [mediaSelectionMode, setMediaSelectionMode] = useState<'image' | 'video' | 'any' | null>(null);
  const [onSelectCallback, setOnSelectCallback] = useState<((item: GlobalMediaItem) => void) | null>(null);

  const handleOpenMediaLibraryForProject = (mode: 'image' | 'video', onSelect: (url: string) => void) => {
    setMediaSelectionMode(mode);
    setOnSelectCallback(() => (item: GlobalMediaItem) => {
      onSelect(item.url);
      setIsMediaLibraryOpen(false);
    });
    setIsMediaLibraryOpen(true);
  };

  const [isVideoProjectEditorOpen, setIsVideoProjectEditorOpen] = useState(false);
  const [isSingleVideoGenOpen, setIsSingleVideoGenOpen] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [recreateImageParams, setRecreateImageParams] = useState<any | null>(null);
  const [recreateVideoParams, setRecreateVideoParams] = useState<any | null>(null);

  // Background Task Queue State
  const [queue, setQueue] = useState<QueueItem[]>([]);

  // Load from localstorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    const savedActive = localStorage.getItem(ACTIVE_ARTICLE_ID_KEY);
    
    let loadedArticles: Record<string, Article> = {};
    let activeId = '';

    if (saved) {
      try {
        loadedArticles = JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse articles from localStorage', e);
      }
    }

    if (savedActive && loadedArticles[savedActive]) {
      activeId = savedActive;
    }

    // Default template if none exists
    if (Object.keys(loadedArticles).length === 0) {
      const defaultId = 'art_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
      const defaultDoc = DEFAULT_ARTICLE(defaultId);
      loadedArticles[defaultId] = defaultDoc;
      activeId = defaultId;
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(loadedArticles));
      localStorage.setItem(ACTIVE_ARTICLE_ID_KEY, defaultId);
    }

    setArticles(loadedArticles);
    setActiveArticleId(activeId);

    // Load global media
    let loadedMedia: GlobalMediaItem[] = [];
    const savedMedia = localStorage.getItem('class11_global_media');
    if (savedMedia) {
      try {
        loadedMedia = JSON.parse(savedMedia);
        setGlobalMedia(loadedMedia);
      } catch (e) {
        console.error('Failed to parse global media', e);
      }
    } else {
      // Build default global media list if empty by pooling from all loaded articles
      const pooled: GlobalMediaItem[] = [];
      Object.values(loadedArticles).forEach(art => {
        if (art.covers.square.url && !art.covers.square.url.startsWith('placeholder-') && !art.covers.square.url.startsWith('placeholder://')) {
          pooled.push({ 
            id: 'pooled_sq_' + art.id, 
            url: art.covers.square.url, 
            type: 'image', 
            alt: art.covers.square.alt || art.title, 
            createdAt: new Date().toISOString(),
            promptParams: art.covers.square.promptParams
          });
        }
        if (art.covers.landscape.url && !art.covers.landscape.url.startsWith('placeholder-') && !art.covers.landscape.url.startsWith('placeholder://')) {
          pooled.push({ 
            id: 'pooled_la_' + art.id, 
            url: art.covers.landscape.url, 
            type: 'image', 
            alt: art.covers.landscape.alt || art.title, 
            createdAt: new Date().toISOString(),
            promptParams: art.covers.landscape.promptParams
          });
        }
        if (art.covers.portrait.url && !art.covers.portrait.url.startsWith('placeholder-') && !art.covers.portrait.url.startsWith('placeholder://')) {
          pooled.push({ 
            id: 'pooled_po_' + art.id, 
            url: art.covers.portrait.url, 
            type: 'image', 
            alt: art.covers.portrait.alt || art.title, 
            createdAt: new Date().toISOString(),
            promptParams: art.covers.portrait.promptParams
          });
        }
        if (art.video && art.video.url && !art.video.url.startsWith('placeholder-') && !art.video.url.startsWith('placeholder://')) {
          pooled.push({ 
            id: 'pooled_vi_' + art.id, 
            url: art.video.url, 
            type: 'video', 
            alt: art.video.alt || art.title, 
            createdAt: new Date().toISOString(),
            promptParams: art.video.promptParams
          });
        }
        art.photos.forEach((ph, i) => {
          if (ph.url && !ph.url.startsWith('placeholder-') && !ph.url.startsWith('placeholder://')) {
            pooled.push({ 
              id: `pooled_ph_${art.id}_${i}`, 
              url: ph.url, 
              type: ph.type || 'image', 
              alt: ph.alt, 
              createdAt: new Date().toISOString(),
              promptParams: ph.promptParams
            });
          }
        });
        if (art.reportVideo && art.reportVideo.scenes) {
          art.reportVideo.scenes.forEach((s) => {
            if (s.videoUrl && !s.videoUrl.startsWith('placeholder-') && !s.videoUrl.startsWith('placeholder://')) {
              pooled.push({
                id: `pooled_sc_${art.id}_${s.sceneId}`,
                url: s.videoUrl,
                type: 'video',
                alt: s.subtitle || `新聞分鏡 ${s.sceneId}`,
                createdAt: new Date().toISOString(),
                promptParams: {
                  prompt: s.subtitle,
                  mode: 'text-to-video',
                  aspectRatio: '16:9'
                }
              });
            }
          });
        }
      });
      setGlobalMedia(pooled);
      localStorage.setItem('class11_global_media', JSON.stringify(pooled));
      loadedMedia = pooled;
    }

    // Restore object URLs from IndexedDB asynchronously
    restoreIndexedDbMedia(loadedArticles, loadedMedia);

    setIsInitialized(true);
  }, []);

  const activeArticle = articles[activeArticleId];
  const isLocked = activeArticle ? !!lockedArticleIds[activeArticle.id] : false;

  const restoreIndexedDbMedia = async (
    currentArticles: Record<string, Article>,
    currentMedia: GlobalMediaItem[]
  ) => {
    const restoredMedia = [...currentMedia];
    const urlMap: Record<string, string> = {};
    const oldToNewUrlMap: Record<string, string> = {};

    for (let i = 0; i < restoredMedia.length; i++) {
      const item = restoredMedia[i];
      if (item.url.startsWith('blob:') || item.url.startsWith('placeholder-') || item.url.startsWith('placeholder://')) {
        const oldUrl = item.url;
        const blob = await getMediaBlob(item.placeholderId || item.id);
        if (blob) {
          const newUrl = URL.createObjectURL(blob);
          restoredMedia[i] = { ...item, url: newUrl };
          urlMap[item.placeholderId || item.id] = newUrl;
          if (oldUrl) {
            urlMap[oldUrl] = newUrl;
            if (oldUrl.startsWith('blob:')) {
              oldToNewUrlMap[oldUrl] = newUrl;
            }
          }
        }
      }
    }

    const restoredArticles = { ...currentArticles };
    let articlesUpdated = false;

    Object.keys(restoredArticles).forEach(artId => {
      const art = { ...restoredArticles[artId] };
      let artUpdated = false;

      const checkAndReplaceCover = (cover: CoverMedia) => {
        if (cover && cover.url && (cover.url.startsWith('blob:') || cover.url.startsWith('placeholder-') || cover.url.startsWith('placeholder://'))) {
          const key = cover.placeholderId;
          if (key && urlMap[key]) {
            cover.url = urlMap[key];
            artUpdated = true;
          } else if (urlMap[cover.url]) {
            cover.url = urlMap[cover.url];
            artUpdated = true;
          }
        }
      };

      if (art.covers.square) checkAndReplaceCover(art.covers.square);
      if (art.covers.landscape) checkAndReplaceCover(art.covers.landscape);
      if (art.covers.portrait) checkAndReplaceCover(art.covers.portrait);

      if (art.video && art.video.url && (art.video.url.startsWith('blob:') || art.video.url.startsWith('placeholder-') || art.video.url.startsWith('placeholder://'))) {
        const key = art.video.placeholderId;
        if (key && urlMap[key]) {
          art.video.url = urlMap[key];
          artUpdated = true;
        } else if (urlMap[art.video.url]) {
          art.video.url = urlMap[art.video.url];
          artUpdated = true;
        }
      }

      if (art.photos && art.photos.length > 0) {
        art.photos = art.photos.map(photo => {
          if (photo.url && (photo.url.startsWith('blob:') || photo.url.startsWith('placeholder-') || photo.url.startsWith('placeholder://'))) {
            const key = photo.placeholderId;
            if (key && urlMap[key]) {
              artUpdated = true;
              return { ...photo, url: urlMap[key] };
            } else if (urlMap[photo.url]) {
              artUpdated = true;
              return { ...photo, url: urlMap[photo.url] };
            }
          }
          return photo;
        });
      }

      if (art.reportVideo && art.reportVideo.scenes) {
        art.reportVideo.scenes = art.reportVideo.scenes.map(scene => {
          let sceneUpdated = false;
          let videoUrl = scene.videoUrl;
          let imageUrl = scene.imageUrl;

          if (videoUrl) {
            if (urlMap[videoUrl]) {
              videoUrl = urlMap[videoUrl];
              sceneUpdated = true;
            } else if (videoUrl.startsWith('placeholder://')) {
              const key = videoUrl.split('/').pop();
              if (key && urlMap[key]) {
                videoUrl = urlMap[key];
                sceneUpdated = true;
              }
            }
          }

          if (imageUrl) {
            if (urlMap[imageUrl]) {
              imageUrl = urlMap[imageUrl];
              sceneUpdated = true;
            } else if (imageUrl.startsWith('placeholder://')) {
              const key = imageUrl.split('/').pop();
              if (key && urlMap[key]) {
                imageUrl = urlMap[key];
                sceneUpdated = true;
              }
            }
          }

          if (sceneUpdated) {
            artUpdated = true;
            return { ...scene, videoUrl, imageUrl };
          }
          return scene;
        });
      }

      // Replace old blob URLs in HTML string & run updateMedia
      let html = art.html || '';
      let htmlChanged = false;
      Object.keys(oldToNewUrlMap).forEach(oldUrl => {
        if (html.includes(oldUrl)) {
          html = html.replaceAll(oldUrl, oldToNewUrlMap[oldUrl]);
          htmlChanged = true;
        }
      });

      const updatedHtml = updateMedia(html);
      if (updatedHtml !== art.html) {
        art.html = updatedHtml;
        artUpdated = true;
      } else if (htmlChanged) {
        art.html = html;
        artUpdated = true;
      }

      if (artUpdated) {
        restoredArticles[artId] = art;
        articlesUpdated = true;
      }
    });

    if (Object.keys(urlMap).length > 0) {
      setGlobalMedia(restoredMedia);
      localStorage.setItem('class11_global_media', JSON.stringify(restoredMedia));
    }
    if (articlesUpdated) {
      setArticles(restoredArticles);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(restoredArticles));
    }
  };

  const saveGlobalMedia = (newList: GlobalMediaItem[]) => {
    setGlobalMedia(newList);
    localStorage.setItem('class11_global_media', JSON.stringify(newList));
  };

  // Sync active article runtime context for Agent Grounding
  useEffect(() => {
    if (!activeArticle) return;
    
    const blockCount = activeArticle.content.split('\n\n').filter(b => b.trim()).length;
    const mediaCount = (activeArticle.covers.square.url ? 1 : 0) + 
                       (activeArticle.covers.landscape.url ? 1 : 0) + 
                       (activeArticle.covers.portrait.url ? 1 : 0) + 
                       activeArticle.photos.length + 
                       (activeArticle.video ? 1 : 0);

    const contextDesc = `當前報導主題：「${activeArticle.title}」，副標題：「${activeArticle.subtitle}」。議題設定指引：${activeArticle.meta.topicGuideline || '無'}。視覺風格指引：${activeArticle.meta.visualStyleGuideline || '未指定'}。文章共有 ${blockCount} 個內文區塊，素材庫有 ${mediaCount} 個媒體檔案。`;
    
    setRuntimeContext(
      `使用者目前在 /class11-article-writer 中，你扮演網路圖文作家。${contextDesc} 請秉持非線性原則，根據用戶當下意圖（討論大綱、撰寫文章、提供搜尋佐證、發起影音繪圖生成）來提供協助。`
    );
  }, [activeArticle, setRuntimeContext]);

  // Prevent double scrollbars when fullscreen preview is active
  useEffect(() => {
    if (isFullscreenPreview) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isFullscreenPreview]);

  // FIFO Queue background processing
  useEffect(() => {
    const processQueue = async () => {
      const pendingTask = queue.find(t => t.status === 'pending');
      if (!pendingTask) return;

      // Mark task as processing
      const taskArticleId = pendingTask.params?.articleId;
      setQueue(prev => prev.map(t => t.id === pendingTask.id ? { ...t, status: 'processing', progress: 15 } : t));
      updatePlaceholderStatus(pendingTask.id, 'processing', undefined, taskArticleId);

      try {
        const apiKey = settings?.apiKey || '';
        if (!apiKey) {
          throw new Error('請先在右側 Agent 設定區填入 Gemini API Key！');
        }

        // Progress simulation tick
        const progressInterval = setInterval(() => {
          setQueue(prev => prev.map(t => {
            if (t.id === pendingTask.id && t.status === 'processing') {
              const currentProgress = t.progress ?? 15;
              const nextProgress = currentProgress < 90 ? currentProgress + 5 : currentProgress;
              return { ...t, progress: nextProgress };
            }
            return t;
          }));
        }, 3000);

        if (pendingTask.type === 'image') {
          const result = await generateImage({
            prompt: pendingTask.prompt,
            aspectRatio: pendingTask.params.aspectRatio || '1:1',
            referenceImageBase64: pendingTask.params.referenceImageBase64,
            model: pendingTask.params.model
          }, apiKey);

          clearInterval(progressInterval);
          await saveMediaBlob(pendingTask.id, result.blob);
          updateArticleMedia(pendingTask.targetField!, result.objectUrl, pendingTask.id, taskArticleId);
          setQueue(prev => prev.map(t => t.id === pendingTask.id ? { ...t, status: 'completed', progress: 100 } : t));
        } else {
          // Video generation
          const result = await generateVideo({
            prompt: pendingTask.prompt,
            aspectRatio: pendingTask.params.aspectRatio || '16:9',
            resolution: pendingTask.params.resolution || '720p',
            mode: pendingTask.params.mode || GenerationMode.TEXT_TO_VIDEO,
            startFrame: pendingTask.params.startFrame,
            endFrame: pendingTask.params.endFrame,
            referenceImages: pendingTask.params.referenceImages,
            styleImage: pendingTask.params.styleImage,
            model: pendingTask.params.model
          }, apiKey);

          clearInterval(progressInterval);
          await saveMediaBlob(pendingTask.id, result.blob);
          updateArticleMedia(pendingTask.targetField || 'video', result.objectUrl, pendingTask.id, taskArticleId);
          setQueue(prev => prev.map(t => t.id === pendingTask.id ? { ...t, status: 'completed', progress: 100 } : t));
        }
      } catch (err: any) {
        console.error('Task execution error:', err);
        setQueue(prev => prev.map(t => t.id === pendingTask.id ? { ...t, status: 'failed', error: err.message || String(err) } : t));
        updatePlaceholderStatus(pendingTask.id, 'failed', err.message || String(err), taskArticleId);
      }
    };

    processQueue();
  }, [queue, settings?.apiKey]);

  const enqueueImage = (args: {
    prompt: string;
    size: '1:1' | '16:9' | '9:16';
    mode: 'text-to-image' | 'image-to-image' | 'reference-to-image';
    referenceImageBase64?: string;
    targetField: 'cover_square' | 'cover_landscape' | 'cover_portrait' | 'photo_list';
    model?: string;
    articleId?: string;
    customTaskId?: string;
  }) => {
    const taskId = args.customTaskId || 'task_img_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
    const { prompt, size, mode, referenceImageBase64, targetField, model, articleId } = args;

    const newTask: QueueItem = {
      id: taskId,
      type: 'image',
      prompt,
      status: 'pending',
      progress: 0,
      targetField,
      params: { aspectRatio: size, mode, referenceImageBase64, model, articleId }
    };

    setQueue(prev => [...prev, newTask]);
    // Do not pop up task queue automatically, return to media library grid view
    insertMediaPlaceholder(targetField, prompt, taskId, articleId, {
      prompt,
      size,
      mode,
      referenceImageBase64,
      model
    });
    return taskId;
  };

  const enqueueVideo = (args: {
    prompt: string;
    aspectRatio: '1:1' | '16:9' | '9:16';
    resolution: '720p' | '1080p';
    mode: 'text-to-video' | 'frame-to-video' | 'reference-to-video';
    startFrameBase64?: string;
    endFrameBase64?: string;
    model?: string;
    articleId?: string;
    targetField?: string;
    narration?: string;
    subtitle?: string;
    characterId?: string;
    customTaskId?: string;
  }) => {
    const taskId = args.customTaskId || 'task_vid_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
    const { prompt, aspectRatio, resolution, mode, startFrameBase64, endFrameBase64, model, articleId, targetField = 'video', narration, subtitle, characterId } = args;

    const newTask: QueueItem = {
      id: taskId,
      type: 'video',
      prompt,
      status: 'pending',
      progress: 0,
      targetField: targetField as any,
      params: {
        aspectRatio,
        resolution,
        mode: mode === 'frame-to-video' ? GenerationMode.FRAMES_TO_VIDEO : mode === 'reference-to-video' ? GenerationMode.REFERENCES_TO_VIDEO : GenerationMode.TEXT_TO_VIDEO,
        startFrame: startFrameBase64 ? { base64: startFrameBase64, type: 'image/jpeg', name: 'uploaded_frame.jpg' } : undefined,
        endFrame: endFrameBase64 ? { base64: endFrameBase64, type: 'image/jpeg', name: 'uploaded_frame.jpg' } : undefined,
        model,
        articleId
      }
    };

    setQueue(prev => [...prev, newTask]);
    insertMediaPlaceholder(targetField, prompt, taskId, articleId, {
      prompt,
      aspectRatio,
      resolution,
      mode,
      startFrame: startFrameBase64 ? { base64: startFrameBase64, type: 'image/jpeg', name: 'uploaded_frame.jpg' } : undefined,
      endFrame: endFrameBase64 ? { base64: endFrameBase64, type: 'image/jpeg', name: 'uploaded_frame.jpg' } : undefined,
      model,
      narration,
      subtitle,
      characterId
    });
    return taskId;
  };

  const genMedia = (html: string): void => {
    if (!html || typeof window === 'undefined') return;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // 1. Scan <img> elements
    const imgs = Array.from(doc.querySelectorAll('img'));
    imgs.forEach((img) => {
      const src = img.getAttribute('src') || '';
      const alt = img.getAttribute('alt') || '';
      const id = img.getAttribute('id') || '';
      if (src.startsWith('placeholder://image/') && id) {
        const taskExists = queue.some(t => t.id === id);
        const globalMediaExists = globalMedia.some(m => m.id === id || m.placeholderId === id);
        if (!taskExists && !globalMediaExists) {
          let size: '1:1' | '16:9' | '9:16' = '16:9';
          if (alt.includes('1:1') || alt.includes('square') || alt.includes('正方形')) {
            size = '1:1';
          } else if (alt.includes('9:16') || alt.includes('portrait') || alt.includes('直式')) {
            size = '9:16';
          }
          enqueueImage({
            prompt: alt || 'AI Generated Image',
            size,
            mode: 'text-to-image',
            targetField: 'photo_list',
            articleId: activeArticleId,
            customTaskId: id
          });
        }
      }
    });

    // 2. Scan <video> elements
    const videos = Array.from(doc.querySelectorAll('video'));
    videos.forEach((vid) => {
      const src = vid.getAttribute('src') || '';
      const id = vid.getAttribute('id') || '';
      const alt = vid.getAttribute('alt') || vid.getAttribute('title') || 'AI Generated Video';
      if (src.startsWith('placeholder://video/') && id) {
        const taskExists = queue.some(t => t.id === id);
        const globalMediaExists = globalMedia.some(m => m.id === id || m.placeholderId === id);
        if (!taskExists && !globalMediaExists) {
          enqueueVideo({
            prompt: alt,
            aspectRatio: '16:9',
            resolution: '720p',
            mode: 'text-to-video',
            articleId: activeArticleId,
            targetField: 'video',
            customTaskId: id
          });
        }
      }
    });

    // 3. Scan elements with background placeholder styles (.with-placeholder-background)
    const bgElements = Array.from(doc.querySelectorAll('.with-placeholder-background'));
    bgElements.forEach((el) => {
      const id = el.getAttribute('id') || '';
      const styleAttr = el.getAttribute('style') || '';
      const alt = el.getAttribute('alt') || 'AI Generated Background Image';
      if (id && styleAttr.includes('placeholder://image/')) {
        const taskExists = queue.some(t => t.id === id);
        const globalMediaExists = globalMedia.some(m => m.id === id || m.placeholderId === id);
        if (!taskExists && !globalMediaExists) {
          enqueueImage({
            prompt: alt,
            size: '16:9', // Defaults to 16:9 cover for backgrounds
            mode: 'text-to-image',
            targetField: 'photo_list',
            articleId: activeArticleId,
            customTaskId: id
          });
        }
      }
    });
  };

  // updateMedia and syncHtmlToMeta have been moved to module scope.

  // Register Custom Tools for AI Agent
  useEffect(() => {
    registerToolHandlers({
      get_active_article_state: (args: { articleId?: string }) => {
        const currentArticles = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
        const targetId = args?.articleId || localStorage.getItem(ACTIVE_ARTICLE_ID_KEY) || '';
        const article = currentArticles[targetId];
        if (!article) return { error: `Article "${targetId}" not found` };
        
        return {
          article,
          queueState: queue.map(t => ({ id: t.id, type: t.type, status: t.status, progress: t.progress }))
        };
      },
      update_article_content: (args: { content: string; articleId?: string }) => {
        const { content, articleId } = args;
        const currentArticles = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
        const targetId = articleId || localStorage.getItem(ACTIVE_ARTICLE_ID_KEY) || '';
        const article = currentArticles[targetId] as Article;
        if (!article) return { error: `Article "${targetId}" not found` };

        // Temporarily lock the article
        lockArticle(targetId);

        article.content = content;
        article.updatedAt = new Date().toISOString();
        currentArticles[targetId] = article;

        setArticles(currentArticles);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentArticles));

        return { success: true, charCount: content.length };
      },
      update_article_html: (args: { html: string; articleId?: string }) => {
        const { html, articleId } = args;
        const currentArticles = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
        const targetId = articleId || localStorage.getItem(ACTIVE_ARTICLE_ID_KEY) || '';
        const article = currentArticles[targetId] as Article;
        if (!article) return { error: `Article "${targetId}" not found` };

        // Temporarily lock the article
        lockArticle(targetId);

        // 1. Submit background queue for new placeholders
        genMedia(html);

        // 2. Batch resolve ready media in HTML
        const updatedHtml = updateMedia(html);

        // 3. Sync from HTML to Meta
        const metaUpdates = syncHtmlToMeta(updatedHtml, article);

        const updatedArticle = {
          ...article,
          ...metaUpdates,
          html: updatedHtml,
          updatedAt: new Date().toISOString()
        };

        currentArticles[targetId] = updatedArticle;
        setArticles(currentArticles);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentArticles));

        return { success: true, charCount: updatedHtml.length };
      },
      update_article_metadata: (args: { title?: string; subtitle?: string; meta?: Partial<Article['meta']>; sources?: SourceItem[]; articleId?: string }) => {
        const { title, subtitle, meta, sources, articleId } = args;
        const currentArticles = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
        const targetId = articleId || localStorage.getItem(ACTIVE_ARTICLE_ID_KEY) || '';
        const article = currentArticles[targetId] as Article;
        if (!article) return { error: `Article "${targetId}" not found` };

        // Temporarily lock the article
        lockArticle(targetId);

        if (title) article.title = title;
        if (subtitle) article.subtitle = subtitle;
        if (meta) article.meta = { ...article.meta, ...meta };
        if (sources) article.sources = sources;

        article.updatedAt = new Date().toISOString();
        currentArticles[targetId] = article;

        setArticles(currentArticles);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentArticles));

        return { success: true, title: article.title };
      },
      enqueue_image_generation: (args: any) => {
        const taskId = enqueueImage(args);
        return { success: true, taskId, placeholderUrl: `placeholder://image/${taskId}`, status: 'enqueued', message: '已加入背景生成佇列' };
      },
      enqueue_video_generation: (args: any) => {
        const taskId = enqueueVideo(args);
        return { success: true, taskId, placeholderUrl: `placeholder://video/${taskId}`, status: 'enqueued', message: '已加入背景影片生成佇列' };
      },
      collect_related_photos: async (args: { query: string }) => {
        console.log('Agent requested collecting related photos for query:', args.query);
        return { status: 'delegated_to_google_search_grounding', query: args.query + " photos" };
      },
      add_web_photo_to_library: (args: { url: string; alt: string; articleId?: string }) => {
        const { url, alt, articleId } = args;
        const currentArticles = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
        const targetId = articleId || localStorage.getItem(ACTIVE_ARTICLE_ID_KEY) || '';
        const article = currentArticles[targetId] as Article;
        if (!article) return { error: `Article "${targetId}" not found` };

        lockArticle(targetId);

        const newPhoto = { url, alt };
        article.photos = [...(article.photos || []), newPhoto];
        article.updatedAt = new Date().toISOString();
        currentArticles[targetId] = article;

        setArticles(currentArticles);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentArticles));

        const savedMedia = JSON.parse(localStorage.getItem('class11_global_media') || '[]');
        const newItem = {
          id: 'web_img_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
          url,
          type: 'image' as const,
          alt,
          createdAt: new Date().toISOString()
        };
        localStorage.setItem('class11_global_media', JSON.stringify([newItem, ...savedMedia]));

        return { success: true, photoCount: article.photos.length };
      },
      get_media_assets: (args: { articleId?: string }) => {
        const currentArticles = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
        const targetId = args?.articleId || localStorage.getItem(ACTIVE_ARTICLE_ID_KEY) || '';
        const article = currentArticles[targetId] as Article;
        if (!article) return { error: `Article "${targetId}" not found` };

        return {
          covers: article.covers,
          photos: article.photos,
          video: article.video
        };
      },
      delete_media_asset: (args: { assetUrl: string; articleId?: string }) => {
        const { assetUrl, articleId } = args;
        const currentArticles = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
        const targetId = articleId || localStorage.getItem(ACTIVE_ARTICLE_ID_KEY) || '';
        const article = currentArticles[targetId] as Article;
        if (!article) return { error: `Article "${targetId}" not found` };

        // Lock article for modification
        lockArticle(targetId);

        let deleted = false;
        if (article.covers.square.url === assetUrl) {
          article.covers.square = { url: '', alt: '' };
          deleted = true;
        } else if (article.covers.landscape.url === assetUrl) {
          article.covers.landscape = { url: '', alt: '' };
          deleted = true;
        } else if (article.covers.portrait.url === assetUrl) {
          article.covers.portrait = { url: '', alt: '' };
          deleted = true;
        } else if (article.video?.url === assetUrl) {
          article.video = null;
          deleted = true;
        } else {
          const originalLen = article.photos.length;
          article.photos = article.photos.filter(p => p.url !== assetUrl);
          if (article.photos.length < originalLen) {
            deleted = true;
          } else if (article.reportVideo && article.reportVideo.scenes) {
            const sceneIdx = article.reportVideo.scenes.findIndex(s => s.videoUrl === assetUrl);
            if (sceneIdx !== -1) {
              article.reportVideo.scenes[sceneIdx].videoUrl = '';
              deleted = true;
            }
          }
        }

        if (deleted) {
          article.updatedAt = new Date().toISOString();
          currentArticles[targetId] = article;
          setArticles(currentArticles);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentArticles));
          return { success: true };
        }
        return { error: 'Media asset URL not found' };
      },
      web_search_grounding: async (args: { query: string }) => {
        console.log('Agent requested web grounding for query:', args.query);
        return { status: 'delegated_to_google_search_grounding', query: args.query };
      },
      list_articles: () => {
        const currentArticles = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
        const list = Object.values(currentArticles).map((a: any) => ({
          id: a.id,
          title: a.title,
          subtitle: a.subtitle,
          createdAt: a.createdAt,
          updatedAt: a.updatedAt,
          topic: a.meta?.topic || ''
        }));
        return { articles: list };
      },
      create_article: (args: { title: string; subtitle: string; topic?: string }) => {
        const newId = 'article_' + Date.now();
        const newArticle: Article = {
          id: newId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          title: args.title || '未命名報導',
          subtitle: args.subtitle || '點擊編輯副標題或內容敘述',
          content: '',
          html: '',
          meta: {
            topic: args.topic || '',
            keywords: [],
            topicGuideline: '',
            visualStyleGuideline: ''
          },
          covers: {
            square: { url: '', alt: '' },
            landscape: { url: '', alt: '' },
            portrait: { url: '', alt: '' }
          },
          photos: [],
          video: null,
          sources: []
        };
        
        const currentArticles = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
        currentArticles[newId] = newArticle;
        
        setArticles(currentArticles);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentArticles));
        
        setActiveArticleId(newId);
        localStorage.setItem(ACTIVE_ARTICLE_ID_KEY, newId);
        
        return { success: true, articleId: newId, article: newArticle };
      },
      switch_active_article: (args: { articleId: string }) => {
        const currentArticles = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
        if (!currentArticles[args.articleId]) {
          return { error: `Article ID "${args.articleId}" not found.` };
        }
        
        setActiveArticleId(args.articleId);
        localStorage.setItem(ACTIVE_ARTICLE_ID_KEY, args.articleId);
        return { success: true, activeId: args.articleId, article: currentArticles[args.articleId] };
      },
      delete_article: (args: { articleId: string }) => {
        const currentArticles = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
        if (!currentArticles[args.articleId]) {
          return { error: `Article ID "${args.articleId}" not found.` };
        }
        
        delete currentArticles[args.articleId];
        setArticles(currentArticles);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentArticles));
        
        const keys = Object.keys(currentArticles);
        if (activeArticleId === args.articleId) {
          if (keys.length > 0) {
            setActiveArticleId(keys[0]);
            localStorage.setItem(ACTIVE_ARTICLE_ID_KEY, keys[0]);
          } else {
            setActiveArticleId('');
            localStorage.removeItem(ACTIVE_ARTICLE_ID_KEY);
          }
        }
        
        return { success: true, remainingCount: keys.length };
      }
    });

    return () => registerToolHandlers({});
  }, [queue, activeArticleId, registerToolHandlers, articles, lockArticle, enqueueImage, enqueueVideo]);

  // Database helper actions
  const saveArticles = (updated: Record<string, Article>) => {
    setArticles(updated);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  };

  const handleCreateArticle = () => {
    const newId = 'art_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
    const newDoc = DEFAULT_ARTICLE(newId);
    newDoc.title = '未命名報導文章';
    const updated = { ...articles, [newId]: newDoc };
    saveArticles(updated);
    setActiveArticleId(newId);
    localStorage.setItem(ACTIVE_ARTICLE_ID_KEY, newId);
  };

  const handleDeleteArticle = (id: string) => {
    if (confirm(`確定要刪除「${articles[id]?.title}」嗎？`)) {
      const updated = { ...articles };
      delete updated[id];
      saveArticles(updated);
      
      if (activeArticleId === id) {
        const remainingKeys = Object.keys(updated);
        if (remainingKeys.length > 0) {
          const remainingId = remainingKeys[0];
          setActiveArticleId(remainingId);
          localStorage.setItem(ACTIVE_ARTICLE_ID_KEY, remainingId);
        } else {
          setActiveArticleId('');
          localStorage.removeItem(ACTIVE_ARTICLE_ID_KEY);
        }
      }
    }
  };

  const handleSelectArticle = (id: string) => {
    setActiveArticleId(id);
    localStorage.setItem(ACTIVE_ARTICLE_ID_KEY, id);
    setActiveTab('meta');
  };



  // Placeholder insertion helpers
  const insertMediaPlaceholder = (targetField: string, alt: string, taskId: string, articleId?: string, params?: any) => {
    const isVideo = targetField === 'video' || (targetField.startsWith('report_video_scene_') && !targetField.includes('_image_')) || (targetField.startsWith('project_') && targetField.endsWith('_video'));

    const placeholderItem: GlobalMediaItem = {
      id: taskId,
      url: `placeholder://${isVideo ? 'video' : 'image'}/${taskId}`,
      alt: alt,
      type: isVideo ? 'video' : 'image',
      createdAt: new Date().toISOString(),
      isPlaceholder: true,
      placeholderId: taskId,
      placeholderStatus: 'pending',
      promptParams: params
    };
    
    // Add placeholder to global media list
    const updatedMedia = [placeholderItem, ...globalMedia];
    saveGlobalMedia(updatedMedia);

    if (targetField.startsWith('project_')) {
      const parts = targetField.split('_');
      const projectId = parts[1] + '_' + parts[2];
      const sceneNum = parseInt(parts[4] || '1', 10);
      const type = parts[5];
      const sceneId = `scene_${sceneNum}`;

      const savedProjects = JSON.parse(localStorage.getItem('class11_video_projects') || '{}');
      const project = savedProjects[projectId];
      if (project) {
        const scene = project.scenes.find((s: any) => s.sceneId === sceneId);
        if (scene) {
          if (type === 'image') {
            scene.imageUrl = `placeholder://image/${taskId}`;
          } else {
            scene.videoUrl = `placeholder://video/${taskId}`;
          }
          project.updatedAt = new Date().toISOString();
          savedProjects[projectId] = project;
          localStorage.setItem('class11_video_projects', JSON.stringify(savedProjects));
        }
      }
      return;
    }

    const currentArticles = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
    const targetId = articleId || localStorage.getItem(ACTIVE_ARTICLE_ID_KEY) || '';
    const article = currentArticles[targetId] as Article;
    if (!article) return;

    // Lock the article
    lockArticle(targetId);

    // Also update article cover/video placeholders for active UI feedback
    const placeholderMedia: CoverMedia = {
      url: `placeholder://${isVideo ? 'video' : 'image'}/${taskId}`,
      alt: alt,
      isPlaceholder: true,
      placeholderId: taskId,
      placeholderStatus: 'pending',
      type: isVideo ? 'video' : 'image',
      promptParams: params
    };

    if (targetField === 'cover_square') {
      article.covers.square = placeholderMedia;
    } else if (targetField === 'cover_landscape') {
      article.covers.landscape = placeholderMedia;
    } else if (targetField === 'cover_portrait') {
      article.covers.portrait = placeholderMedia;
    } else if (targetField === 'video') {
      article.video = placeholderMedia;
    } else if (targetField === 'photo_list') {
      article.photos.push(placeholderMedia);
    } else if (targetField.startsWith('report_video_scene_image_')) {
      const sceneNum = targetField.split('_').pop() || '1';
      const sceneId = `scene_${sceneNum}`;
      if (!article.reportVideo) {
        article.reportVideo = { scenes: [] };
      }
      const idx = article.reportVideo.scenes.findIndex(s => s.sceneId === sceneId);
      if (idx !== -1) {
        article.reportVideo.scenes[idx].imageUrl = `placeholder://image/${taskId}`;
      } else {
        article.reportVideo.scenes.push({
          sceneId,
          videoUrl: '',
          imageUrl: `placeholder://image/${taskId}`,
          narration: params?.narration || '',
          subtitle: params?.subtitle || '',
          characterId: params?.characterId
        });
      }
      article.reportVideo.scenes.sort((a, b) => {
        const numA = parseInt(a.sceneId.split('_')[1] || '0', 10);
        const numB = parseInt(b.sceneId.split('_')[1] || '0', 10);
        return numA - numB;
      });
    } else if (targetField.startsWith('report_video_scene_')) {
      const sceneNum = targetField.split('_').pop() || '1';
      const sceneId = `scene_${sceneNum}`;
      if (!article.reportVideo) {
        article.reportVideo = { scenes: [] };
      }
      const existing = article.reportVideo.scenes.find(s => s.sceneId === sceneId);
      if (existing) {
        existing.videoUrl = `placeholder://video/${taskId}`;
        if (params?.narration) existing.narration = params.narration;
        if (params?.subtitle) existing.subtitle = params.subtitle;
        if (params?.characterId) existing.characterId = params.characterId;
      } else {
        article.reportVideo.scenes.push({
          sceneId,
          videoUrl: `placeholder://video/${taskId}`,
          narration: params?.narration || '',
          subtitle: params?.subtitle || '',
          characterId: params?.characterId
        });
      }
      article.reportVideo.scenes.sort((a, b) => {
        const numA = parseInt(a.sceneId.split('_')[1] || '0', 10);
        const numB = parseInt(b.sceneId.split('_')[1] || '0', 10);
        return numA - numB;
      });

      if (sceneId === 'scene_1') {
        article.video = placeholderMedia;
      }
    }

    currentArticles[targetId] = article;
    setArticles(currentArticles);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentArticles));
  };

  const updateArticleMedia = (targetField: string, objectUrl: string, taskId: string, articleId?: string) => {
    // 1. Update global media item
    const savedMedia = JSON.parse(localStorage.getItem('class11_global_media') || '[]');
    const idxMedia = savedMedia.findIndex((m: any) => m.placeholderId === taskId || m.id === taskId);
    const task = queue.find(t => t.id === taskId);

    if (idxMedia !== -1) {
      savedMedia[idxMedia].url = objectUrl;
      savedMedia[idxMedia].isPlaceholder = false;
      if (task) {
        savedMedia[idxMedia].alt = task.prompt;
        savedMedia[idxMedia].promptParams = task.params;
      }
      localStorage.setItem('class11_global_media', JSON.stringify(savedMedia));
      setGlobalMedia(savedMedia);
    } else {
      // Item was not added yet, append it
      const newItem: GlobalMediaItem = {
        id: taskId,
        url: objectUrl,
        type: (targetField === 'video' || (targetField.startsWith('report_video_scene_') && !targetField.includes('_image_'))) ? 'video' : 'image',
        alt: 'AI Generated Media',
        createdAt: new Date().toISOString(),
        isPlaceholder: false,
        placeholderId: taskId
      };
      const updatedMedia = [newItem, ...savedMedia];
      localStorage.setItem('class11_global_media', JSON.stringify(updatedMedia));
      setGlobalMedia(updatedMedia);
    }

    if (targetField.startsWith('project_')) {
      const parts = targetField.split('_');
      const projectId = parts[1] + '_' + parts[2];
      const sceneNum = parseInt(parts[4] || '1', 10);
      const type = parts[5];
      const sceneId = `scene_${sceneNum}`;

      const savedProjects = JSON.parse(localStorage.getItem('class11_video_projects') || '{}');
      const project = savedProjects[projectId];
      if (project) {
        const scene = project.scenes.find((s: any) => s.sceneId === sceneId);
        if (scene) {
          if (type === 'image') {
            scene.imageUrl = objectUrl;
          } else {
            scene.videoUrl = objectUrl;
          }
          project.updatedAt = new Date().toISOString();
          savedProjects[projectId] = project;
          localStorage.setItem('class11_video_projects', JSON.stringify(savedProjects));
        }
      }
      return;
    }

    // 2. Update local article cover placeholders (if matching active/target article)
    const currentArticles = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
    const targetId = articleId || localStorage.getItem(ACTIVE_ARTICLE_ID_KEY) || '';
    const article = currentArticles[targetId] as Article;
    if (!article) return;

    lockArticle(targetId);

    const existingMedia = targetField === 'photo_list'
      ? article.photos.find(p => p.placeholderId === taskId)
      : targetField === 'video'
        ? article.video
        : (targetField === 'cover_square' ? article.covers.square : (targetField === 'cover_landscape' ? article.covers.landscape : article.covers.portrait));

    const finalMedia: CoverMedia = {
      url: objectUrl,
      alt: existingMedia?.alt || '',
      isPlaceholder: false,
      placeholderId: taskId,
      type: existingMedia?.type || ((targetField === 'video' || (targetField.startsWith('report_video_scene_') && !targetField.includes('_image_'))) ? 'video' : 'image'),
      promptParams: existingMedia?.promptParams
    };

    if (targetField === 'cover_square') {
      article.covers.square = finalMedia;
    } else if (targetField === 'cover_landscape') {
      article.covers.landscape = finalMedia;
    } else if (targetField === 'cover_portrait') {
      article.covers.portrait = finalMedia;
    } else if (targetField === 'video') {
      article.video = finalMedia;
    } else if (targetField === 'photo_list') {
      const idx = article.photos.findIndex(p => p.placeholderId === taskId);
      if (idx !== -1) {
        article.photos[idx] = finalMedia;
      }
    } else if (targetField.startsWith('report_video_scene_image_')) {
      const sceneNum = targetField.split('_').pop() || '1';
      const sceneId = `scene_${sceneNum}`;
      if (article.reportVideo && article.reportVideo.scenes) {
        const idx = article.reportVideo.scenes.findIndex(s => s.sceneId === sceneId);
        if (idx !== -1) {
          article.reportVideo.scenes[idx].imageUrl = objectUrl;
        }
      }
    } else if (targetField.startsWith('report_video_scene_')) {
      const sceneNum = targetField.split('_').pop() || '1';
      const sceneId = `scene_${sceneNum}`;
      if (article.reportVideo && article.reportVideo.scenes) {
        const idx = article.reportVideo.scenes.findIndex(s => s.sceneId === sceneId);
        if (idx !== -1) {
          article.reportVideo.scenes[idx].videoUrl = objectUrl;
        }
      }
      if (sceneId === 'scene_1') {
        article.video = finalMedia;
      }
    }

    // Remap placeholder URI to real URL in the generated HTML code
    if (article.html) {
      article.html = updateMedia(article.html);
    }

    currentArticles[targetId] = article;
    setArticles(currentArticles);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentArticles));
  };



  const handleCancelTask = (id: string) => {
    const task = queue.find(t => t.id === id);
    if (task) {
      const taskArticleId = task.params?.articleId;
      setQueue(prev => prev.map(t => t.id === id ? { ...t, status: 'failed', error: '任務已被手動停止。' } : t));
      updatePlaceholderStatus(id, 'failed', '任務已被手動停止。', taskArticleId);
    }
  };

  const handleRetryTask = (id: string) => {
    setQueue(prev => prev.map(t => {
      if (t.id === id) {
        return { ...t, status: 'pending', progress: 0, error: undefined };
      }
      return t;
    }));
    const task = queue.find(t => t.id === id);
    const taskArticleId = task?.params?.articleId;
    updatePlaceholderStatus(id, 'pending', undefined, taskArticleId);
  };

  const updatePlaceholderStatus = (taskId: string, status: 'pending' | 'processing' | 'failed', error?: string, articleId?: string) => {
    // 1. Update global media placeholder status
    const savedMedia = JSON.parse(localStorage.getItem('class11_global_media') || '[]');
    const idxMedia = savedMedia.findIndex((m: any) => m.placeholderId === taskId || m.id === taskId);
    if (idxMedia !== -1) {
      savedMedia[idxMedia].placeholderStatus = status;
      savedMedia[idxMedia].error = error;
      localStorage.setItem('class11_global_media', JSON.stringify(savedMedia));
      setGlobalMedia(savedMedia);
    }

    // 2. Update local article media placeholders
    const currentArticles = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
    const targetId = articleId || localStorage.getItem(ACTIVE_ARTICLE_ID_KEY) || '';
    const article = currentArticles[targetId] as Article;
    if (!article) return;

    lockArticle(targetId);
    let updated = false;

    const updateMedia = (media: CoverMedia) => {
      if (media.isPlaceholder && media.placeholderId === taskId) {
        media.placeholderStatus = status;
        if (error !== undefined) {
          media.error = error;
        } else if (status === 'pending') {
          media.error = undefined;
        }
        updated = true;
      }
    };

    if (article.covers.square) updateMedia(article.covers.square);
    if (article.covers.landscape) updateMedia(article.covers.landscape);
    if (article.covers.portrait) updateMedia(article.covers.portrait);
    if (article.video) updateMedia(article.video);
    article.photos.forEach(p => updateMedia(p));
    if (article.reportVideo && article.reportVideo.scenes) {
      article.reportVideo.scenes.forEach(s => {
        if (s.videoUrl) {
          const tempMedia: CoverMedia = {
            url: s.videoUrl,
            alt: s.subtitle,
            isPlaceholder: s.videoUrl.startsWith('placeholder://') || s.videoUrl.startsWith('placeholder-'),
            placeholderId: s.videoUrl.startsWith('placeholder://') ? s.videoUrl.split('/').pop() : s.videoUrl,
            placeholderStatus: 'pending'
          };
          updateMedia(tempMedia);
          if (updated) {
            s.videoUrl = tempMedia.url;
          }
        }
        if (s.imageUrl) {
          const tempMedia: CoverMedia = {
            url: s.imageUrl,
            alt: s.subtitle,
            isPlaceholder: s.imageUrl.startsWith('placeholder://') || s.imageUrl.startsWith('placeholder-'),
            placeholderId: s.imageUrl.startsWith('placeholder://') ? s.imageUrl.split('/').pop() : s.imageUrl,
            placeholderStatus: 'pending'
          };
          const wasUpdated = updated;
          updated = false;
          updateMedia(tempMedia);
          if (updated) {
            s.imageUrl = tempMedia.url;
          }
          updated = wasUpdated || updated;
        }
      });
    }

    if (updated) {
      currentArticles[targetId] = article;
      setArticles(currentArticles);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentArticles));
    }
  };

  const handleDeleteMedia = async (id: string) => {
    if (confirm('確定要從素材庫永久刪除此媒體檔案嗎？')) {
      const newList = globalMedia.filter(m => m.id !== id);
      saveGlobalMedia(newList);
      await deleteMediaBlob(id);
    }
  };

  const handleSyncMedia = (placeholderId: string) => {
    if (!activeArticleId) return;
    const currentArticles = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
    const article = currentArticles[activeArticleId] as Article;
    if (!article || !article.html) return;

    // Call updateMedia to replace specific placeholder in HTML
    const updatedHtml = updateMedia(article.html, placeholderId);

    // Also if it's one of the cover images or video in meta, let's make sure it is resolved in metadata too
    const savedMedia = JSON.parse(localStorage.getItem('class11_global_media') || '[]');
    const mediaItem = savedMedia.find((m: any) => m.placeholderId === placeholderId || m.id === placeholderId);
    
    if (mediaItem && !mediaItem.isPlaceholder && mediaItem.url) {
      const finalMedia: CoverMedia = {
        url: mediaItem.url,
        alt: mediaItem.alt || '',
        isPlaceholder: false,
        placeholderId: placeholderId,
        type: mediaItem.type,
        promptParams: mediaItem.promptParams
      };

      if (article.covers.square.placeholderId === placeholderId) {
        article.covers.square = finalMedia;
      } else if (article.covers.landscape.placeholderId === placeholderId) {
        article.covers.landscape = finalMedia;
      } else if (article.covers.portrait.placeholderId === placeholderId) {
        article.covers.portrait = finalMedia;
      } else if (article.video?.placeholderId === placeholderId) {
        article.video = finalMedia;
      } else {
        const photoIdx = article.photos.findIndex(p => p.placeholderId === placeholderId);
        if (photoIdx !== -1) {
          article.photos[photoIdx] = finalMedia;
        }
      }
    }

    article.html = updatedHtml;
    article.updatedAt = new Date().toISOString();
    currentArticles[activeArticleId] = article;

    setArticles(currentArticles);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentArticles));
  };

  // Export methods
  const handlePrintPDF = () => {
    window.print();
  };

  const handleExportMarkdown = () => {
    if (!activeArticle) return;
    const coverText = `# ${activeArticle.title}\n## ${activeArticle.subtitle}\n\n` + 
      (activeArticle.covers.landscape.url ? `![封面 16:9](${activeArticle.covers.landscape.url})\n` : '') +
      `*Alt: ${activeArticle.covers.landscape.alt}*\n\n`;

    const blob = new Blob([coverText + activeArticle.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeArticle.title}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportHTML = (withTitle: boolean) => {
    if (!activeArticle) return;
    
    // Get raw HTML code
    let htmlText = activeArticle.html || getDefaultHtml(activeArticle, activeCoverRatio);

    // Map local blob URLs to absolute website media URLs
    const savedMedia = JSON.parse(localStorage.getItem('class11_global_media') || '[]');
    savedMedia.forEach((item: any) => {
      if (item.url && item.url.startsWith('blob:') && (item.placeholderId || item.id)) {
        const taskId = item.placeholderId || item.id;
        const websiteMediaUrl = `${window.location.origin}/media/${taskId}`;
        htmlText = htmlText.replaceAll(item.url, websiteMediaUrl);
      }
    });

    let htmlContent = '';

    if (withTitle) {
      let coverUrl = activeArticle.covers.landscape.url || '';
      savedMedia.forEach((item: any) => {
        if (item.url && item.url === coverUrl && (item.placeholderId || item.id)) {
          coverUrl = `${window.location.origin}/media/${item.placeholderId || item.id}`;
        }
      });

      htmlContent = `
        <header style="margin-bottom: 2rem; font-family: sans-serif;">
          ${coverUrl ? `<img src="${coverUrl}" alt="${activeArticle.covers.landscape.alt}" style="width:105%; max-height:400px; object-fit: cover; border-radius: 8px;" />` : ''}
          <h1 style="font-size: 2.5rem; margin-top: 1rem; color: #1a1a2e;">${activeArticle.title}</h1>
          <h2 style="font-size: 1.5rem; color: #4a5568; font-weight: normal; margin-top: 0.5rem;">${activeArticle.subtitle}</h2>
        </header>
      `;
    }

    htmlContent += `
      <article style="font-family: sans-serif; line-height: 1.6; color: #2d3748;">
        ${htmlText}
      </article>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeArticle.title}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyClipboard = () => {
    if (!activeArticle) return;
    const text = activeArticle.html || getDefaultHtml(activeArticle, activeCoverRatio);
    
    navigator.clipboard.writeText(text).then(() => {
      alert('已成功複製 HTML 程式碼！');
    });
  };

  const filteredArticles = Object.values(articles).filter(art => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      art.title.toLowerCase().includes(q) ||
      art.subtitle.toLowerCase().includes(q) ||
      (art.meta?.topic || '').toLowerCase().includes(q)
    );
  });

  if (!isInitialized) return <div className="p-8 text-center text-slate-400">載入中...</div>;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-800 antialiased relative print:bg-white print:h-auto">
      
      {!activeArticleId ? (
        // ================= ARTICLE LIST VIEW =================
        <div className="flex-1 flex flex-col min-w-0 bg-slate-50 overflow-y-auto p-6 md:p-10 select-none">
          <div className="max-w-6xl mx-auto w-full space-y-6">
            
            {/* Header section of list */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600 text-3xl">folder_open</span>
                  報導文章清單
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  瀏覽與管理您的所有圖文報導專案，或建立新專案以啟動 AI 協作。
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Search Bar */}
                <div className="relative w-64 md:w-80">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                    search
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜尋文章標題、副標題或主題..."
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 hover:border-slate-400 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 placeholder-slate-400 shadow-sm transition-colors"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-655"
                    >
                      <span className="material-symbols-outlined text-sm">cancel</span>
                    </button>
                  )}
                </div>

                {/* Add Article Button */}
                <button
                  onClick={handleCreateArticle}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
                >
                  <span className="material-symbols-outlined text-sm font-bold">add</span>
                  新增報導文章
                </button>
              </div>
            </div>

            {/* Grid display */}
            {filteredArticles.length === 0 ? (
              // Empty search or empty list
              searchQuery ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-sm flex flex-col items-center justify-center">
                  <span className="material-symbols-outlined text-slate-400 text-5xl mb-3">search_off</span>
                  <p className="text-sm font-bold text-slate-800">找不到符合的文章</p>
                  <p className="text-xs text-slate-400 mt-1">請嘗試輸入其他關鍵字或清除搜尋條件。</p>
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                  >
                    清除搜尋條件
                  </button>
                </div>
              ) : (
                // SOP Empty State
                <div className="bg-white border border-slate-200 rounded-2xl p-10 max-w-2xl mx-auto text-center shadow-sm flex flex-col items-center justify-center">
                  <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                    <span className="material-symbols-outlined text-3xl">auto_stories</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-800 mb-2">目前沒有任何報導文章</h3>
                  <p className="text-xs text-slate-500 leading-relaxed mb-6 max-w-sm">
                    您可以點擊上方「新增報導文章」按鈕開始，或是直接對右側 Agent 提出寫作需求，讓 Agent 自動為您開闢新文章。
                  </p>
                  <div className="w-full bg-slate-50 border border-slate-150 rounded-xl p-4.5 text-left">
                    <span className="text-xs font-bold text-slate-700 block mb-2.5 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-blue-600">chat_bubble</span>
                      您可以直接對 Agent 說：
                    </span>
                    <div className="space-y-2 text-xs text-slate-600 font-medium">
                      <div className="bg-white p-2.5 rounded-lg border border-slate-100 flex items-start gap-1.5 hover:bg-slate-100/50 transition-colors">
                        <span className="text-slate-400 font-bold">1.</span>
                        <span>「幫我新增一篇關於『台灣綠能發展』的報導文章，關鍵字包含太陽能、風力發電。」</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-slate-100 flex items-start gap-1.5 hover:bg-slate-100/50 transition-colors">
                        <span className="text-slate-400 font-bold">2.</span>
                        <span>「我想寫一篇介紹『2026年熱門AI工具』的專題，幫我開新文章並進行主題研究。」</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {filteredArticles.map((art) => {
                  const cover = art.covers.landscape.url || art.covers.square.url || art.covers.portrait.url;
                  return (
                    <div
                      key={art.id}
                      onClick={() => handleSelectArticle(art.id)}
                      className="group bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col relative h-[310px]"
                    >
                      {/* Cover Thumbnail / Placeholder */}
                      <div className="aspect-video w-full bg-slate-100 border-b border-slate-100 overflow-hidden relative flex items-center justify-center">
                        {cover ? (
                          <img src={cover} alt={art.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex flex-col items-center justify-center p-3 text-center">
                            <span className="material-symbols-outlined text-slate-450 text-3xl mb-1 group-hover:scale-110 transition-transform">
                              image
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{art.meta?.topic || '未分類報導'}</span>
                          </div>
                        )}
                        {art.meta?.topic && (
                          <span className="absolute left-2.5 top-2.5 bg-slate-900/70 text-white text-[9px] px-2 py-0.5 rounded-full font-bold select-none backdrop-blur-sm">
                            {art.meta.topic}
                          </span>
                        )}
                        
                        {/* Hover Delete Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteArticle(art.id);
                          }}
                          className="absolute right-2.5 top-2.5 p-1.5 bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg shadow border border-slate-100 opacity-0 group-hover:opacity-100 transition-all z-10"
                          title="刪除報導"
                        >
                          <span className="material-symbols-outlined text-sm font-bold">delete</span>
                        </button>
                      </div>

                      {/* Info body */}
                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div className="space-y-1">
                          <h3 className="text-xs font-bold text-slate-800 line-clamp-2 group-hover:text-blue-600 transition-colors">
                            {art.title || '無標題文章'}
                          </h3>
                          <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed">
                            {art.subtitle || '點選以編輯此報導的副標題與內容'}
                          </p>
                        </div>
                        
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-1 text-[9px] text-slate-455">
                            <span className="material-symbols-outlined text-[12px]">schedule</span>
                            <span>{new Date(art.updatedAt).toLocaleDateString()}</span>
                          </div>
                          <span className="text-[9px] text-blue-600 font-bold hover:underline flex items-center gap-0.5">
                            開始編輯
                            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        // ================= ARTICLE EDIT WORKSPACE VIEW =================
        <div className="flex-1 flex flex-col min-w-0 bg-slate-50 overflow-hidden relative">
          
          {/* Header Bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shadow-sm flex-shrink-0 print:hidden relative z-25">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => {
                  setActiveArticleId('');
                  localStorage.removeItem(ACTIVE_ARTICLE_ID_KEY);
                }}
                className="flex items-center gap-1 text-slate-500 hover:text-slate-900 text-xs font-bold px-2 py-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                title="返回文章清單"
              >
                <span className="material-symbols-outlined text-sm font-bold">arrow_back</span>
                <span>返回列表</span>
              </button>
              <div className="h-4 w-[1px] bg-slate-250"></div>
              <h2 className="font-extrabold text-slate-800 text-sm truncate max-w-[200px] md:max-w-md">
                {activeArticle.title}
              </h2>
            </div>
            
            <div className="flex items-center gap-2 relative">
              {/* Dropdown Options trigger */}
              <div className="relative">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow"
                >
                  <span className="material-symbols-outlined text-sm">settings</span>
                  操作與選取
                  <span className="material-symbols-outlined text-xs">
                    {isDropdownOpen ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
                  </span>
                </button>
                
                {isDropdownOpen && (
                  <>
                    {/* Backdrop cover for click-away */}
                    <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)}></div>
                    
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-20 text-xs text-slate-700 font-medium">
                      <button
                        onClick={() => {
                          setIsMediaLibraryOpen(true);
                          setIsDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-sm text-slate-500">photo_library</span>
                        媒體素材庫
                      </button>
                      <button
                        onClick={() => {
                          setIsQueueOpen(true);
                          setIsDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-sm text-slate-500">queue</span>
                        任務佇列
                      </button>
                      <button
                        onClick={() => {
                          setIsVideoProjectEditorOpen(true);
                          setIsDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-blue-600 font-bold"
                      >
                        <span className="material-symbols-outlined text-sm text-blue-500">movie_edit</span>
                        影片專案編輯器
                      </button>
                      <div className="border-t border-slate-100 my-1.5"></div>
                      <button 
                        onClick={() => {
                          handlePrintPDF();
                          setIsDropdownOpen(false);
                        }} 
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-sm text-slate-500">picture_as_pdf</span>
                        列印 PDF
                      </button>
                      <button 
                        onClick={() => {
                          handleExportMarkdown();
                          setIsDropdownOpen(false);
                        }} 
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-sm text-slate-500">markdown</span>
                        匯出 Markdown
                      </button>
                      <button 
                        onClick={() => {
                          handleExportHTML(true);
                          setIsDropdownOpen(false);
                        }} 
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-sm text-slate-500">html</span>
                        匯出 HTML (含標題)
                      </button>
                      <button 
                        onClick={() => {
                          handleExportHTML(false);
                          setIsDropdownOpen(false);
                        }} 
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-sm text-slate-500">code</span>
                        匯出 HTML (不含標題)
                      </button>
                      <div className="border-t border-slate-150 my-1.5"></div>
                      <button 
                        onClick={() => {
                          handleCopyClipboard();
                          setIsDropdownOpen(false);
                        }} 
                        className="w-full text-left px-4 py-2 hover:bg-blue-50 hover:text-blue-700 text-blue-600 flex items-center gap-2 font-semibold"
                      >
                        <span className="material-symbols-outlined text-sm">content_copy</span>
                        複製視覺 HTML
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Tabs switch bar */}
          <div className="flex bg-white border-b border-slate-200 px-6 print:hidden">
            <button
              onClick={() => setActiveTab('meta')}
              className={`py-3 px-4 border-b-2 text-xs font-bold transition-colors flex items-center gap-1.5 ${
                activeTab === 'meta' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="material-symbols-outlined text-base">settings_applications</span>
              Meta Editor
            </button>
            <button
              onClick={() => setActiveTab('content')}
              className={`py-3 px-4 border-b-2 text-xs font-bold transition-colors flex items-center gap-1.5 ${
                activeTab === 'content' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="material-symbols-outlined text-base">edit_note</span>
              Content Editor
            </button>
            <button
              onClick={() => setActiveTab('html')}
              className={`py-3 px-4 border-b-2 text-xs font-bold transition-colors flex items-center gap-1.5 ${
                activeTab === 'html' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="material-symbols-outlined text-base">html</span>
              HTML Editor
            </button>
          </div>

          {/* Active Tab Workspace Canvas */}
          <div className="flex-1 overflow-y-auto p-6 relative">
            
            {isLocked && (
              <div className="w-full mb-4 bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs text-amber-800 flex items-center justify-between gap-2 rounded-xl select-none z-20 animate-pulse">
                <span className="flex items-center gap-1.5 font-semibold">
                  <span className="material-symbols-outlined text-sm animate-spin text-amber-600">sync</span>
                  AI 正在寫作此文章中，編輯已暫時鎖定以避免內容衝突...
                </span>
                <span className="text-[10px] text-amber-500 font-bold">鎖定中</span>
              </div>
            )}

            <div className="w-full">
              
              {/* META EDITOR TAB */}
              {activeTab === 'meta' && (
                <div className="space-y-6 w-full pb-8">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2 mb-4">
                      <span className="material-symbols-outlined text-blue-600">info</span>
                      基本資料與寫作指引
                    </h3>
                    <div className="space-y-5 w-full">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500">主標題</label>
                        <input
                          type="text"
                          value={activeArticle.title}
                          onChange={(e) => updateActiveDoc({ title: e.target.value })}
                          disabled={isLocked}
                          className="w-full text-xs font-semibold p-3 border border-slate-300 hover:border-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl focus:outline-none transition-colors shadow-sm disabled:bg-slate-50 disabled:text-slate-400"
                          placeholder="輸入主標題..."
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500">副標題</label>
                        <input
                          type="text"
                          value={activeArticle.subtitle}
                          onChange={(e) => updateActiveDoc({ subtitle: e.target.value })}
                          disabled={isLocked}
                          className="w-full text-xs font-semibold p-3 border border-slate-300 hover:border-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl focus:outline-none transition-colors shadow-sm disabled:bg-slate-50 disabled:text-slate-400"
                          placeholder="輸入副標題..."
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500">報導主題/議題分類</label>
                        <input
                          type="text"
                          value={activeArticle.meta.topic}
                          onChange={(e) => updateActiveDoc({ meta: { ...activeArticle.meta, topic: e.target.value } })}
                          disabled={isLocked}
                          className="w-full text-xs font-semibold p-3 border border-slate-300 hover:border-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl focus:outline-none transition-colors shadow-sm disabled:bg-slate-50 disabled:text-slate-400"
                          placeholder="例如：科技趨勢、綠色能源..."
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500">關鍵字 (以英文逗號區隔)</label>
                        <input
                          type="text"
                          value={activeArticle.meta.keywords.join(', ')}
                          onChange={(e) => updateActiveDoc({ meta: { ...activeArticle.meta, keywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } })}
                          disabled={isLocked}
                          className="w-full text-xs font-semibold p-3 border border-slate-300 hover:border-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl focus:outline-none transition-colors shadow-sm disabled:bg-slate-50 disabled:text-slate-400"
                          placeholder="例如：AI, 大語言模型, Gemini..."
                        />
                      </div>
                      <div className="space-y-1.5 w-full">
                        <label className="text-[11px] font-bold text-slate-500">議題設定指引 (Topic Guideline)</label>
                        <textarea
                          value={activeArticle.meta.topicGuideline}
                          onChange={(e) => updateActiveDoc({ meta: { ...activeArticle.meta, topicGuideline: e.target.value } })}
                          disabled={isLocked}
                          className="w-full text-xs font-semibold p-3 border border-slate-300 hover:border-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl focus:outline-none transition-colors shadow-sm disabled:bg-slate-50 disabled:text-slate-400 min-h-[180px]"
                          placeholder="請輸入此文章寫作的主訴求、目標受眾或寫作立場指引..."
                        />
                      </div>
                      <div className="space-y-1.5 w-full">
                        <label className="text-[11px] font-bold text-slate-500">視覺風格指引 (Visual Style Guideline)</label>
                        <textarea
                          value={activeArticle.meta.visualStyleGuideline}
                          onChange={(e) => updateActiveDoc({ meta: { ...activeArticle.meta, visualStyleGuideline: e.target.value } })}
                          disabled={isLocked}
                          className="w-full text-xs font-semibold p-3 border border-slate-300 hover:border-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl focus:outline-none transition-colors shadow-sm disabled:bg-slate-50 disabled:text-slate-400 min-h-[180px]"
                          placeholder="請輸入本報導中所有插圖、封面與影片的配色、光影及美學風格設計（如：寫實照片、手繪插圖等）..."
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2 mb-4 pt-4">
                      <span className="material-symbols-outlined text-blue-600">imagesmode</span>
                      已生成之文章媒體素材
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      {/* Square Cover */}
                      <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 flex flex-col gap-2 shadow-sm">
                        <span className="text-[10px] font-bold text-slate-500">正方形封面 (1:1)</span>
                        <div className="aspect-square bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center text-xs text-slate-400 relative">
                          {activeArticle.covers.square.url ? (
                            (activeArticle.covers.square.url.startsWith('placeholder-') || activeArticle.covers.square.url.startsWith('placeholder://')) ? (
                              <div className="absolute inset-0 bg-slate-800 flex flex-col items-center justify-center p-2 text-center">
                                <span className="animate-spin text-sm text-orange-400 material-symbols-outlined">sync</span>
                                <span className="text-[9px] text-slate-400 mt-1">封面生成中...</span>
                              </div>
                            ) : (
                              <img src={activeArticle.covers.square.url} alt="Square cover" className="w-full h-full object-cover" />
                            )
                          ) : (
                            <span className="material-symbols-outlined text-slate-350 text-3xl">image</span>
                          )}
                        </div>
                        <div className="flex gap-1 mt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setMediaSelectionMode('image');
                              setOnSelectCallback(() => (item: GlobalMediaItem) => {
                                updateActiveDoc({ covers: { ...activeArticle.covers, square: { url: item.url, alt: item.alt } } });
                              });
                              setIsMediaLibraryOpen(true);
                            }}
                            className="flex-1 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded text-[10px] font-bold border border-blue-100 transition-colors"
                          >
                            從素材庫選擇
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const val = prompt('請輸入圖片網址或 Base64 URL：', activeArticle.covers.square.url);
                              if (val !== null) {
                                updateActiveDoc({ covers: { ...activeArticle.covers, square: { url: val.trim(), alt: activeArticle.covers.square.alt || 'Square cover' } } });
                              }
                            }}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold transition-colors"
                          >
                            網址
                          </button>
                          {activeArticle.covers.square.url && (
                            <button
                              type="button"
                              onClick={() => {
                                updateActiveDoc({ covers: { ...activeArticle.covers, square: { url: '', alt: '' } } });
                              }}
                              className="px-1.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded text-[10px] font-bold transition-colors"
                              title="清除"
                            >
                              清除
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {/* Landscape Cover */}
                      <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 flex flex-col gap-2 shadow-sm">
                        <span className="text-[10px] font-bold text-slate-500">橫式封面 (16:9)</span>
                        <div className="aspect-square bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center text-xs text-slate-400 relative">
                          {activeArticle.covers.landscape.url ? (
                            (activeArticle.covers.landscape.url.startsWith('placeholder-') || activeArticle.covers.landscape.url.startsWith('placeholder://')) ? (
                              <div className="absolute inset-0 bg-slate-800 flex flex-col items-center justify-center p-2 text-center">
                                <span className="animate-spin text-sm text-orange-400 material-symbols-outlined">sync</span>
                                <span className="text-[9px] text-slate-400 mt-1">封面生成中...</span>
                              </div>
                            ) : (
                              <img src={activeArticle.covers.landscape.url} alt="Landscape cover" className="w-full h-full object-cover" />
                            )
                          ) : (
                            <span className="material-symbols-outlined text-slate-355 text-3xl">image</span>
                          )}
                        </div>
                        <div className="flex gap-1 mt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setMediaSelectionMode('image');
                              setOnSelectCallback(() => (item: GlobalMediaItem) => {
                                updateActiveDoc({ covers: { ...activeArticle.covers, landscape: { url: item.url, alt: item.alt } } });
                              });
                              setIsMediaLibraryOpen(true);
                            }}
                            className="flex-1 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded text-[10px] font-bold border border-blue-100 transition-colors"
                          >
                            從素材庫選擇
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const val = prompt('請輸入圖片網址或 Base64 URL：', activeArticle.covers.landscape.url);
                              if (val !== null) {
                                updateActiveDoc({ covers: { ...activeArticle.covers, landscape: { url: val.trim(), alt: activeArticle.covers.landscape.alt || 'Landscape cover' } } });
                              }
                            }}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold transition-colors"
                          >
                            網址
                          </button>
                          {activeArticle.covers.landscape.url && (
                            <button
                              type="button"
                              onClick={() => {
                                updateActiveDoc({ covers: { ...activeArticle.covers, landscape: { url: '', alt: '' } } });
                              }}
                              className="px-1.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded text-[10px] font-bold transition-colors"
                              title="清除"
                            >
                              清除
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Portrait Cover */}
                      <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 flex flex-col gap-2 shadow-sm">
                        <span className="text-[10px] font-bold text-slate-500">直式封面 (9:16)</span>
                        <div className="aspect-square bg-slate-950 rounded-lg overflow-hidden flex items-center justify-center text-xs text-slate-400 relative">
                          {activeArticle.covers.portrait.url ? (
                            (activeArticle.covers.portrait.url.startsWith('placeholder-') || activeArticle.covers.portrait.url.startsWith('placeholder://')) ? (
                              <div className="absolute inset-0 bg-slate-800 flex flex-col items-center justify-center p-2 text-center">
                                <span className="animate-spin text-sm text-orange-400 material-symbols-outlined">sync</span>
                                <span className="text-[9px] text-slate-400 mt-1">封面生成中...</span>
                              </div>
                            ) : (
                              <img src={activeArticle.covers.portrait.url} alt="Portrait cover" className="w-full h-full object-cover" />
                            )
                          ) : (
                            <span className="material-symbols-outlined text-slate-355 text-3xl">image</span>
                          )}
                        </div>
                        <div className="flex gap-1 mt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setMediaSelectionMode('image');
                              setOnSelectCallback(() => (item: GlobalMediaItem) => {
                                updateActiveDoc({ covers: { ...activeArticle.covers, portrait: { url: item.url, alt: item.alt } } });
                              });
                              setIsMediaLibraryOpen(true);
                            }}
                            className="flex-1 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded text-[10px] font-bold border border-blue-100 transition-colors"
                          >
                            從素材庫選擇
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const val = prompt('請輸入圖片網址或 Base64 URL：', activeArticle.covers.portrait.url);
                              if (val !== null) {
                                updateActiveDoc({ covers: { ...activeArticle.covers, portrait: { url: val.trim(), alt: activeArticle.covers.portrait.alt || 'Portrait cover' } } });
                              }
                            }}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold transition-colors"
                          >
                            網址
                          </button>
                          {activeArticle.covers.portrait.url && (
                            <button
                              type="button"
                              onClick={() => {
                                updateActiveDoc({ covers: { ...activeArticle.covers, portrait: { url: '', alt: '' } } });
                              }}
                              className="px-1.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded text-[10px] font-bold transition-colors"
                              title="清除"
                            >
                              清除
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Video */}
                      <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 flex flex-col gap-2 shadow-sm">
                        <span className="text-[10px] font-bold text-slate-500">影音宣傳報導</span>
                        {((activeArticle.reportVideo && activeArticle.reportVideo.scenes && activeArticle.reportVideo.scenes.length > 0) || (activeArticle.video && activeArticle.video.sources && activeArticle.video.sources.length > 0)) ? (
                          <NewsReportPlayer 
                            reportVideo={activeArticle.reportVideo || {
                              scenes: activeArticle.video!.sources!.map((src, idx) => ({
                                sceneId: `scene_${idx + 1}`,
                                videoUrl: src,
                                subtitle: `分鏡 #${idx + 1} 新聞片段`,
                                narration: ''
                              }))
                            }} 
                            article={activeArticle} 
                          />
                        ) : (
                          <div className="aspect-square bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center text-xs text-slate-400 relative">
                            {activeArticle.video?.url ? (
                              (activeArticle.video?.url.startsWith('placeholder-') || activeArticle.video?.url.startsWith('placeholder://')) ? (
                                <div className="absolute inset-0 bg-slate-800 flex flex-col items-center justify-center p-2 text-center">
                                  <span className="animate-spin text-sm text-orange-400 material-symbols-outlined">sync</span>
                                  <span className="text-[9px] text-slate-400 mt-1">影片生成中...</span>
                                </div>
                              ) : (
                                <video src={activeArticle.video.url} controls className="w-full h-full object-cover" />
                              )
                            ) : (
                              <span className="material-symbols-outlined text-slate-355 text-3xl">videocam</span>
                            )}
                          </div>
                        )}
                        <div className="flex gap-1 mt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setMediaSelectionMode('video');
                              setOnSelectCallback(() => (item: GlobalMediaItem) => {
                                updateActiveDoc({ video: { url: item.url, alt: item.alt } });
                              });
                              setIsMediaLibraryOpen(true);
                            }}
                            className="flex-1 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded text-[10px] font-bold border border-blue-100 transition-colors"
                          >
                            從素材庫選擇
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const val = prompt('請輸入影片網址或 Base64 URL：', activeArticle.video?.url || '');
                              if (val !== null) {
                                updateActiveDoc({ video: { url: val.trim(), alt: activeArticle.video?.alt || 'Campaign video' } });
                              }
                            }}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold transition-colors"
                          >
                            網址
                          </button>
                          {activeArticle.video?.url && (
                            <button
                              type="button"
                              onClick={() => {
                                updateActiveDoc({ video: null });
                              }}
                              className="px-1.5 py-1 bg-red-50 hover:bg-red-100 text-red-605 rounded text-[10px] font-bold transition-colors"
                              title="清除"
                            >
                              清除
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* CONTENT EDITOR TAB */}
              {activeTab === 'content' && (
                <div className="space-y-4 w-full">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm">markdown</span>
                      Markdown 內文資料源
                    </span>
                    
                    <div className="bg-slate-100 p-0.5 rounded-lg flex items-center text-[10px] font-bold">
                      <button
                        onClick={() => setContentMode('edit')}
                        className={`px-3 py-1 rounded-md transition-all ${
                          contentMode === 'edit' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                        }`}
                      >
                        純文字編輯
                      </button>
                      <button
                        onClick={() => setContentMode('preview')}
                        className={`px-3 py-1 rounded-md transition-all ${
                          contentMode === 'preview' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-550'
                        }`}
                      >
                        渲染預覽
                      </button>
                    </div>
                  </div>

                  {contentMode === 'edit' && (
                    <div className="flex items-center gap-2 p-2 bg-slate-50 border-t border-x border-slate-300 rounded-t-xl -mb-4 relative z-10 select-none">
                      <button
                        type="button"
                        onClick={() => insertTextAtCursor('**粗體文字**')}
                        className="px-2.5 py-1.5 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold flex items-center gap-1 transition-colors"
                        title="粗體"
                      >
                        <span className="material-symbols-outlined text-sm font-bold">format_bold</span>
                        <span>粗體</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => insertTextAtCursor('*斜體文字*')}
                        className="px-2.5 py-1.5 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold flex items-center gap-1 transition-colors"
                        title="斜體"
                      >
                        <span className="material-symbols-outlined text-sm font-bold">format_italic</span>
                        <span>斜體</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const title = prompt('請輸入連結文字：', '連結');
                          const url = prompt('請輸入連結網址：', 'https://');
                          if (url !== null && url.trim()) {
                            insertTextAtCursor(`[${title || '連結'}](${url.trim()})`);
                          }
                        }}
                        className="px-2.5 py-1.5 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold flex items-center gap-1 transition-colors"
                        title="插入超連結"
                      >
                        <span className="material-symbols-outlined text-sm font-bold">link</span>
                        <span>連結</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMediaSelectionMode('image');
                          setOnSelectCallback(() => (item: GlobalMediaItem) => {
                            insertTextAtCursor(`![${item.alt || '圖片'}](${item.url})`);
                          });
                          setIsMediaLibraryOpen(true);
                        }}
                        className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded text-xs font-bold flex items-center gap-1.5 border border-blue-100 transition-colors shadow-sm"
                        title="從素材庫選擇圖片插入"
                      >
                        <span className="material-symbols-outlined text-sm font-bold">add_photo_alternate</span>
                        <span>插入圖片</span>
                      </button>
                    </div>
                  )}
                  {contentMode === 'edit' ? (
                    <textarea
                      ref={contentTextareaRef}
                      value={activeArticle.content}
                      onChange={(e) => {
                        const updatedContent = e.target.value;
                        updateActiveDoc({
                          content: updatedContent,
                          html: marked.parse(updatedContent) as string
                        });
                      }}
                      disabled={isLocked}
                      className="w-full p-5 font-mono text-xs bg-white border border-slate-300 hover:border-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-b-xl rounded-t-none focus:outline-none transition-colors shadow-sm min-h-[65vh] leading-relaxed"
                      placeholder="在此輸入 Markdown 內文..."
                    />
                  ) : (
                    <div 
                      className="prose prose-slate max-w-none text-xs leading-relaxed p-6 border border-slate-200 rounded-xl bg-white shadow-sm min-h-[65vh]"
                      dangerouslySetInnerHTML={{ __html: marked.parse(activeArticle.content || '*(無內文)*') }}
                    />
                  )}
                </div>
              )}

              {/* HTML EDITOR TAB */}
              {activeTab === 'html' && (
                <div className="space-y-4">
                  {/* HTML Toolbar controls */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm print:hidden">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => {
                          const el = (document.getElementById('chat-input') || document.querySelector('textarea[placeholder*="AI Assistant"]') || document.querySelector('textarea[placeholder*="Message AI"]')) as HTMLTextAreaElement;
                          if (el) {
                            el.value = `請根據我文章的主題「${activeArticle.title}」，以及現有的 Content 與視覺指引，為我設計並生成最專業的 RWD 圖文視覺排版網頁 HTML 代碼。`;
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            el.focus();
                            setUiState({ isOpened: true });
                          }
                        }}
                        className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-150 rounded-xl text-xs font-bold transition-all shadow-sm"
                      >
                        <span className="material-symbols-outlined text-sm font-bold animate-pulse">auto_awesome</span>
                        由內容重新生成視覺 HTML
                      </button>
                      
                      <button
                        onClick={() => {
                          const originalHtml = activeArticle.html || getDefaultHtml(activeArticle, activeCoverRatio);
                          let updatedHtml = applyMetaToHtml(originalHtml, activeArticle, activeCoverRatio);
                          updatedHtml = updateMedia(updatedHtml);
                          updateActiveDoc({ html: updatedHtml });
                          alert('已成功在不破壞版面結構的前提下，重新套用最新的主標題、副標題、封面圖、插圖與宣傳影片等 META 資訊！');
                        }}
                        className="flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-sm"
                        title="在保留自訂視覺編排的前提下，更新網頁中引用的標題、封面插圖或影片網址"
                      >
                        <span className="material-symbols-outlined text-sm font-bold text-slate-500">sync_alt</span>
                        重新套用 META 資訊
                      </button>
                    </div>
                    
                    <div className="flex items-center gap-2 self-center sm:self-auto">
                      <div className="bg-slate-100 p-0.5 rounded-lg flex items-center text-[10px] font-bold">
                        <button
                          onClick={() => setHtmlMode('preview')}
                          className={`px-4 py-1.5 rounded-md transition-all ${
                            htmlMode === 'preview' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                          }`}
                        >
                          視覺預覽
                        </button>
                        <button
                          onClick={() => setHtmlMode('code')}
                          className={`px-4 py-1.5 rounded-md transition-all ${
                            htmlMode === 'code' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                          }`}
                        >
                          原始碼編輯
                        </button>
                      </div>

                      {htmlMode === 'preview' && (
                        <button
                          onClick={() => setIsFullscreenPreview(true)}
                          className="flex items-center justify-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-all border border-slate-200"
                          title="開啟全螢幕無邊框預覽"
                        >
                          <span className="material-symbols-outlined text-xs">fullscreen</span>
                          全螢幕預覽
                        </button>
                      )}
                    </div>
                  </div>

                  {/* HTML Body view */}
                  <div className="w-full flex flex-col justify-between relative min-h-[75vh]">
                    {htmlMode === 'preview' ? (
                      <div className="w-full h-[75vh] min-h-[550px] rounded-xl overflow-hidden bg-white border border-slate-200 shadow-sm relative">
                        <iframe
                          ref={iframeRef}
                          onLoad={handleIframeLoad}
                          srcDoc={injectPreviewStyles(activeArticle.html || getDefaultHtml(activeArticle, activeCoverRatio))}
                          className="w-full h-full border-none"
                          title="Article Preview"
                          sandbox="allow-scripts allow-popups allow-same-origin"
                        />
                      </div>
                    ) : (
                      <div className="flex-grow flex flex-col gap-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                          <span className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm text-blue-600">code</span>
                            直接修改 HTML / CSS 原始碼
                          </span>
                          <span className="text-[10px] text-slate-400">標準 RWD 規格</span>
                        </div>
                        <textarea
                          value={activeArticle.html || getDefaultHtml(activeArticle, activeCoverRatio)}
                          onChange={(e) => updateActiveDoc({ html: e.target.value })}
                          disabled={isLocked}
                          className="w-full p-5 font-mono text-xs bg-slate-900 text-slate-100 border border-slate-800 rounded-xl focus:outline-none min-h-[75vh] leading-relaxed shadow-inner"
                          placeholder="<!-- 請在此輸入視覺網頁原始碼 -->"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Selection AI prompt helper */}
      {selectedText && selectionCoords && (
        <button
          onClick={handleRegenerateBlock}
          style={{
            position: 'absolute',
            top: `${selectionCoords.top}px`,
            left: `${selectionCoords.left}px`,
            transform: 'translate(-50%, 8px)',
          }}
          className="z-50 bg-slate-955 text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow-2xl hover:bg-blue-600 transition-colors flex items-center gap-1.5 whitespace-nowrap animate-fade-in border border-slate-805"
        >
          <span className="material-symbols-outlined text-xs text-orange-400 font-bold animate-pulse">auto_awesome</span>
          請 AI 重寫此選取段落
        </button>
      )}

      {/* Modals */}
      <MediaLibrary
        mediaList={globalMedia}
        onDeleteMedia={handleDeleteMedia}
        onSyncMedia={handleSyncMedia}
        isOpen={isMediaLibraryOpen}
        onClose={() => {
          setIsMediaLibraryOpen(false);
          setMediaSelectionMode(null);
          setOnSelectCallback(null);
        }}
        onOpenImageGen={() => {
          setIsImageGenOpen(true);
        }}
        onOpenVideoGen={() => {
          setIsSingleVideoGenOpen(true);
        }}
        onRecreateImage={(params) => {
          setRecreateImageParams(params);
          setIsImageGenOpen(true);
        }}
        onRecreateVideo={(params) => {
          setRecreateVideoParams(params);
          setIsSingleVideoGenOpen(true);
        }}
        selectionMode={mediaSelectionMode}
        onSelectMedia={(item) => {
          if (onSelectCallback) {
            onSelectCallback(item);
          }
        }}
      />

      <ImageGenerator
        isOpen={isImageGenOpen}
        onClose={() => {
          setIsImageGenOpen(false);
          setRecreateImageParams(null);
        }}
        onEnqueueImage={(params) => {
          enqueueImage({ ...params, targetField: 'photo_list' });
        }}
        initialParams={recreateImageParams}
      />

      <SingleVideoGenerator
        isOpen={isSingleVideoGenOpen}
        onClose={() => {
          setIsSingleVideoGenOpen(false);
          setRecreateVideoParams(null);
        }}
        onEnqueueVideo={(params) => {
          enqueueVideo({ ...params, targetField: 'video' });
        }}
        initialParams={recreateVideoParams}
      />

      <VideoProjectEditor
        isOpen={isVideoProjectEditorOpen}
        onClose={() => {
          setIsVideoProjectEditorOpen(false);
        }}
        onEnqueueVideo={(params) => {
          enqueueVideo(params);
        }}
        onEnqueueImage={(params) => {
          enqueueImage(params as any);
        }}
        apiKey={settings?.apiKey || ''}
        queue={queue}
        onOpenMediaLibrary={handleOpenMediaLibraryForProject}
      />

      <QueuePanel
        queue={queue}
        onCancelTask={handleCancelTask}
        onRetryTask={handleRetryTask}
        isOpen={isQueueOpen}
        onToggle={() => setIsQueueOpen(!isQueueOpen)}
      />

      {/* Fullscreen Preview Modal */}
      {isFullscreenPreview && activeArticle && (
        <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col select-none">
          <div className="bg-slate-800 text-slate-100 px-6 py-3 flex items-center justify-between border-b border-slate-700 shadow-md">
            <span className="text-xs font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-400">fullscreen</span>
              全螢幕預覽 - {activeArticle.title}
            </span>
            <button
              onClick={() => setIsFullscreenPreview(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-650 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow transition-colors"
            >
              <span className="material-symbols-outlined text-xs">close</span>
              關閉預覽
            </button>
          </div>
          <div className="flex-1 w-full bg-white relative">
            <iframe
              srcDoc={updateMedia(activeArticle.html || getDefaultHtml(activeArticle, activeCoverRatio))}
              className="w-full h-full border-none"
              title="Fullscreen Article Preview"
              sandbox="allow-scripts allow-popups allow-same-origin"
            />
          </div>
        </div>
      )}
    </div>
  );
  // Helper to update active document details locally
  function updateActiveDoc(updater: Partial<Article>) {
    if (!activeArticleId) return;
    const current = { ...articles };
    const docToUpdate = current[activeArticleId];
    if (docToUpdate) {
      let updatedDoc = {
        ...docToUpdate,
        ...updater,
        updatedAt: new Date().toISOString()
      };

      // Unidirectional flow: Meta -> HTML
      if (
        updater.title !== undefined ||
        updater.subtitle !== undefined ||
        updater.covers !== undefined ||
        updater.video !== undefined
      ) {
        if (updatedDoc.html) {
          updatedDoc.html = applyMetaToHtml(updatedDoc.html, updatedDoc, activeCoverRatio);
          updatedDoc.html = updateMedia(updatedDoc.html);
        }
      }

      current[activeArticleId] = updatedDoc;
      setArticles(current);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current));
    }
  }
};
