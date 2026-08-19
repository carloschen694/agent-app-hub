import React, { useState, useEffect, useRef } from 'react';
import type { VideoProject, ReportVideoScene, Character, QueueItem } from '../types';
import { saveMediaBlob } from '../ArticleWriterPage';

interface VideoProjectEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onEnqueueVideo: (params: {
    prompt: string;
    aspectRatio: '1:1' | '16:9' | '9:16';
    resolution: '720p' | '1080p';
    mode: 'text-to-video' | 'frame-to-video' | 'reference-to-video';
    startFrameBase64?: string;
    endFrameBase64?: string;
    referenceImages?: { base64: string; type: string; name: string }[];
    styleImage?: { base64: string; type: string; name: string };
    model?: string;
    targetField?: string;
    narration?: string;
    subtitle?: string;
    characterId?: string;
  }) => void;
  onEnqueueImage?: (params: {
    prompt: string;
    size: '1:1' | '16:9' | '9:16';
    mode: 'text-to-image' | 'image-to-image' | 'reference-to-image';
    referenceImageBase64?: string;
    targetField: string;
    model?: string;
    articleId?: string;
  }) => void;
  apiKey?: string;
  queue: QueueItem[];
  onOpenMediaLibrary: (mode: 'image' | 'video', onSelect: (url: string) => void) => void;
}

const LOCAL_STORAGE_PROJECTS_KEY = 'class11_video_projects';

export const VideoProjectEditor: React.FC<VideoProjectEditorProps> = ({
  isOpen,
  onClose,
  onEnqueueVideo,
  onEnqueueImage,
  queue,
  onOpenMediaLibrary,
}) => {
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  
  // Selected project state
  const activeProject = projects.find(p => p.id === selectedProjectId);

  // Selected focused scene in the timeline
  const [focusedSceneIdx, setFocusedSceneIdx] = useState<number>(0);

  // Character being edited in character setup modal
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);

  // Preview Player states
  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const [playAllIdx, setPlayAllIdx] = useState(0);
  const playerVideoRef = useRef<HTMLVideoElement | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeProgress, setMergeProgress] = useState(0);

  // Load projects from localStorage
  useEffect(() => {
    if (!isOpen) return;
    const saved = localStorage.getItem(LOCAL_STORAGE_PROJECTS_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setProjects(Object.values(parsed));
        if (Object.keys(parsed).length > 0) {
          setSelectedProjectId(Object.keys(parsed)[0]);
        }
      } catch (err) {
        console.error('Failed to parse video projects:', err);
      }
    }
  }, [isOpen]);

  // Save projects to localStorage
  const saveProjects = (updatedProjects: VideoProject[]) => {
    setProjects(updatedProjects);
    const dict = updatedProjects.reduce((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {} as Record<string, VideoProject>);
    localStorage.setItem(LOCAL_STORAGE_PROJECTS_KEY, JSON.stringify(dict));
  };

  // Create new project
  const handleCreateProject = () => {
    const title = prompt('請輸入新影片專案名稱：');
    if (!title || !title.trim()) return;

    const newProject: VideoProject = {
      id: 'project_' + Date.now(),
      title: title.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      aspectRatio: '16:9',
      resolution: '720p',
      model: 'veo-3.1-generate-preview',
      characters: [
        {
          id: 'char_reporter_' + Date.now(),
          name: '記者 蕭美美',
          role: '記者',
          avatarUrl: '',
          description: '專業女記者，穿著黑色套裝，拿著麥克風，氣質專業穩重',
          voiceModel: 'cmn-TW-Standard-A',
          voicePrompt: '女性聲音，溫柔且專業，標準台灣腔調'
        },
        {
          id: 'char_witness_' + Date.now(),
          name: '受訪者 陳先生',
          role: '受訪路人',
          avatarUrl: '',
          description: '年約三十歲的男性，戴眼鏡，穿著素色襯衫',
          voiceModel: 'cmn-TW-Standard-B',
          voicePrompt: '男性聲音，自然且親切，標準台灣腔調'
        }
      ],
      scenes: [
        {
          sceneId: 'scene_1',
          background: '新聞現場戶外背景',
          camera: '中景鏡頭慢速推近，記者面對鏡頭',
          narration: '各位觀眾好，我是記者。今天我們在信義區為您做現場報導。',
          subtitle: '各位觀眾好，我是記者。今天我們在信義區現場報導。',
          characterId: '',
          videoUrl: ''
        },
        {
          sceneId: 'scene_2',
          background: '街頭背景',
          camera: '受訪者胸部以上特寫，街頭手持拍攝質感',
          narration: '我覺得這次的科技展非常有創意，讓大家看到未來的可能性。',
          subtitle: '我覺得這次科技展非常有創意，展現未來的可能性。',
          characterId: '',
          videoUrl: ''
        },
        {
          sceneId: 'scene_3',
          background: '新聞現場戶外背景',
          camera: '鏡頭微拉，記者對著鏡頭進行總結',
          narration: '以上是我們在現場的獨家直擊報導，感謝您的收看。',
          subtitle: '以上是我們在現場的獨家直擊報導，感謝您的收看。',
          characterId: '',
          videoUrl: ''
        }
      ],
      autoGenState: 'idle'
    };

    // Auto bind character IDs
    newProject.scenes[0].characterId = newProject.characters[0].id;
    newProject.scenes[1].characterId = newProject.characters[1].id;
    newProject.scenes[2].characterId = newProject.characters[0].id;

    const newList = [...projects, newProject];
    saveProjects(newList);
    setSelectedProjectId(newProject.id);
    setFocusedSceneIdx(0);
  };

  // Rename active project
  const handleRenameProject = () => {
    if (!activeProject) return;
    const title = prompt('請輸入影片專案的新名稱：', activeProject.title);
    if (!title || !title.trim()) return;

    const updated = projects.map(p => {
      if (p.id === activeProject.id) {
        return { ...p, title: title.trim(), updatedAt: new Date().toISOString() };
      }
      return p;
    });
    saveProjects(updated);
  };

  // Delete active project
  const handleDeleteProject = () => {
    if (!activeProject) return;
    if (!confirm(`確定要刪除影片專案「${activeProject.title}」嗎？`)) return;

    const updated = projects.filter(p => p.id !== activeProject.id);
    saveProjects(updated);
    if (updated.length > 0) {
      setSelectedProjectId(updated[0].id);
    } else {
      setSelectedProjectId('');
    }
    setFocusedSceneIdx(0);
  };

  // Update scene in active project
  const updateScene = (sceneIdx: number, updater: Partial<ReportVideoScene>) => {
    if (!activeProject) return;
    const updatedScenes = activeProject.scenes.map((s, idx) => {
      if (idx === sceneIdx) {
        return { ...s, ...updater };
      }
      return s;
    });

    const updated = projects.map(p => {
      if (p.id === activeProject.id) {
        return { ...p, scenes: updatedScenes, updatedAt: new Date().toISOString() };
      }
      return p;
    });
    saveProjects(updated);
  };

  // Add scene
  const handleAddScene = () => {
    if (!activeProject) return;
    const newScene: ReportVideoScene = {
      sceneId: `scene_${activeProject.scenes.length + 1}`,
      background: '',
      camera: '',
      narration: '',
      subtitle: '',
      videoUrl: ''
    };

    const updated = projects.map(p => {
      if (p.id === activeProject.id) {
        return {
          ...p,
          scenes: [...p.scenes, newScene],
          updatedAt: new Date().toISOString()
        };
      }
      return p;
    });
    saveProjects(updated);
    setFocusedSceneIdx(activeProject.scenes.length);
  };

  // Delete scene
  const handleDeleteScene = (sceneIdx: number) => {
    if (!activeProject || activeProject.scenes.length <= 1) return;
    const filtered = activeProject.scenes.filter((_, idx) => idx !== sceneIdx);
    const reindexed = filtered.map((s, idx) => ({
      ...s,
      sceneId: `scene_${idx + 1}`
    }));

    const updated = projects.map(p => {
      if (p.id === activeProject.id) {
        return {
          ...p,
          scenes: reindexed,
          updatedAt: new Date().toISOString()
        };
      }
      return p;
    });
    saveProjects(updated);
    setFocusedSceneIdx(Math.max(0, sceneIdx - 1));
  };

  // Update character
  const updateCharacter = (charId: string, updater: Partial<Character>) => {
    if (!activeProject) return;
    const updatedChars = activeProject.characters.map(c => {
      if (c.id === charId) {
        return { ...c, ...updater };
      }
      return c;
    });

    const updated = projects.map(p => {
      if (p.id === activeProject.id) {
        return { ...p, characters: updatedChars, updatedAt: new Date().toISOString() };
      }
      return p;
    });
    saveProjects(updated);
  };

  // Delete character
  const handleDeleteCharacter = (charId: string) => {
    if (!activeProject) return;
    const updatedChars = activeProject.characters.filter(c => c.id !== charId);
    
    // Clear character bindings in scenes
    const updatedScenes = activeProject.scenes.map(s => {
      if (s.characterId === charId) {
        return { ...s, characterId: '' };
      }
      return s;
    });

    const updated = projects.map(p => {
      if (p.id === activeProject.id) {
        return {
          ...p,
          characters: updatedChars,
          scenes: updatedScenes,
          updatedAt: new Date().toISOString()
        };
      }
      return p;
    });
    saveProjects(updated);
  };

  // Add new character
  const handleAddNewCharacter = () => {
    if (!activeProject) return;
    const name = prompt('請輸入角色姓名：');
    if (!name || !name.trim()) return;

    const newChar: Character = {
      id: 'char_' + Date.now(),
      name: name.trim(),
      role: '受訪路人',
      avatarUrl: '',
      description: '造型描述...',
      voiceModel: 'cmn-TW-Standard-A',
      voicePrompt: '女性聲音，標準台灣腔調'
    };

    const updated = projects.map(p => {
      if (p.id === activeProject.id) {
        return {
          ...p,
          characters: [...p.characters, newChar],
          updatedAt: new Date().toISOString()
        };
      }
      return p;
    });
    saveProjects(updated);
  };

  // Submit Imagen static image task for focused scene
  const submitSceneImageTask = (idx: number) => {
    if (!onEnqueueImage || !activeProject) return;
    const scene = activeProject.scenes[idx];
    if (!scene) return;

    const char = activeProject.characters.find(c => c.id === scene.characterId);
    const charStylePrompt = char ? `Subject is ${char.name} (${char.role}), matching character look: ${char.description}. ` : '';
    const cameraPrompt = scene.camera ? `Camera angle: ${scene.camera}. ` : '';
    const bgPrompt = scene.background ? `Background scene setting: ${scene.background}. ` : '';

    const subtitleBannerPrompt = `A lower-third news reporter banner layout at the bottom of the screen has a white text box displaying Traditional Chinese text: "${scene.subtitle}".`;
    const finalImagePrompt = `A professional, photo-realistic TV news report broadcast keyframe screenshot. Journalism photography style, natural live studio lighting. ${bgPrompt}${cameraPrompt}${charStylePrompt}${subtitleBannerPrompt} High fidelity details.`;

    onEnqueueImage({
      prompt: finalImagePrompt,
      size: activeProject.aspectRatio,
      mode: 'text-to-image',
      targetField: `project_${activeProject.id}_scene_${idx + 1}_image`,
      model: 'gemini-3.1-flash-image'
    });
  };

  // Helper to read local URL blob to base64
  const getBase64FromUrl = async (url: string): Promise<string> => {
    if (!url || url.startsWith('placeholder')) return '';
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            const base64Data = reader.result.split(',')[1] || '';
            resolve(base64Data);
          } else {
            resolve('');
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.error('Failed to get base64 from URL:', err);
      return '';
    }
  };

  // Submit Veo video segment generation task
  const submitSceneVideoTask = async (idx: number) => {
    if (!activeProject) return;
    const scene = activeProject.scenes[idx];
    if (!scene) return;

    const hasImage = scene.imageUrl && !scene.imageUrl.startsWith('placeholder://') && !scene.imageUrl.startsWith('placeholder-');

    let startFrameBase64 = '';
    if (hasImage) {
      startFrameBase64 = await getBase64FromUrl(scene.imageUrl!);
    }

    const char = activeProject.characters.find(c => c.id === scene.characterId);
    const charStylePrompt = char ? `Subject is ${char.name} (${char.role}), matching character look: ${char.description}. ` : '';
    const cameraPrompt = scene.camera ? `Camera motion: ${scene.camera}. ` : '';
    const bgPrompt = scene.background ? `Scene background: ${scene.background}. ` : '';
    const voiceSpec = char ? `Voice settings: model=${char.voiceModel || 'default'}, voice prompt="${char.voicePrompt || ''}". ` : '';
    
    const finalPrompt = `A 5-second video clip. Style: Photo-realistic journalism style news footage. ${bgPrompt}${cameraPrompt}${charStylePrompt}${voiceSpec}Oral narration voiceover: ${scene.narration}. Video moves smoothly starting from the first frame. The video contains voice and subtitles.`;

    onEnqueueVideo({
      prompt: finalPrompt,
      aspectRatio: activeProject.aspectRatio,
      resolution: activeProject.resolution,
      mode: startFrameBase64 ? 'frame-to-video' : (char?.avatarUrl ? 'reference-to-video' : 'text-to-video'),
      startFrameBase64: startFrameBase64 || undefined,
      referenceImages: (!startFrameBase64 && char?.avatarUrl) ? [{ base64: char.avatarUrl, type: 'image/jpeg', name: `${char.name}_avatar.jpg` }] : undefined,
      model: activeProject.model,
      targetField: `project_${activeProject.id}_scene_${idx + 1}_video`,
      narration: scene.narration,
      subtitle: scene.subtitle,
      characterId: scene.characterId || undefined
    });
  };

  // Sequential Playback loop
  useEffect(() => {
    if (!isPlayingAll || !activeProject) return;

    const currentScene = activeProject.scenes[playAllIdx];
    if (!currentScene || !currentScene.videoUrl || currentScene.videoUrl.startsWith('placeholder')) {
      // If next scene has no video, wrap back or stop
      setIsPlayingAll(false);
      return;
    }

    const video = playerVideoRef.current;
    if (video) {
      video.src = currentScene.videoUrl;
      video.load();
      video.play().catch(err => {
        console.warn('Video playback failed:', err);
        setIsPlayingAll(false);
      });
    }
  }, [playAllIdx, isPlayingAll, activeProject]);

  const handleVideoEnded = () => {
    if (!activeProject) return;
    const nextIdx = playAllIdx + 1;
    if (nextIdx < activeProject.scenes.length) {
      setPlayAllIdx(nextIdx);
    } else {
      // Loop back to start
      setPlayAllIdx(0);
      setIsPlayingAll(false);
    }
  };

  const handleTimeUpdate = () => {
    // Preview time update
  };

  // Monitor Queue completions for Auto-Pipeline Generation
  useEffect(() => {
    if (projects.length === 0) return;

    let hasChanges = false;
    const updatedProjects = projects.map(p => {
      // Check if this project is auto-generating
      const activeQueue = queue.filter(q => q.targetField?.startsWith(`project_${p.id}_`));
      if (activeQueue.length === 0) return p;

      const scenesCopy = [...p.scenes];
      let projectModified = false;

      activeQueue.forEach(task => {
        if (task.status === 'completed') {
          // Parse targetField: project_{id}_scene_{idx}_(image/video)
          const parts = task.targetField!.split('_');
          const sceneNum = parseInt(parts[3] || '1', 10);
          const type = parts[4]; // image or video
          const sceneIdx = sceneNum - 1;

          if (scenesCopy[sceneIdx]) {
            // Find resolved URL
            const savedMedia = JSON.parse(localStorage.getItem('class11_global_media') || '[]');
            const resolvedItem = savedMedia.find((m: any) => m.placeholderId === task.id);
            const resolvedUrl = resolvedItem?.url || '';

            if (resolvedUrl) {
              if (type === 'image' && (!scenesCopy[sceneIdx].imageUrl || scenesCopy[sceneIdx].imageUrl!.startsWith('placeholder'))) {
                scenesCopy[sceneIdx].imageUrl = resolvedUrl;
                projectModified = true;

                // Chain: if in auto-gen mode, enqueue the video generation task right away!
                if (p.autoGenState === 'generating_images') {
                  submitSceneVideoTask(sceneIdx);
                }
              } else if (type === 'video' && (!scenesCopy[sceneIdx].videoUrl || scenesCopy[sceneIdx].videoUrl.startsWith('placeholder'))) {
                scenesCopy[sceneIdx].videoUrl = resolvedUrl;
                projectModified = true;
              }
            }
          }
        }
      });

      if (projectModified) {
        hasChanges = true;
        // Evaluate auto-gen progress transitions
        let nextState = p.autoGenState;
        const allImagesDone = scenesCopy.every(s => s.imageUrl && !s.imageUrl.startsWith('placeholder'));
        const allVideosDone = scenesCopy.every(s => s.videoUrl && !s.videoUrl.startsWith('placeholder'));

        if (p.autoGenState === 'generating_images' && allImagesDone) {
          nextState = 'generating_videos';
          // Batch submit videos
          scenesCopy.forEach((_, idx) => {
            submitSceneVideoTask(idx);
          });
        } else if (p.autoGenState === 'generating_videos' && allVideosDone) {
          nextState = 'completed';
        }

        return {
          ...p,
          scenes: scenesCopy,
          autoGenState: nextState,
          updatedAt: new Date().toISOString()
        };
      }

      return p;
    });

    if (hasChanges) {
      saveProjects(updatedProjects);
    }
  }, [queue]); // eslint-disable-line react-hooks/exhaustive-deps

  // Trigger automated pipeline (一鍵一路生成)
  const triggerAutoPipeline = () => {
    if (!activeProject || !onEnqueueImage) return;

    // Set state to generating images
    const updated = projects.map(p => {
      if (p.id === activeProject.id) {
        return {
          ...p,
          autoGenState: 'generating_images' as const,
          updatedAt: new Date().toISOString()
        };
      }
      return p;
    });
    saveProjects(updated);

    // Queue images
    activeProject.scenes.forEach((_, idx) => {
      submitSceneImageTask(idx);
    });

    alert('自動化生成管線已啟動！正在依序佇列生成首影格與影片片段，請於任務佇列面板查看進度。');
  };

  // Merge scenes and export combined video to global media library
  const handleExportProject = async () => {
    if (!activeProject) return;

    const missingVideo = activeProject.scenes.some(s => !s.videoUrl || s.videoUrl.startsWith('placeholder'));
    if (missingVideo) {
      alert('請確認所有分鏡的影片皆已生成完成！');
      return;
    }

    setIsMerging(true);
    setMergeProgress(0);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('無法取得 Canvas Context');

      // Preload videos and audio destination
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      const audioDest = audioCtx.createMediaStreamDestination();

      const videoElements: HTMLVideoElement[] = [];
      for (let i = 0; i < activeProject.scenes.length; i++) {
        const scene = activeProject.scenes[i];
        const v = document.createElement('video');
        v.src = scene.videoUrl!;
        v.muted = false;
        v.playsInline = true;
        v.crossOrigin = 'anonymous';

        await new Promise((resolve) => {
          v.onloadedmetadata = resolve;
          v.load();
        });

        const source = audioCtx.createMediaElementSource(v);
        source.connect(audioDest);
        videoElements.push(v);
      }

      // MediaRecorder Setup
      const chunks: Blob[] = [];
      const canvasStream = canvas.captureStream(30);
      const combinedStream = new MediaStream();

      canvasStream.getVideoTracks().forEach(track => combinedStream.addTrack(track));
      audioDest.stream.getAudioTracks().forEach(track => combinedStream.addTrack(track));

      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/mp4';

      const mediaRecorder = new MediaRecorder(combinedStream, { mimeType });
      mediaRecorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };

      const recordPromise = new Promise<Blob>((resolve, reject) => {
        mediaRecorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
        mediaRecorder.onerror = reject;
      });

      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      mediaRecorder.start();

      // Draw Avatar images
      const avatarImages: Record<string, HTMLImageElement> = {};
      for (const char of activeProject.characters) {
        if (char.avatarUrl) {
          const img = new Image();
          img.src = char.avatarUrl;
          await new Promise(r => { img.onload = r; img.onerror = r; });
          avatarImages[char.id] = img;
        }
      }

      const sceneDuration = 5000;
      const totalDuration = sceneDuration * activeProject.scenes.length;
      const startTime = Date.now();
      
      const tickerText = `【焦點專案】${activeProject.title} || 焦點特寫報導...`;
      let tickerX = 1280;

      // Draw loop
      const render = () => {
        const elapsed = Date.now() - startTime;
        const currentProgress = Math.min((elapsed / totalDuration) * 100, 100);
        setMergeProgress(Math.round(currentProgress));

        if (elapsed >= totalDuration) {
          mediaRecorder.stop();
          return;
        }

        const sceneIdx = Math.floor(elapsed / sceneDuration);
        const sceneTime = elapsed % sceneDuration;
        const video = videoElements[sceneIdx];
        const scene = activeProject.scenes[sceneIdx];

        if (video.paused) {
          video.currentTime = sceneTime / 1000;
          video.play().catch(() => {});
        }

        ctx.drawImage(video, 0, 0, 1280, 720);

        // 1. Draw SNG LIVE
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.roundRect(30, 30, 220, 45, 8);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(50, 52, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.font = '900 18px sans-serif';
        ctx.fillText('SNG LIVE 即時新聞', 72, 58);

        // 2. Draw Scene badge
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.beginPath();
        ctx.roundRect(1000, 30, 250, 45, 8);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(1000, 30, 250, 45);
        ctx.fillStyle = '#cbd5e1';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText(`分鏡 ${sceneIdx + 1} / ${activeProject.scenes.length} : ${scene.subtitle ? scene.subtitle.slice(0, 10) + '...' : `分鏡 #${sceneIdx + 1}`}`, 1020, 58);

        // 3. Draw Reporter Nameplate
        const char = activeProject.characters.find(c => c.id === scene.characterId);
        if (char) {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
          ctx.beginPath();
          ctx.roundRect(50, 520, 350, 80, 10);
          ctx.fill();
          ctx.strokeStyle = '#334155';
          ctx.stroke();

          const avatarImg = avatarImages[char.id];
          let textOffset = 70;
          if (avatarImg) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(100, 560, 30, 0, 2 * Math.PI);
            ctx.clip();
            ctx.drawImage(avatarImg, 70, 530, 60, 60);
            ctx.restore();
            textOffset = 150;
          }

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 20px sans-serif';
          ctx.fillText(char.name, textOffset, 555);
          ctx.fillStyle = '#94a3b8';
          ctx.font = 'bold 14px sans-serif';
          ctx.fillText(char.role, textOffset, 585);
        }

        // 4. Draw Subtitle
        if (scene.subtitle) {
          ctx.font = 'bold 24px sans-serif';
          const textWidth = ctx.measureText(scene.subtitle).width;
          ctx.fillStyle = 'rgba(0,0,0,0.75)';
          ctx.beginPath();
          ctx.roundRect(640 - textWidth / 2 - 20, 615, textWidth + 40, 45, 22);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.fillText(scene.subtitle, 640 - textWidth / 2, 646);
        }

        // 5. Draw Ticker Scrolling Banner
        ctx.fillStyle = '#1e3a8a';
        ctx.fillRect(0, 675, 1280, 45);
        ctx.fillStyle = '#f97316';
        ctx.fillRect(0, 675, 100, 45);
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 18px sans-serif';
        ctx.fillText('焦點', 32, 704);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px sans-serif';
        tickerX -= 3;
        if (tickerX < -1500) tickerX = 1280;
        ctx.save();
        ctx.beginPath();
        ctx.rect(100, 675, 1180, 45);
        ctx.clip();
        ctx.fillText(tickerText, tickerX, 704);
        ctx.restore();

        requestAnimationFrame(render);
      };

      render();

      const finalBlob = await recordPromise;
      videoElements.forEach(v => {
        v.pause();
        v.src = '';
      });

      const combinedId = 'project_combined_' + Date.now();
      await saveMediaBlob(combinedId, finalBlob);
      const combinedUrl = URL.createObjectURL(finalBlob);

      // Save to media library
      const savedMedia = JSON.parse(localStorage.getItem('class11_global_media') || '[]');
      const newItem = {
        id: combinedId,
        url: combinedUrl,
        type: 'video' as const,
        alt: `影片專案匯出：${activeProject.title}`,
        createdAt: new Date().toISOString(),
        placeholderId: combinedId,
        sources: activeProject.scenes.map(s => s.videoUrl!)
      };
      localStorage.setItem('class11_global_media', JSON.stringify([newItem, ...savedMedia]));

      alert('專案已成功合併並導出至媒體素材庫！');
    } catch (err: any) {
      console.error(err);
      alert('匯出失敗: ' + err.message);
    } finally {
      setIsMerging(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in text-slate-750 font-sans">
      <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-blue-600 font-bold">movie_edit</span>
            <div className="flex flex-col">
              <h3 className="font-bold text-slate-800 text-sm">焦點影片專案編輯器</h3>
              <p className="text-[10px] text-slate-400">管理、剪輯、與一鍵自動生成電視報導影片</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none font-bold"
            >
              <option value="" disabled>選擇影片專案...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            <button
              onClick={handleCreateProject}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shadow-sm"
            >
              <span className="material-symbols-outlined text-xs">add</span>
              新建專案
            </button>
            {activeProject && (
              <>
                <button
                  onClick={handleRenameProject}
                  className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold transition-colors"
                >
                  重命名
                </button>
                <button
                  onClick={handleDeleteProject}
                  className="px-2.5 py-1.5 text-red-600 hover:bg-red-50 border border-red-100 rounded-xl text-xs font-bold transition-colors"
                >
                  刪除
                </button>
              </>
            )}
            <div className="h-6 w-[1px] bg-slate-200"></div>
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {activeProject ? (
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 min-h-0">
            {/* Top Workspace: Preview Player */}
            <div className="grid grid-cols-5 gap-6">
              {/* Preview Window (Left 3 columns) */}
              <div className="col-span-3 border border-slate-200 rounded-2xl overflow-hidden bg-slate-950 flex flex-col shadow-sm relative aspect-[16/9]">
                <video
                  ref={playerVideoRef}
                  onEnded={handleVideoEnded}
                  onTimeUpdate={handleTimeUpdate}
                  className="w-full h-full object-cover"
                />

                {/* SNG Live Television Graphics Overlay */}
                <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4">
                  {/* Top elements */}
                  <div className="flex justify-between items-start">
                    <div className="bg-red-600/90 text-white text-[9px] font-bold px-2 py-1 rounded flex items-center gap-1.5 border border-red-500 shadow-md">
                      <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping"></span>
                      SNG LIVE 即時新聞
                    </div>
                    <div className="bg-black/60 text-slate-300 text-[9px] font-bold px-2 py-1 rounded border border-slate-700">
                      分鏡 {playAllIdx + 1} / {activeProject.scenes.length} : {activeProject.scenes[playAllIdx]?.subtitle?.slice(0, 15) || `分鏡 #${playAllIdx + 1}`}
                    </div>
                  </div>

                  {/* Subtitles & Nameplate */}
                  <div className="space-y-3">
                    {/* Reporter Nameplate */}
                    {activeProject.scenes[playAllIdx]?.characterId && (
                      (() => {
                        const char = activeProject.characters.find(c => c.id === activeProject.scenes[playAllIdx].characterId);
                        if (!char) return null;
                        return (
                          <div className="bg-slate-900/95 border border-slate-700 rounded-lg overflow-hidden flex items-center shadow-lg p-2 max-w-[180px]">
                            {char.avatarUrl && (
                              <img src={char.avatarUrl} className="h-8 w-8 rounded-full object-cover mr-2" alt="avatar" />
                            )}
                            <div className="flex flex-col">
                              <span className="text-white text-[11px] font-bold">{char.name}</span>
                              <span className="text-slate-400 text-[8px]">{char.role}</span>
                            </div>
                          </div>
                        );
                      })()
                    )}

                    {/* Subtitle bottom banner */}
                    {activeProject.scenes[playAllIdx]?.subtitle && (
                      <div className="text-center w-full">
                        <span className="bg-black/85 text-white font-bold text-sm px-3.5 py-1.5 rounded-xl border border-slate-800">
                          {activeProject.scenes[playAllIdx].subtitle}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Preview Player Controls & Pipeline trigger (Right 2 columns) */}
              <div className="col-span-2 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="bg-slate-50 border border-slate-250 p-4 rounded-xl space-y-3 shadow-sm">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">專案資訊</span>
                    <h4 className="text-sm font-bold text-slate-800">{activeProject.title}</h4>
                    <p className="text-[10px] text-slate-500">分鏡總數：{activeProject.scenes.length} 段 | 影片總長：{activeProject.scenes.length * 5} 秒</p>
                    
                    {/* Pipeline State Display */}
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="text-[9px] font-bold bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded">
                        自動管線：{
                          activeProject.autoGenState === 'generating_images' ? '正在批量生成靜態畫面...' :
                          activeProject.autoGenState === 'generating_videos' ? '正在批量生成影片片段...' :
                          activeProject.autoGenState === 'completed' ? '自動化生成已完成！' : '等待啟動'
                        }
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setIsPlayingAll(true);
                        setPlayAllIdx(0);
                      }}
                      className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-sm font-bold">play_arrow</span>
                      播放整部報導
                    </button>
                    <button
                      onClick={() => setIsPlayingAll(false)}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center"
                    >
                      <span className="material-symbols-outlined text-sm font-bold">pause</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5 pt-4 border-t border-slate-100">
                  <button
                    onClick={triggerAutoPipeline}
                    className="w-full py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-xs font-bold shadow transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">smart_toy</span>
                    自動一路完成整部影片
                  </button>
                  <button
                    onClick={handleExportProject}
                    disabled={isMerging}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-sm">movie_filter</span>
                    {isMerging ? `正在合併並導出 (${mergeProgress}%)` : '合併並導出至素材庫'}
                  </button>
                </div>
              </div>
            </div>

            {/* Timeline Track */}
            <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">影片時間軸剪輯軌 (Timeline)</span>
                <button
                  onClick={handleAddScene}
                  className="flex items-center gap-0.5 text-blue-600 hover:text-blue-800 text-[10px] font-extrabold"
                >
                  <span className="material-symbols-outlined text-xs">add</span>
                  追加分鏡
                </button>
              </div>

              <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin">
                {activeProject.scenes.map((scene, idx) => {
                  const isFocused = idx === focusedSceneIdx;
                  return (
                    <div
                      key={scene.sceneId}
                      onClick={() => setFocusedSceneIdx(idx)}
                      className={`flex-shrink-0 w-44 border-2 rounded-xl overflow-hidden cursor-pointer bg-white transition-all shadow-sm ${isFocused ? 'border-blue-600 ring-2 ring-blue-100 shadow-md scale-98' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                      {/* Scene Mini Preview */}
                      <div className="relative aspect-video bg-slate-900 flex items-center justify-center group overflow-hidden">
                        {scene.videoUrl && !scene.videoUrl.startsWith('placeholder') ? (
                          <video src={scene.videoUrl} className="w-full h-full object-cover" muted autoPlay loop />
                        ) : scene.imageUrl && !scene.imageUrl.startsWith('placeholder') ? (
                          <img src={scene.imageUrl} className="w-full h-full object-cover" alt="Scene thumbnail" />
                        ) : (
                          <div className="text-[10px] text-slate-500 font-bold flex flex-col items-center">
                            <span className="material-symbols-outlined text-sm">movie_filter</span>
                            分鏡 #{idx + 1} 空白框
                          </div>
                        )}

                        {/* Hover individual play preview button */}
                        {scene.videoUrl && !scene.videoUrl.startsWith('placeholder') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPlayAllIdx(idx);
                              setIsPlayingAll(true);
                            }}
                            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                            title="預覽此分鏡"
                          >
                            <span className="material-symbols-outlined text-white text-2xl font-bold">play_arrow</span>
                          </button>
                        )}
                      </div>

                      {/* Info bar */}
                      <div className="p-2 text-[10px] flex justify-between items-center border-t border-slate-100 bg-slate-50/40">
                        <span className="font-bold text-slate-700 truncate max-w-[120px]">
                          {idx + 1}. {scene.subtitle || '未填寫'}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteScene(idx);
                          }}
                          disabled={activeProject.scenes.length <= 1}
                          className="text-slate-400 hover:text-red-500 disabled:opacity-30 p-0.5"
                          title="刪除分鏡"
                        >
                          <span className="material-symbols-outlined text-xs">close</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Panel: Property & Characters */}
            <div className="grid grid-cols-3 gap-6 flex-1 min-h-0">
              {/* Scene Property Page (Left 2 columns) */}
              <div className="col-span-2 border border-slate-200 rounded-2xl p-5 bg-white space-y-4 shadow-sm">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">分鏡 #{focusedSceneIdx + 1} 屬性設定頁 (Property Page)</span>
                
                {activeProject.scenes[focusedSceneIdx] ? (
                  (() => {
                    const scene = activeProject.scenes[focusedSceneIdx];
                    return (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-bold text-slate-400">場景/背景/地點</span>
                            <input
                              type="text"
                              value={scene.background || ''}
                              onChange={(e) => updateScene(focusedSceneIdx, { background: e.target.value })}
                              className="border border-slate-250 rounded-lg p-2 text-xs bg-white focus:outline-none focus:border-blue-500"
                              placeholder="例如：熱鬧的電腦展展館內"
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-bold text-slate-400">記者/角色運鏡方式</span>
                            <input
                              type="text"
                              value={scene.camera || ''}
                              onChange={(e) => updateScene(focusedSceneIdx, { camera: e.target.value })}
                              className="border border-slate-250 rounded-lg p-2 text-xs bg-white focus:outline-none focus:border-blue-500"
                              placeholder="例如：中景鏡頭，記者面向相機緩慢運鏡"
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-bold text-slate-400">綁定角色</span>
                            <select
                              value={scene.characterId || ''}
                              onChange={(e) => updateScene(focusedSceneIdx, { characterId: e.target.value })}
                              className="border border-slate-250 rounded-lg p-2 text-xs bg-white focus:outline-none focus:border-blue-500"
                            >
                              <option value="">無綁定角色...</option>
                              {activeProject.characters.map(c => <option key={c.id} value={c.id}>{c.name} ({c.role})</option>)}
                            </select>
                          </div>
                        </div>

                        <div className="space-y-3 flex flex-col">
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-bold text-slate-400">口播旁白 (Narration - 最多三句話，直接切入重點)</span>
                            <textarea
                              value={scene.narration}
                              onChange={(e) => updateScene(focusedSceneIdx, { narration: e.target.value })}
                              className="border border-slate-250 rounded-lg p-2 text-xs h-16 resize-none focus:outline-none focus:border-blue-500"
                              placeholder="直接宣告事實，避免社交詞令..."
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-bold text-slate-400">電視畫面字幕 (Subtitle)</span>
                            <input
                              type="text"
                              value={scene.subtitle}
                              onChange={(e) => updateScene(focusedSceneIdx, { subtitle: e.target.value })}
                              className="border border-slate-250 rounded-lg p-2 text-xs bg-white focus:outline-none focus:border-blue-500"
                              placeholder="畫面底部繁中字幕..."
                            />
                          </div>

                          {/* Generation & Library selection */}
                          <div className="grid grid-cols-2 gap-2 mt-auto pt-2 border-t border-slate-100">
                            <button
                              onClick={() => submitSceneImageTask(focusedSceneIdx)}
                              className="py-1.5 bg-slate-100 hover:bg-slate-250 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-extrabold transition-colors"
                            >
                              {scene.imageUrl ? '重新生成首影格' : '1. 生成首影格'}
                            </button>
                            <button
                              onClick={() => submitSceneVideoTask(focusedSceneIdx)}
                              disabled={!scene.imageUrl}
                              className="py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-200 rounded-lg text-[10px] font-extrabold transition-colors disabled:opacity-40"
                            >
                              {scene.videoUrl ? '重新生成影片段' : '2. 生成影片'}
                            </button>
                            <button
                              onClick={() => {
                                onOpenMediaLibrary('image', (url) => {
                                  updateScene(focusedSceneIdx, { imageUrl: url });
                                });
                              }}
                              className="py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-lg text-[10px] font-extrabold transition-colors"
                            >
                              從媒體庫選圖
                            </button>
                            <button
                              onClick={() => {
                                onOpenMediaLibrary('video', (url) => {
                                  updateScene(focusedSceneIdx, { videoUrl: url });
                                });
                              }}
                              className="py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 rounded-lg text-[10px] font-extrabold transition-colors"
                            >
                              引用媒體庫影片
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="text-center py-10 text-slate-400 text-xs">
                    請點選上方時間軸分鏡進行編輯。
                  </div>
                )}
              </div>

              {/* Character Setup Panel (Right 1 column) */}
              <div className="col-span-1 border border-slate-200 rounded-2xl p-5 bg-white flex flex-col gap-4 shadow-sm overflow-y-auto">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">出鏡角色定裝庫</span>
                  <button
                    onClick={handleAddNewCharacter}
                    className="flex items-center gap-0.5 text-blue-600 hover:text-blue-800 text-[10px] font-extrabold"
                  >
                    <span className="material-symbols-outlined text-xs">add</span>
                    新增角色
                  </button>
                </div>

                <div className="space-y-3">
                  {activeProject.characters.map(char => (
                    <div key={char.id} className="border border-slate-150 p-2.5 rounded-xl flex items-center justify-between bg-slate-50/50">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg overflow-hidden bg-slate-200 border border-slate-300">
                          {char.avatarUrl ? (
                            <img src={char.avatarUrl} className="h-full w-full object-cover" alt="avatar" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-slate-400">
                              <span className="material-symbols-outlined text-sm">person</span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[11px] font-bold text-slate-800">{char.name}</span>
                          <span className="text-[8px] bg-slate-200 text-slate-600 px-1 py-0.2 rounded w-max mt-0.5 font-bold">{char.role}</span>
                        </div>
                      </div>

                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setEditingCharacterId(char.id)}
                          className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-250 rounded-lg text-[9px] font-extrabold text-slate-600"
                        >
                          設定
                        </button>
                        <button
                          onClick={() => handleDeleteCharacter(char.id)}
                          className="p-1 text-slate-400 hover:text-red-500"
                        >
                          <span className="material-symbols-outlined text-xs">delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-20 text-center gap-4 text-slate-400">
            <span className="material-symbols-outlined text-5xl text-slate-200">movie</span>
            <div>
              <p className="text-sm font-bold text-slate-700">尚未選取影片專案</p>
              <p className="text-xs text-slate-500 mt-1">請於右上角選單選擇已有專案，或點擊「新建專案」開啟全新電視報導影片製作流程。</p>
            </div>
          </div>
        )}

        {/* Character Setup Modal Drawer */}
        {editingCharacterId && (
          (() => {
            const char = activeProject?.characters.find(c => c.id === editingCharacterId);
            if (!char) return null;
            return (
              <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4 animate-fade-in text-slate-700">
                <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-5 border border-slate-100 flex flex-col gap-4">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <span className="text-xs font-extrabold text-slate-800">角色定裝造型與語音設定 ({char.name})</span>
                    <button onClick={() => setEditingCharacterId(null)} className="text-slate-400 hover:text-slate-600">
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-500">姓名</span>
                      <input
                        type="text"
                        value={char.name}
                        onChange={(e) => updateCharacter(char.id, { name: e.target.value })}
                        className="border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500 bg-white"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-500">角色定位</span>
                      <select
                        value={char.role}
                        onChange={(e) => updateCharacter(char.id, { role: e.target.value })}
                        className="border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500 bg-white"
                      >
                        <option value="記者">記者 (Reporter)</option>
                        <option value="受訪路人">受訪路人 (Bypasser)</option>
                        <option value="當事人">當事人 (Person involved)</option>
                        <option value="專家">專家 (Expert)</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-500">外貌提示詞 (Appearance Prompt)</span>
                      <textarea
                        value={char.description}
                        onChange={(e) => updateCharacter(char.id, { description: e.target.value })}
                        className="border border-slate-200 rounded-lg p-2 text-xs h-16 resize-none focus:outline-none focus:border-blue-500 bg-white"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-500">聲音模型 (Taiwan Accents)</span>
                      <select
                        value={char.voiceModel || 'cmn-TW-Standard-A'}
                        onChange={(e) => updateCharacter(char.id, { voiceModel: e.target.value })}
                        className="border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500 bg-white"
                      >
                        <option value="cmn-TW-Standard-A">標準台灣女聲 (cmn-TW-Standard-A)</option>
                        <option value="cmn-TW-Standard-B">標準台灣男聲 (cmn-TW-Standard-B)</option>
                        <option value="cmn-TW-Wavenet-A">台灣 Wavenet 女聲 (cmn-TW-Wavenet-A)</option>
                        <option value="cmn-TW-Wavenet-B">台灣 Wavenet 男聲 (cmn-TW-Wavenet-B)</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-500">口音與聲音描述提示詞</span>
                      <input
                        type="text"
                        value={char.voicePrompt || ''}
                        onChange={(e) => updateCharacter(char.id, { voicePrompt: e.target.value })}
                        className="border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500 bg-white"
                        placeholder="聲音特色描述，例如：沉穩專業、有條不紊"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-3 border-t border-slate-100">
                    <button
                      onClick={() => setEditingCharacterId(null)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
                    >
                      關閉並套用
                    </button>
                  </div>
                </div>
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
};
