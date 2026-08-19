/**
 * Screen capture for the live assistant.
 *
 * One long-lived getDisplayMedia stream is held for the whole session so the
 * user grants permission once, instead of being prompted on every frame.
 * Frames are pulled from a hidden <video> on demand.
 *
 * Two modes exist because a 4K screenshot downscaled to ~1024px makes text
 * unreadable:
 *   - full:  whole screen scaled to ~1024px long edge, enough for "what is
 *            the user doing" but not for reading fine print.
 *   - focus: a region cropped at native resolution, so text stays sharp.
 *
 * Note the browser cannot report the OS-level cursor position, so "focus"
 * regions are chosen by the agent from a full frame, not by mouse position.
 */

export const FULL_FRAME_MAX_EDGE = 1024;
export const FOCUS_FRAME_SIZE = 1024;

export interface ScreenSize {
  width: number;
  height: number;
}

export interface CaptureRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

type StateListener = (active: boolean) => void;

let stream: MediaStream | null = null;
let videoElement: HTMLVideoElement | null = null;
const listeners = new Set<StateListener>();

const notify = (active: boolean) => listeners.forEach(listener => listener(active));

export function onCaptureStateChange(listener: StateListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isCapturing(): boolean {
  return Boolean(stream?.getVideoTracks()[0]?.readyState === 'live');
}

export function isCaptureSupported(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getDisplayMedia);
}

export function getScreenSize(): ScreenSize | null {
  if (!videoElement?.videoWidth) return null;
  return { width: videoElement.videoWidth, height: videoElement.videoHeight };
}

export async function startCapture(): Promise<void> {
  if (isCapturing()) return;
  if (!isCaptureSupported()) {
    throw new Error('此瀏覽器不支援螢幕擷取（navigator.mediaDevices.getDisplayMedia）。');
  }

  stream = await navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: 'monitor' },
    audio: false
  });

  const video = document.createElement('video');
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
  videoElement = video;

  // The user can stop sharing from the browser's own bar; when that happens
  // the observer loop and UI must find out, not keep grabbing blank frames.
  stream.getVideoTracks()[0]?.addEventListener('ended', () => {
    stopCapture();
  });

  notify(true);
}

export function stopCapture(): void {
  stream?.getTracks().forEach(track => track.stop());
  stream = null;
  if (videoElement) {
    videoElement.srcObject = null;
    videoElement = null;
  }
  notify(false);
}

function drawToDataUrl(
  source: CanvasImageSource,
  sourceRegion: CaptureRegion,
  targetWidth: number,
  targetHeight: number,
  quality: number
): string {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('無法建立 canvas 繪圖環境。');
  ctx.drawImage(
    source,
    sourceRegion.x,
    sourceRegion.y,
    sourceRegion.width,
    sourceRegion.height,
    0,
    0,
    targetWidth,
    targetHeight
  );
  return canvas.toDataURL('image/jpeg', quality);
}

/** Clamps a requested region so it always sits inside the screen. */
export function clampRegion(region: CaptureRegion, screen: ScreenSize): CaptureRegion {
  const width = Math.max(16, Math.min(Math.round(region.width), screen.width));
  const height = Math.max(16, Math.min(Math.round(region.height), screen.height));
  const x = Math.max(0, Math.min(Math.round(region.x), screen.width - width));
  const y = Math.max(0, Math.min(Math.round(region.y), screen.height - height));
  return { x, y, width, height };
}

/** Whole screen, scaled down to FULL_FRAME_MAX_EDGE on its long edge. */
export function grabFull(quality = 0.7): string {
  if (!videoElement?.videoWidth) throw new Error('螢幕擷取尚未啟動，請先開啟螢幕分享。');
  const { videoWidth: width, videoHeight: height } = videoElement;
  const scale = Math.min(1, FULL_FRAME_MAX_EDGE / Math.max(width, height));
  return drawToDataUrl(
    videoElement,
    { x: 0, y: 0, width, height },
    Math.round(width * scale),
    Math.round(height * scale),
    quality
  );
}

/**
 * A region of the screen at native pixel density (no downscale), which is
 * what keeps small text legible for translation and OCR-style reading.
 */
export function grabCrop(region: CaptureRegion, quality = 0.9): string {
  if (!videoElement?.videoWidth) throw new Error('螢幕擷取尚未啟動，請先開啟螢幕分享。');
  const screen = { width: videoElement.videoWidth, height: videoElement.videoHeight };
  const clamped = clampRegion(region, screen);
  return drawToDataUrl(videoElement, clamped, clamped.width, clamped.height, quality);
}

/** Centre-cropped FOCUS_FRAME_SIZE square, used when no region is given. */
export function grabCenterFocus(quality = 0.9): string {
  if (!videoElement?.videoWidth) throw new Error('螢幕擷取尚未啟動，請先開啟螢幕分享。');
  const screen = { width: videoElement.videoWidth, height: videoElement.videoHeight };
  const size = Math.min(FOCUS_FRAME_SIZE, screen.width, screen.height);
  return grabCrop(
    {
      x: Math.round((screen.width - size) / 2),
      y: Math.round((screen.height - size) / 2),
      width: size,
      height: size
    },
    quality
  );
}
