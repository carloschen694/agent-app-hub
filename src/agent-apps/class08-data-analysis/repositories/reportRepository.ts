import type { ReportFile } from '../types/report';

const KEY = 'da_reports_v1';

export function loadReports(): ReportFile[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function saveReports(reports: ReportFile[]): void {
  localStorage.setItem(KEY, JSON.stringify(reports));
}
