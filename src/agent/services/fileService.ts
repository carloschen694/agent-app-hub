import type { MessageAttachment } from '../types/message';

const imageMimeTypes = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif'
]);

export function isImageAttachment(file: File): boolean {
  return imageMimeTypes.has(file.type);
}

export function fileToAttachment(file: File): Promise<MessageAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file.'));
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;

      resolve({
        id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        dataUrl,
        base64Data
      });
    };

    reader.readAsDataURL(file);
  });
}

export async function filesToAttachments(files: FileList | File[]): Promise<MessageAttachment[]> {
  return Promise.all(Array.from(files).map(fileToAttachment));
}

export function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
