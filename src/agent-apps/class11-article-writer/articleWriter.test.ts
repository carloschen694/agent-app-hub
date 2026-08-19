// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { GenerationMode } from './services/mediaGenerationService';
import { agentAppManifest } from './agentAppManifest';
import { updateMedia, syncHtmlToMeta } from './ArticleWriterPage';
import type { Article } from './types';

describe('class11-article-writer multimedia settings', () => {
  it('should export correct GenerationMode options', () => {
    expect(GenerationMode.TEXT_TO_VIDEO).toBe('TEXT_TO_VIDEO');
    expect(GenerationMode.FRAMES_TO_VIDEO).toBe('FRAMES_TO_VIDEO');
    expect(GenerationMode.REFERENCES_TO_VIDEO).toBe('REFERENCES_TO_VIDEO');
    expect(GenerationMode.EXTEND_VIDEO).toBe('EXTEND_VIDEO');
  });

  it('should register custom tools for collecting and adding related photos', () => {
    const tools = agentAppManifest.availableTools;
    
    const collectTool = tools.find(t => t.name === 'collect_related_photos');
    expect(collectTool).toBeDefined();
    expect(collectTool?.parameters.properties.query).toBeDefined();

    const addTool = tools.find(t => t.name === 'add_web_photo_to_library');
    expect(addTool).toBeDefined();
    expect(addTool?.parameters.properties.url).toBeDefined();
    expect(addTool?.parameters.properties.alt).toBeDefined();
  });
});

describe('class11-article-writer state sync utilities', () => {
  const dummyArticle: Article = {
    id: 'test-article-1',
    title: 'Original Title',
    subtitle: 'Original Subtitle',
    content: 'Some content',
    covers: {
      square: { url: '', alt: '', isPlaceholder: true, placeholderId: 'sq-1', type: 'image' },
      landscape: { url: '', alt: '', isPlaceholder: true, placeholderId: 'ls-1', type: 'image' },
      portrait: { url: '', alt: '', isPlaceholder: true, placeholderId: 'pt-1', type: 'image' }
    },
    photos: [],
    video: null,
    html: '',
    meta: {
      topic: '',
      keywords: [],
      topicGuideline: '',
      visualStyleGuideline: ''
    },
    sources: [],
    updatedAt: '',
    createdAt: ''
  };

  beforeEach(() => {
    localStorage.clear();
  });

  describe('syncHtmlToMeta', () => {
    it('should extract title and subtitle from HTML', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>New Title</title></head>
          <body>
            <h1>New Title</h1>
            <div class="subtitle">New Subtitle</div>
          </body>
        </html>
      `;
      const updates = syncHtmlToMeta(html, dummyArticle);
      expect(updates.title).toBe('New Title');
      expect(updates.subtitle).toBe('New Subtitle');
    });

    it('should register new placeholder images from HTML', () => {
      const html = `
        <div>
          <img id="img-new-1" src="placeholder://image/img-new-1" alt="A cute dog" />
        </div>
      `;
      const updates = syncHtmlToMeta(html, dummyArticle);
      expect(updates.photos).toBeDefined();
      expect(updates.photos!.length).toBe(1);
      expect(updates.photos![0].placeholderId).toBe('img-new-1');
      expect(updates.photos![0].alt).toBe('A cute dog');
    });

    it('should register background image placeholders from HTML', () => {
      const html = `
        <div id="bg-task-1" class="with-placeholder-background" style="background-image: url('placeholder://image/bg-task-1')" alt="Background scenery"></div>
      `;
      const updates = syncHtmlToMeta(html, dummyArticle);
      expect(updates.photos).toBeDefined();
      expect(updates.photos!.length).toBe(1);
      expect(updates.photos![0].placeholderId).toBe('bg-task-1');
      expect(updates.photos![0].alt).toBe('Background scenery');
    });
  });

  describe('updateMedia', () => {
    it('should replace ready media placeholders in HTML', () => {
      const html = `
        <div>
          <img id="img-ready-1" src="placeholder://image/img-ready-1" alt="A cute cat" />
          <img id="img-pending-1" src="placeholder://image/img-pending-1" alt="A running dog" />
        </div>
      `;

      // Save a completed media item in class11_global_media
      const savedMedia = [
        {
          id: 'img-ready-1',
          placeholderId: 'img-ready-1',
          url: 'blob:http://localhost:5173/uuid-1234',
          isPlaceholder: false,
          type: 'image',
          alt: 'A cute cat'
        }
      ];
      localStorage.setItem('class11_global_media', JSON.stringify(savedMedia));

      const updatedHtml = updateMedia(html);
      expect(updatedHtml).toContain('src="blob:http://localhost:5173/uuid-1234"');
      expect(updatedHtml).toContain('src="placeholder://image/img-pending-1"');
    });

    it('should replace background image placeholder in inline style for with-placeholder-background elements', () => {
      const html = `
        <div id="bg-1" class="with-placeholder-background" style="background-image: url('placeholder://image/bg-1')"></div>
      `;
      const savedMedia = [
        {
          id: 'bg-1',
          placeholderId: 'bg-1',
          url: 'blob:http://localhost:5173/bg-url-123',
          isPlaceholder: false,
          type: 'image'
        }
      ];
      localStorage.setItem('class11_global_media', JSON.stringify(savedMedia));

      const updatedHtml = updateMedia(html);
      expect(updatedHtml).toContain('style="background-image: url(\'blob:http://localhost:5173/bg-url-123\')"');
    });

    it('should update targeted placeholderId only if specified', () => {
      const html = `
        <div>
          <img id="img-1" src="placeholder://image/img-1" alt="Cat" />
          <img id="img-2" src="placeholder://image/img-2" alt="Dog" />
        </div>
      `;

      const savedMedia = [
        { id: 'img-1', placeholderId: 'img-1', url: 'blob:url-1', isPlaceholder: false, type: 'image' },
        { id: 'img-2', placeholderId: 'img-2', url: 'blob:url-2', isPlaceholder: false, type: 'image' }
      ];
      localStorage.setItem('class11_global_media', JSON.stringify(savedMedia));

      const updatedHtml = updateMedia(html, 'img-1');
      expect(updatedHtml).toContain('src="blob:url-1"');
      expect(updatedHtml).toContain('src="placeholder://image/img-2"'); // remains unchanged because we targeted img-1 only
    });
  });
});
