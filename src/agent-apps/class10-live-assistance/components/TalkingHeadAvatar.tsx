import React, { useEffect, useRef, useState } from 'react';
import { TalkingHead } from '@met4citizen/talkinghead';
import { LipsyncEn } from '@met4citizen/talkinghead/modules/lipsync-en.mjs';

export type GazeTarget = 'user' | 'screen' | 'chat' | 'main';

export interface TalkingHeadAvatarProps {
  /** GLB Avatar model URL (Ready Player Me compatible) */
  modelUrl?: string;
  /** Controls if the avatar is currently speaking */
  speaking?: boolean;
  /** Text to synthesize/speak or simulate lip-sync for */
  textToSpeak?: string;
  /** Realtime voice transcript alias */
  liveTranscript?: string;
  /** Avatar emotion/mood */
  mood?: 'happy' | 'neutral' | 'thinking' | 'sad' | 'surprised';
  /** Spatial gaze target direction */
  gazeTarget?: GazeTarget;
  /** Smooth transition time in milliseconds for gaze and gestures */
  transitionMs?: number;
  /** Camera framing */
  cameraView?: 'head' | 'upper' | 'full';
  /** Custom container width */
  width?: string | number;
  /** Custom container height */
  height?: string | number;
  /** Callback when model finishes loading */
  onLoaded?: () => void;
  /** Callback on error */
  onError?: (err: unknown) => void;
}

const DEFAULT_RPM_AVATAR = new URL('../assets/avatars/avaturn.glb', import.meta.url).href;

// In-Memory GLB Asset Cache for instant local loading without network lag
const modelBlobCache = new Map<string, string>();

async function fetchModelBlobUrl(url: string): Promise<string> {
  if (modelBlobCache.has(url)) {
    return modelBlobCache.get(url)!;
  }
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    modelBlobCache.set(url, blobUrl);
    return blobUrl;
  } catch (e) {
    console.warn('Failed to pre-fetch avatar GLB blob, fallback to original URL', e);
    return url;
  }
}

interface SingletonAvatar {
  head: any;
  domElement: HTMLDivElement;
  modelUrl: string;
  isLoaded: boolean;
  loadError: string | null;
}

let cachedAvatar: SingletonAvatar | null = null;

export const TalkingHeadAvatar: React.FC<TalkingHeadAvatarProps> = ({
  modelUrl = DEFAULT_RPM_AVATAR,
  speaking = false,
  textToSpeak,
  liveTranscript,
  mood = 'neutral',
  gazeTarget = 'user',
  transitionMs = 800,
  cameraView = 'head',
  width = '100%',
  height = '100%',
  onLoaded,
  onError
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<any>(null);
  const [loading, setLoading] = useState(!cachedAvatar || cachedAvatar.modelUrl !== modelUrl || !cachedAvatar.isLoaded);
  const [loadError, setLoadError] = useState<string | null>(cachedAvatar?.modelUrl === modelUrl ? cachedAvatar.loadError : null);

  const activeText = textToSpeak || liveTranscript;

  // Initialize or re-attach Singleton TalkingHead instance
  useEffect(() => {
    if (!containerRef.current) return;
    let isMounted = true;

    // Check if cached DOM element is still connected to a valid document window
    const isValidDomNode = cachedAvatar?.domElement && cachedAvatar.domElement.ownerDocument.defaultView !== null;

    if (cachedAvatar && !isValidDomNode) {
      // Discard stale instance from closed PiP window
      try {
        cachedAvatar.head.stop?.();
      } catch {}
      cachedAvatar = null;
    }

    // Case 1: Re-use existing valid cached avatar within the same Window context
    if (cachedAvatar && cachedAvatar.modelUrl === modelUrl) {
      headRef.current = cachedAvatar.head;

      if (cachedAvatar.domElement.parentNode !== containerRef.current) {
        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(cachedAvatar.domElement);
      }

      if (cachedAvatar.isLoaded) {
        setLoading(false);
        setLoadError(null);
        try {
          if (typeof (cachedAvatar.head as any).setView === 'function') (cachedAvatar.head as any).setView(cameraView);
          if (typeof (cachedAvatar.head as any).setMood === 'function') (cachedAvatar.head as any).setMood(mood);
        } catch {
          // ignore setView errors
        }
        onLoaded?.();
      } else if (cachedAvatar.loadError) {
        setLoading(false);
        setLoadError(cachedAvatar.loadError);
      }

      return () => {
        isMounted = false;
        if (cachedAvatar?.domElement.parentNode === containerRef.current) {
          containerRef.current?.removeChild(cachedAvatar.domElement);
        }
      };
    }

    // Case 2: Clean load from local in-memory GLB blob cache
    setLoading(true);
    setLoadError(null);

    if (cachedAvatar && cachedAvatar.modelUrl !== modelUrl) {
      try {
        cachedAvatar.head.stop?.();
        cachedAvatar.domElement.remove();
      } catch {}
      cachedAvatar = null;
    }

    const domElement = document.createElement('div');
    domElement.style.width = '100%';
    domElement.style.height = '100%';

    let head: any = null;

    fetchModelBlobUrl(modelUrl).then(effectiveUrl => {
      if (!isMounted) return;

      try {
        head = new TalkingHead(domElement, {
          cameraView,
          lipsyncModules: [],
          cameraDistance: 0.32,
          cameraX: 0,
          cameraY: 0,
          cameraRotateX: 0,
          cameraRotateY: 0,
          avatarIdleEyeContact: 0.1,
          avatarIdleHeadMove: 0.1
        });

        try {
          const lipsyncProcessor = new LipsyncEn();
          head.lipsync = {
            en: lipsyncProcessor,
            zh: lipsyncProcessor
          };
        } catch (e) {
          console.warn('Failed to pre-assign LipsyncEn processor', e);
        }

        headRef.current = head;
        cachedAvatar = {
          head,
          domElement,
          modelUrl,
          isLoaded: false,
          loadError: null
        };

        if (containerRef.current) {
          containerRef.current.innerHTML = '';
          containerRef.current.appendChild(domElement);
        }

        head.showAvatar(
          {
            url: effectiveUrl,
            body: 'M',
            avatarMood: mood,
            lipsyncLang: 'en'
          },
          () => {}
        )
        .then(() => {
          if (!cachedAvatar || cachedAvatar.modelUrl !== modelUrl) return;
          cachedAvatar.isLoaded = true;
          if (isMounted) {
            setLoading(false);
            try {
              if (typeof (head as any).setView === 'function') (head as any).setView(cameraView);
            } catch {}
            onLoaded?.();
          }
        })
        .catch((err: any) => {
          const msg = err instanceof Error ? err.message : String(err);
          if (cachedAvatar && cachedAvatar.modelUrl === modelUrl) {
            cachedAvatar.loadError = msg;
          }
          if (isMounted) {
            console.error('TalkingHead avatar load error', err);
            setLoadError(msg);
            setLoading(false);
            onError?.(err);
          }
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (isMounted) {
          console.error('TalkingHead initialization error', err);
          setLoadError(msg);
          setLoading(false);
          onError?.(err);
        }
      }
    });

    return () => {
      isMounted = false;
      try {
        if (headRef.current) {
          headRef.current.stop?.();
        }
      } catch {}
      cachedAvatar = null;
      if (domElement.parentNode === containerRef.current) {
        containerRef.current?.removeChild(domElement);
      }
    };
  }, [modelUrl]);

  // Dynamically update camera view when cameraView prop changes
  useEffect(() => {
    if (headRef.current && !loading && !loadError) {
      try {
        if (headRef.current.setView) {
          headRef.current.setView(cameraView);
        }
      } catch (e) {
        console.warn('Failed to update avatar camera view', e);
      }
    }
  }, [cameraView, loading, loadError]);

  // Dynamically update gaze target direction smoothly
  useEffect(() => {
    const head = headRef.current;
    if (!head || loading || loadError) return;

    const ms = transitionMs ?? 800;

    try {
      switch (gazeTarget) {
        case 'user':
          if (typeof head.lookAtCamera === 'function') head.lookAtCamera(ms);
          break;
        case 'screen':
          if (typeof head.lookAt === 'function') head.lookAt(0.8, 0.5, ms);
          break;
        case 'chat':
          if (typeof head.lookAt === 'function') head.lookAt(0.9, 0.5, ms);
          break;
        case 'main':
          if (typeof head.lookAt === 'function') head.lookAt(0.1, 0.5, ms);
          break;
        default:
          if (typeof head.lookAtCamera === 'function') head.lookAtCamera(ms);
          break;
      }
    } catch (e) {
      console.warn('Failed to update avatar gaze target', e);
    }
  }, [gazeTarget, transitionMs, loading, loadError]);

/**
 * Mapping table from Chinese characters and English phonemes to Oculus Visemes & Jaw Opening
 */
interface PhonemeConfig {
  viseme: string;
  jaw: number;
  weight: number;
}

const PHONEME_DICTIONARY: Record<string, PhonemeConfig> = {
  // Chinese Vowels & Phonemes
  '啊': { viseme: 'aa', jaw: 0.65, weight: 0.8 },
  '阿': { viseme: 'aa', jaw: 0.65, weight: 0.8 },
  '哦': { viseme: 'O', jaw: 0.5, weight: 0.75 },
  '喔': { viseme: 'O', jaw: 0.5, weight: 0.75 },
  '鵝': { viseme: 'E', jaw: 0.4, weight: 0.7 },
  '衣': { viseme: 'I', jaw: 0.2, weight: 0.65 },
  '一': { viseme: 'I', jaw: 0.2, weight: 0.65 },
  '烏': { viseme: 'U', jaw: 0.3, weight: 0.8 },
  '迂': { viseme: 'U', jaw: 0.25, weight: 0.75 },
  '艾': { viseme: 'E', jaw: 0.45, weight: 0.75 },
  '安': { viseme: 'aa', jaw: 0.5, weight: 0.7 },
  '昂': { viseme: 'aa', jaw: 0.55, weight: 0.75 },
  '巴': { viseme: 'PP', jaw: 0.15, weight: 0.85 },
  '波': { viseme: 'PP', jaw: 0.25, weight: 0.75 },
  '摸': { viseme: 'PP', jaw: 0.1, weight: 0.85 },
  '佛': { viseme: 'FF', jaw: 0.15, weight: 0.8 },
  '得': { viseme: 'DD', jaw: 0.3, weight: 0.7 },
  '特': { viseme: 'DD', jaw: 0.35, weight: 0.7 },

  // English Vowels & Consonants
  'a': { viseme: 'aa', jaw: 0.6, weight: 0.8 },
  'e': { viseme: 'E', jaw: 0.4, weight: 0.7 },
  'i': { viseme: 'I', jaw: 0.2, weight: 0.65 },
  'o': { viseme: 'O', jaw: 0.5, weight: 0.75 },
  'u': { viseme: 'U', jaw: 0.3, weight: 0.8 },
  'b': { viseme: 'PP', jaw: 0.1, weight: 0.85 },
  'p': { viseme: 'PP', jaw: 0.1, weight: 0.85 },
  'm': { viseme: 'PP', jaw: 0.1, weight: 0.85 },
  'f': { viseme: 'FF', jaw: 0.15, weight: 0.8 },
  'v': { viseme: 'FF', jaw: 0.15, weight: 0.8 },
  's': { viseme: 'SS', jaw: 0.15, weight: 0.7 },
  'z': { viseme: 'SS', jaw: 0.15, weight: 0.7 },
  'r': { viseme: 'RR', jaw: 0.3, weight: 0.65 }
};

/**
 * Extracts target viseme weights from text transcript or current time index
 */
function getTargetVisemes(text?: string, timeSec: number = 0): Record<string, number> {
  const targets: Record<string, number> = {
    aa: 0, E: 0, I: 0, O: 0, U: 0, PP: 0, FF: 0, SS: 0, TH: 0, DD: 0, RR: 0,
    jawOpen: 0, mouthOpen: 0, mouthFunnel: 0, mouthPucker: 0
  };

  if (text && text.trim().length > 0) {
    const cleanText = text.replace(/[\s\d\p{P}]/gu, '');
    if (cleanText.length > 0) {
      const charIndex = Math.floor(timeSec * 8) % cleanText.length;
      const char = cleanText[charIndex].toLowerCase();
      const config = PHONEME_DICTIONARY[char] || PHONEME_DICTIONARY[char.charAt(0)];

      if (config) {
        // Dynamic volume modulation curve over character duration
        const charPhase = (timeSec * 8) % 1;
        const envelope = Math.sin(charPhase * Math.PI); // Smooth bell curve (0 -> 1 -> 0)

        targets[config.viseme] = config.weight * envelope;
        targets.jawOpen = config.jaw * envelope;
        targets.mouthOpen = config.jaw * 0.7 * envelope;
        return targets;
      }
    }
  }

  // Syllabic fallback curve when text transcript is not available
  const cycle = Math.sin(timeSec * 14) * 0.5 + Math.sin(timeSec * 22) * 0.3 + 0.1;
  if (cycle > 0.05) {
    const visemes = ['aa', 'E', 'I', 'O', 'U', 'PP', 'FF'];
    const idx = Math.floor(timeSec * 7) % visemes.length;
    const v = visemes[idx];

    targets[v] = cycle * 0.75;
    targets.jawOpen = cycle * 0.55;
    targets.mouthOpen = cycle * 0.45;
  }

  return targets;
}

/**
 * Directly applies viseme blendshape weights to avatar meshes in Three.js
 */
function applyVisemeWeights(head: any, weights: Record<string, number>) {
  if (!head) return;
  const meshes: any[] = head.morphs || (head.avatar?.body ? [head.avatar.body] : []);
  if (!meshes || meshes.length === 0) return;

  meshes.forEach((mesh: any) => {
    if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;
    const dict = mesh.morphTargetDictionary;
    const inf = mesh.morphTargetInfluences;

    Object.entries(weights).forEach(([key, val]) => {
      const targetName = dict.hasOwnProperty(key)
        ? key
        : dict.hasOwnProperty(`viseme_${key}`)
        ? `viseme_${key}`
        : null;

      if (targetName && dict[targetName] !== undefined) {
        inf[dict[targetName]] = Math.max(0, Math.min(1, val));
      }
    });
  });
}

  // Handle mood changes safely only after avatar is fully loaded
  useEffect(() => {
    if (headRef.current && headRef.current.avatar?.body && !loading) {
      try {
        headRef.current.setMood?.(mood);
      } catch (e) {
        console.warn('Failed to set avatar mood', e);
      }
    }
  }, [mood, loading]);

  // Real-time smooth lerp lip-sync & phoneme mouth animation loop
  useEffect(() => {
    const head = headRef.current;
    if (!head || loading) return;

    let animFrameId: number | null = null;
    let lastTime = performance.now();
    const startTime = Date.now();

    // Active interpolated weights state for smooth 60fps exponential lerp
    const currentWeights: Record<string, number> = {
      aa: 0, E: 0, I: 0, O: 0, U: 0, PP: 0, FF: 0, SS: 0, TH: 0, DD: 0, RR: 0,
      jawOpen: 0, mouthOpen: 0, mouthFunnel: 0, mouthPucker: 0,
      viseme_aa: 0, viseme_E: 0, viseme_I: 0, viseme_O: 0, viseme_U: 0, viseme_PP: 0, viseme_FF: 0
    };

    if (speaking) {
      const animateLips = (now: number) => {
        const dt = Math.min(0.1, (now - lastTime) / 1000);
        lastTime = now;
        const elapsedSec = (Date.now() - startTime) / 1000;

        // Fetch target phoneme viseme weights for the current text / audio phase
        const targetWeights = getTargetVisemes(activeText, elapsedSec);

        // Exponential smoothing (lerp) for fluid, continuous mouth movement
        Object.keys(currentWeights).forEach(key => {
          const target = targetWeights[key] || targetWeights[`viseme_${key}`] || 0;
          // Fast attack when opening, smooth decay when closing
          const lerpSpeed = target > currentWeights[key] ? 24 : 15;
          currentWeights[key] += (target - currentWeights[key]) * Math.min(1, dt * lerpSpeed);
        });

        applyVisemeWeights(head, currentWeights);

        animFrameId = requestAnimationFrame(animateLips);
      };

      animFrameId = requestAnimationFrame(animateLips);
    } else {
      // Smoothly decay all weights back to 0 when speech stops
      const decayLips = (now: number) => {
        const dt = Math.min(0.1, (now - lastTime) / 1000);
        lastTime = now;

        let activeCount = 0;
        Object.keys(currentWeights).forEach(key => {
          currentWeights[key] += (0 - currentWeights[key]) * Math.min(1, dt * 18);
          if (Math.abs(currentWeights[key]) > 0.001) activeCount++;
        });

        applyVisemeWeights(head, currentWeights);

        if (activeCount > 0) {
          animFrameId = requestAnimationFrame(decayLips);
        }
      };

      animFrameId = requestAnimationFrame(decayLips);
    }

    return () => {
      if (animFrameId !== null) cancelAnimationFrame(animFrameId);
    };
  }, [speaking, activeText, loading]);

  return (
    <div
      className="relative flex items-center justify-center overflow-hidden rounded-lg bg-slate-900 shadow-inner"
      style={{ width, height }}
    >
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-slate-300 gap-2 z-10">
          <span className="material-symbols-outlined animate-spin text-2xl">sync</span>
          <span className="text-xs font-medium">載入 3D 虛擬人像中…</span>
        </div>
      )}

      {loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-red-400 p-4 text-center gap-1 z-10">
          <span className="material-symbols-outlined text-2xl">error_outline</span>
          <span className="text-xs font-semibold">3D 虛擬人像載入失敗</span>
          <span className="text-[10px] text-slate-400 max-w-[200px] truncate">{loadError}</span>
        </div>
      )}

      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
};
