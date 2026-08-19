import { describe, it, expect, beforeAll } from 'vitest';
import { reportRepository } from './repositories/reportRepository';

describe('class07-price-comparison reportRepository', () => {
  beforeAll(() => {
    let store: Record<string, string> = {};
    global.localStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => { store[key] = String(value); },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { store = {}; },
      length: 0,
      key: (index: number) => Object.keys(store)[index] || null
    };
  });

  it('should support creating and retrieving price reports', () => {
    localStorage.clear();
    const rep = reportRepository.createReport('Camp Gear Compare', '<div>Table</div>');
    expect(rep.id).toBeDefined();
    expect(rep.name).toBe('Camp Gear Compare');

    const reports = reportRepository.getReports();
    expect(reports.length).toBe(1);
    expect(reports[0].id).toBe(rep.id);

    const match = reportRepository.getReportById(rep.id);
    expect(match).toBeDefined();
    expect(match?.name).toBe('Camp Gear Compare');
  });
});
