export interface TrendsEntry {
  month: string;  // "2023-01" … "2023-12"
  index: number;  // 0-100 Google Trends relative interest
}

export interface KeywordTrends {
  keyword: string;
  monthly: TrendsEntry[];
}

export const TRENDS_DATA: KeywordTrends[] = [
  {
    keyword: 'beverages',
    monthly: [
      { month: '2023-01', index: 55 }, { month: '2023-02', index: 48 },
      { month: '2023-03', index: 52 }, { month: '2023-04', index: 58 },
      { month: '2023-05', index: 65 }, { month: '2023-06', index: 78 },
      { month: '2023-07', index: 85 }, { month: '2023-08', index: 82 },
      { month: '2023-09', index: 70 }, { month: '2023-10', index: 62 },
      { month: '2023-11', index: 72 }, { month: '2023-12', index: 100 },
    ],
  },
  {
    keyword: 'chocolate',
    monthly: [
      { month: '2023-01', index: 60 }, { month: '2023-02', index: 85 },
      { month: '2023-03', index: 45 }, { month: '2023-04', index: 38 },
      { month: '2023-05', index: 32 }, { month: '2023-06', index: 28 },
      { month: '2023-07', index: 30 }, { month: '2023-08', index: 35 },
      { month: '2023-09', index: 48 }, { month: '2023-10', index: 65 },
      { month: '2023-11', index: 82 }, { month: '2023-12', index: 100 },
    ],
  },
  {
    keyword: 'meat',
    monthly: [
      { month: '2023-01', index: 62 }, { month: '2023-02', index: 55 },
      { month: '2023-03', index: 68 }, { month: '2023-04', index: 72 },
      { month: '2023-05', index: 80 }, { month: '2023-06', index: 90 },
      { month: '2023-07', index: 100 }, { month: '2023-08', index: 95 },
      { month: '2023-09', index: 85 }, { month: '2023-10', index: 75 },
      { month: '2023-11', index: 82 }, { month: '2023-12', index: 88 },
    ],
  },
  {
    keyword: 'seafood',
    monthly: [
      { month: '2023-01', index: 55 }, { month: '2023-02', index: 50 },
      { month: '2023-03', index: 60 }, { month: '2023-04', index: 58 },
      { month: '2023-05', index: 52 }, { month: '2023-06', index: 48 },
      { month: '2023-07', index: 45 }, { month: '2023-08', index: 42 },
      { month: '2023-09', index: 55 }, { month: '2023-10', index: 65 },
      { month: '2023-11', index: 75 }, { month: '2023-12', index: 100 },
    ],
  },
  {
    keyword: 'dairy',
    monthly: [
      { month: '2023-01', index: 70 }, { month: '2023-02', index: 65 },
      { month: '2023-03', index: 72 }, { month: '2023-04', index: 75 },
      { month: '2023-05', index: 80 }, { month: '2023-06', index: 85 },
      { month: '2023-07', index: 82 }, { month: '2023-08', index: 78 },
      { month: '2023-09', index: 74 }, { month: '2023-10', index: 76 },
      { month: '2023-11', index: 88 }, { month: '2023-12', index: 100 },
    ],
  },
  {
    keyword: 'organic produce',
    monthly: [
      { month: '2023-01', index: 42 }, { month: '2023-02', index: 48 },
      { month: '2023-03', index: 62 }, { month: '2023-04', index: 75 },
      { month: '2023-05', index: 88 }, { month: '2023-06', index: 92 },
      { month: '2023-07', index: 85 }, { month: '2023-08', index: 80 },
      { month: '2023-09', index: 65 }, { month: '2023-10', index: 55 },
      { month: '2023-11', index: 45 }, { month: '2023-12', index: 38 },
    ],
  },
];
