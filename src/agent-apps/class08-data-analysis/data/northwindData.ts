export interface MonthlySales {
  month: string; // "2023-01" … "2023-12"
  sales: number; // USD
}

export interface CategorySales {
  category: string;
  monthly: MonthlySales[];
  annualTotal: number;
}

export const NORTHWIND_CATEGORIES: CategorySales[] = [
  {
    category: 'Beverages',
    monthly: [
      { month: '2023-01', sales: 42300 }, { month: '2023-02', sales: 38100 },
      { month: '2023-03', sales: 45200 }, { month: '2023-04', sales: 41800 },
      { month: '2023-05', sales: 47500 }, { month: '2023-06', sales: 50200 },
      { month: '2023-07', sales: 55800 }, { month: '2023-08', sales: 53400 },
      { month: '2023-09', sales: 48900 }, { month: '2023-10', sales: 46700 },
      { month: '2023-11', sales: 58200 }, { month: '2023-12', sales: 72100 },
    ],
    annualTotal: 600200,
  },
  {
    category: 'Condiments',
    monthly: [
      { month: '2023-01', sales: 18400 }, { month: '2023-02', sales: 17200 },
      { month: '2023-03', sales: 20100 }, { month: '2023-04', sales: 19500 },
      { month: '2023-05', sales: 22300 }, { month: '2023-06', sales: 21700 },
      { month: '2023-07', sales: 23100 }, { month: '2023-08', sales: 24500 },
      { month: '2023-09', sales: 21800 }, { month: '2023-10', sales: 20400 },
      { month: '2023-11', sales: 25600 }, { month: '2023-12', sales: 29800 },
    ],
    annualTotal: 264400,
  },
  {
    category: 'Confections',
    monthly: [
      { month: '2023-01', sales: 25100 }, { month: '2023-02', sales: 28700 },
      { month: '2023-03', sales: 24300 }, { month: '2023-04', sales: 22100 },
      { month: '2023-05', sales: 19800 }, { month: '2023-06', sales: 18500 },
      { month: '2023-07', sales: 20200 }, { month: '2023-08', sales: 21600 },
      { month: '2023-09', sales: 24900 }, { month: '2023-10', sales: 28300 },
      { month: '2023-11', sales: 38700 }, { month: '2023-12', sales: 51200 },
    ],
    annualTotal: 343400,
  },
  {
    category: 'Dairy Products',
    monthly: [
      { month: '2023-01', sales: 35600 }, { month: '2023-02', sales: 33200 },
      { month: '2023-03', sales: 37800 }, { month: '2023-04', sales: 36100 },
      { month: '2023-05', sales: 38900 }, { month: '2023-06', sales: 40200 },
      { month: '2023-07', sales: 39500 }, { month: '2023-08', sales: 38100 },
      { month: '2023-09', sales: 37400 }, { month: '2023-10', sales: 39800 },
      { month: '2023-11', sales: 44600 }, { month: '2023-12', sales: 48900 },
    ],
    annualTotal: 470100,
  },
  {
    category: 'Grains/Cereals',
    monthly: [
      { month: '2023-01', sales: 15800 }, { month: '2023-02', sales: 14500 },
      { month: '2023-03', sales: 16900 }, { month: '2023-04', sales: 15400 },
      { month: '2023-05', sales: 17200 }, { month: '2023-06', sales: 16800 },
      { month: '2023-07', sales: 15500 }, { month: '2023-08', sales: 16100 },
      { month: '2023-09', sales: 17800 }, { month: '2023-10', sales: 18500 },
      { month: '2023-11', sales: 20200 }, { month: '2023-12', sales: 22100 },
    ],
    annualTotal: 206800,
  },
  {
    category: 'Meat/Poultry',
    monthly: [
      { month: '2023-01', sales: 48200 }, { month: '2023-02', sales: 45100 },
      { month: '2023-03', sales: 52300 }, { month: '2023-04', sales: 49800 },
      { month: '2023-05', sales: 54100 }, { month: '2023-06', sales: 57600 },
      { month: '2023-07', sales: 61200 }, { month: '2023-08', sales: 58900 },
      { month: '2023-09', sales: 55400 }, { month: '2023-10', sales: 52700 },
      { month: '2023-11', sales: 63800 }, { month: '2023-12', sales: 71400 },
    ],
    annualTotal: 670500,
  },
  {
    category: 'Produce',
    monthly: [
      { month: '2023-01', sales: 22100 }, { month: '2023-02', sales: 24500 },
      { month: '2023-03', sales: 28700 }, { month: '2023-04', sales: 32100 },
      { month: '2023-05', sales: 35800 }, { month: '2023-06', sales: 34200 },
      { month: '2023-07', sales: 31500 }, { month: '2023-08', sales: 29800 },
      { month: '2023-09', sales: 26400 }, { month: '2023-10', sales: 23900 },
      { month: '2023-11', sales: 21300 }, { month: '2023-12', sales: 19800 },
    ],
    annualTotal: 330100,
  },
  {
    category: 'Seafood',
    monthly: [
      { month: '2023-01', sales: 31400 }, { month: '2023-02', sales: 29800 },
      { month: '2023-03', sales: 33200 }, { month: '2023-04', sales: 30500 },
      { month: '2023-05', sales: 28900 }, { month: '2023-06', sales: 27600 },
      { month: '2023-07', sales: 26100 }, { month: '2023-08', sales: 25400 },
      { month: '2023-09', sales: 28700 }, { month: '2023-10', sales: 32100 },
      { month: '2023-11', sales: 35800 }, { month: '2023-12', sales: 41200 },
    ],
    annualTotal: 370700,
  },
];
