export interface ReportVersion {
  version: number;
  title: string;
  html: string;
  createdAt: string;
}

export interface ReportFile {
  id: string;
  name: string;
  versions: ReportVersion[];
  currentVersion: number;
}
