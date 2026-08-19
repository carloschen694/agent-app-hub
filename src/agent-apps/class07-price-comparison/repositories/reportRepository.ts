export interface ReportVersion {
  id: string;
  html: string;
  timestamp: number;
  description: string;
}

export interface ComparisonReport {
  id: string;
  name: string;
  versions: ReportVersion[];
  currentVersionId: string;
  createdAt: number;
  updatedAt: number;
}

const REPORTS_KEY = 'class07_price_comparison_reports';

export const reportRepository = {
  getReports(): ComparisonReport[] {
    try {
      const stored = localStorage.getItem(REPORTS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error reading reports from localStorage', e);
    }
    return [];
  },

  saveReports(reports: ComparisonReport[]): void {
    try {
      localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
    } catch (e) {
      console.error('Error saving reports to localStorage', e);
    }
  },

  getReportById(id: string): ComparisonReport | undefined {
    const list = this.getReports();
    return list.find(r => r.id === id);
  },

  createReport(name: string, html: string, versionDesc = 'AI 初始化'): ComparisonReport {
    const reports = this.getReports();
    const id = `report_${Date.now()}`;
    const versionId = `v_${Date.now()}`;
    
    const newVersion: ReportVersion = {
      id: versionId,
      html,
      timestamp: Date.now(),
      description: versionDesc
    };

    const newReport: ComparisonReport = {
      id,
      name,
      versions: [newVersion],
      currentVersionId: versionId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    reports.unshift(newReport);
    this.saveReports(reports);
    return newReport;
  },

  addReportVersion(reportId: string, html: string, versionDesc: string): ComparisonReport | undefined {
    const reports = this.getReports();
    const reportIndex = reports.findIndex(r => r.id === reportId);
    if (reportIndex < 0) return undefined;

    const report = reports[reportIndex];
    const versionId = `v_${Date.now()}`;
    const newVersion: ReportVersion = {
      id: versionId,
      html,
      timestamp: Date.now(),
      description: versionDesc
    };

    // Append new version
    const updatedVersions = [...report.versions, newVersion];
    const updatedReport: ComparisonReport = {
      ...report,
      versions: updatedVersions,
      currentVersionId: versionId,
      updatedAt: Date.now()
    };

    reports[reportIndex] = updatedReport;
    this.saveReports(reports);
    return updatedReport;
  },

  deleteReport(id: string): void {
    const reports = this.getReports();
    const filtered = reports.filter(r => r.id !== id);
    this.saveReports(filtered);
  },

  renameReport(id: string, newName: string): ComparisonReport | undefined {
    const reports = this.getReports();
    const index = reports.findIndex(r => r.id === id);
    if (index < 0) return undefined;

    const updated = { ...reports[index], name: newName, updatedAt: Date.now() };
    reports[index] = updated;
    this.saveReports(reports);
    return updated;
  },

  switchVersion(reportId: string, versionId: string): ComparisonReport | undefined {
    const reports = this.getReports();
    const index = reports.findIndex(r => r.id === reportId);
    if (index < 0) return undefined;

    const updated = { ...reports[index], currentVersionId: versionId, updatedAt: Date.now() };
    reports[index] = updated;
    this.saveReports(reports);
    return updated;
  }
};
