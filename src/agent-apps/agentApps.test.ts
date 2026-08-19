import { describe, it, expect } from 'vitest';
import { agentAppRegistry } from '../config/agentAppRegistry';

describe('Agent Apps Registry validation', () => {
  it('should have at least one registered agent app', () => {
    expect(agentAppRegistry.length).toBeGreaterThan(0);
  });

  it('should sort registered apps in the expected order', () => {
    const expectedOrder = [
      'dashboard',
      'class02-ai-chat-assistant',
      'class03-camping-markdown',
      'class04-camping-tools-rag',
      'class07-price-comparison',
      'class08-data-analysis',
      'class09-proposal',
      'class10-live-assistance',
      'class11-article-writer'
    ];
    const registeredOrder = agentAppRegistry.map(app => app.agentAppId);
    const intersection = registeredOrder.filter(id => expectedOrder.includes(id));
    expect(intersection).toEqual(expectedOrder.filter(id => registeredOrder.includes(id)));
  });

  agentAppRegistry.forEach((app) => {
    describe(`Agent App: ${app.agentAppName} (${app.agentAppId})`, () => {
      it('should have valid basic metadata', () => {
        expect(app.agentAppId).toBeDefined();
        expect(app.agentAppId.length).toBeGreaterThan(0);
        expect(app.agentAppName).toBeDefined();
        expect(app.agentAppName.length).toBeGreaterThan(0);
        expect(app.route).toBeDefined();
        expect(app.route.length).toBeGreaterThan(0);
      });

      it('should have a system prompt', () => {
        expect(app.systemPrompt).toBeDefined();
        expect(app.systemPrompt.length).toBeGreaterThan(0);
      });

      it('should have a valid MainView component', () => {
        expect(app.MainView).toBeDefined();
        // React components can be functions or objects (memo, forwardRef, etc.)
        expect(typeof app.MainView === 'function' || typeof app.MainView === 'object').toBe(true);
      });

      if (app.availableTools) {
        it('should have valid tool definitions', () => {
          expect(Array.isArray(app.availableTools)).toBe(true);
          app.availableTools.forEach((tool) => {
            expect(tool.name).toBeDefined();
            expect(tool.name.length).toBeGreaterThan(0);
            expect(tool.description).toBeDefined();
            expect(tool.description.length).toBeGreaterThan(0);
          });
        });
      }
    });
  });
});
