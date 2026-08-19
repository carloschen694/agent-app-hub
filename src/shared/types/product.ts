export interface Product {
  id: string;
  category: string;
  brand: string;
  name: string;
  weight: string;
  price: number | null;
  extraDayPrice: number | null;
  deposit: number | null;
  status: string;
  rentalUntil: string;
  reservation: string;
  specs: string;
}
