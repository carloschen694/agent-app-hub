import { describe, it, expect } from 'vitest';
import { dataAnalysisTools } from './tools/dataAnalysisTools';

describe('class08-data-analysis tools validation', () => {
  it('should export an array of tools', () => {
    expect(Array.isArray(dataAnalysisTools)).toBe(true);
    expect(dataAnalysisTools.length).toBeGreaterThan(0);
  });

  it('should contain expected data analysis tools', () => {
    const names = dataAnalysisTools.map(t => t.name);
    expect(names).toContain('listTables');
    expect(names).toContain('describeTable');
    expect(names).toContain('listRelationships');
    expect(names).toContain('previewTable');
  });
});
