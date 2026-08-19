import productsData from '../data/products.json';
import type { Product, ProductsFile } from '../types/product';

const products: Product[] = (productsData as ProductsFile).products;

function getCategory(product: Product): string {
  return product.source_category ?? '未分類';
}

function getBasePrice(product: Product): number {
  return product.pricing.base_rental ?? 0;
}

function getExtraDayPrice(product: Product): number {
  return product.pricing.extra_day ?? 0;
}

function getDeposit(product: Product): number {
  return product.pricing.deposit ?? 0;
}

export function getInventoryStatus(product: Product): 'available' | 'rented' | 'cleaning' | 'unavailable' {
  const listingStatus = product.inventory.listing_status ?? '';
  if (listingStatus.includes('送洗')) return 'cleaning';
  if (listingStatus.includes('未到') || listingStatus.includes('下架') || listingStatus.includes('停售')) return 'unavailable';
  if (product.inventory.rental_until) return 'rented';
  return 'available';
}

function getAllProducts(): Product[] {
  return products;
}

function getCategories(): string[] {
  return Array.from(new Set(products.map(getCategory)));
}

function searchByKeyword(keyword: string): Product[] {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return [];
  return products.filter((p) => p.search.normalized_text.includes(kw) || p.search.tokens.some((token) => token.includes(kw)));
}

function getById(productId: string): Product | undefined {
  return products.find((p) => p.id === productId);
}

function getByCategoryName(categoryName: string): Product[] {
  const name = categoryName.trim();
  return products.filter((p) => getCategory(p) === name || getCategory(p).includes(name));
}

function getByPriceRange(minPrice: number, maxPrice: number): Product[] {
  return products.filter((p) => getBasePrice(p) >= minPrice && getBasePrice(p) <= maxPrice);
}

function calculateRentalPrice(
  productId: string,
  rentalDays: number,
): { product: Product; rentalDays: number; basePrice: number; extraDayPrice: number; extraDays: number; totalRentalFee: number; deposit: number } | null {
  const product = getById(productId);
  if (!product) return null;
  if (!Number.isFinite(rentalDays) || rentalDays < 1) return null;

  const extraDays = Math.max(0, Math.floor(rentalDays) - 2);
  const basePrice = getBasePrice(product);
  const extraDayPrice = getExtraDayPrice(product);
  const deposit = getDeposit(product);
  const totalRentalFee = basePrice + extraDays * extraDayPrice;

  return {
    product,
    rentalDays: Math.floor(rentalDays),
    basePrice,
    extraDayPrice,
    extraDays,
    totalRentalFee,
    deposit,
  };
}

function getInventorySummary() {
  const total = products.length;
  const available = products.filter((p) => getInventoryStatus(p) === 'available').length;
  const rented = products.filter((p) => getInventoryStatus(p) === 'rented').length;

  const byCategory = getCategories().map((category) => {
    const items = products.filter((p) => getCategory(p) === category);
    return {
      category,
      total: items.length,
      available: items.filter((p) => getInventoryStatus(p) === 'available').length,
      rented: items.filter((p) => getInventoryStatus(p) === 'rented').length,
      cleaning: items.filter((p) => getInventoryStatus(p) === 'cleaning').length,
      unavailable: items.filter((p) => getInventoryStatus(p) === 'unavailable').length,
    };
  });

  const cleaning = products.filter((p) => getInventoryStatus(p) === 'cleaning').length;
  const unavailable = products.filter((p) => getInventoryStatus(p) === 'unavailable').length;

  return { total, available, rented, cleaning, unavailable, byCategory };
}

export const productService = {
  getAllProducts,
  getCategories,
  searchByKeyword,
  getById,
  getByCategoryName,
  getByPriceRange,
  calculateRentalPrice,
  getInventorySummary,
  getInventoryStatus,
};
