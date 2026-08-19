import type { AgentTool, ToolResult } from '../../../agent/types/tool';
import { productService } from '../services/productService';

/**
 * 商品相關 Tool（Function Calling）。
 *
 * 每個 Tool 均遵循 §22 規範：name / description / parameters / handler / return type / error handling。
 * `calculate_rental_price` 的金額計算固定在 handler 內以程式碼執行，不交由模型自行心算。
 */
export const productTools: AgentTool[] = [
  {
    name: 'get_products',
    description: '取得所有可租借商品的完整清單，包含名稱、分類、類型、租金、押金、狀態與規格。',
    parameters: { type: 'object', properties: {} },
    handler: (): ToolResult => {
      try {
        return { ok: true, data: productService.getAllProducts() };
      } catch (err) {
        return { ok: false, error: `查詢商品清單失敗：${(err as Error).message}` };
      }
    },
  },
  {
    name: 'get_categories',
    description: '取得所有商品分類清單（例如：背包、帳篷、睡袋、睡墊、電子配件）。',
    parameters: { type: 'object', properties: {} },
    handler: (): ToolResult => {
      try {
        return { ok: true, data: productService.getCategories() };
      } catch (err) {
        return { ok: false, error: `查詢分類失敗：${(err as Error).message}` };
      }
    },
  },
  {
    name: 'search_products',
    description: '依關鍵字搜尋商品名稱、類型或分類（模糊比對）。',
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '搜尋關鍵字，例如商品名稱片段或型號' },
      },
      required: ['keyword'],
    },
    handler: (args): ToolResult => {
      try {
        const keyword = String(args.keyword ?? '');
        if (!keyword.trim()) return { ok: false, error: 'keyword 不可為空字串' };
        return { ok: true, data: productService.searchByKeyword(keyword) };
      } catch (err) {
        return { ok: false, error: `搜尋商品失敗：${(err as Error).message}` };
      }
    },
  },
  {
    name: 'get_product_detail',
    description: '依商品 ID 取得單一商品的完整詳情，包含規格 info 欄位。',
    parameters: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: '商品的唯一識別碼，例如 UT003' },
      },
      required: ['product_id'],
    },
    handler: (args): ToolResult => {
      try {
        const productId = String(args.product_id ?? '');
        const product = productService.getById(productId);
        if (!product) return { ok: false, error: `找不到商品 ID：${productId}` };
        return { ok: true, data: product };
      } catch (err) {
        return { ok: false, error: `查詢商品詳情失敗：${(err as Error).message}` };
      }
    },
  },
  {
    name: 'get_products_by_category_name',
    description: '依分類名稱取得該分類下的所有商品（例如：帳篷、睡袋）。',
    parameters: {
      type: 'object',
      properties: {
        category_name: { type: 'string', description: '分類名稱，例如「帳篷」' },
      },
      required: ['category_name'],
    },
    handler: (args): ToolResult => {
      try {
        const categoryName = String(args.category_name ?? '');
        if (!categoryName.trim()) return { ok: false, error: 'category_name 不可為空字串' };
        return { ok: true, data: productService.getByCategoryName(categoryName) };
      } catch (err) {
        return { ok: false, error: `依分類查詢商品失敗：${(err as Error).message}` };
      }
    },
  },
  {
    name: 'get_products_by_price_range',
    description: '依價格區間（基本租金）取得符合條件的商品清單。',
    parameters: {
      type: 'object',
      properties: {
        min_price: { type: 'number', description: '最低租金（含）' },
        max_price: { type: 'number', description: '最高租金（含）' },
      },
      required: ['min_price', 'max_price'],
    },
    handler: (args): ToolResult => {
      try {
        const minPrice = Number(args.min_price);
        const maxPrice = Number(args.max_price);
        if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice)) {
          return { ok: false, error: 'min_price 與 max_price 必須為數字' };
        }
        return { ok: true, data: productService.getByPriceRange(minPrice, maxPrice) };
      } catch (err) {
        return { ok: false, error: `依價格區間查詢商品失敗：${(err as Error).message}` };
      }
    },
  },
  {
    name: 'calculate_rental_price',
    description:
      '計算指定商品租借指定天數的總租金與押金。計算公式（依服務規章，基本租金涵蓋兩天一夜）：基本租金 + (租借天數 - 2) x 每日加價。此計算由程式碼精確執行，請勿自行心算金額。',
    parameters: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: '商品的唯一識別碼' },
        rental_days: { type: 'integer', description: '租借天數，至少為 1' },
      },
      required: ['product_id', 'rental_days'],
    },
    handler: (args): ToolResult => {
      try {
        const productId = String(args.product_id ?? '');
        const rentalDays = Number(args.rental_days);
        if (!Number.isFinite(rentalDays) || rentalDays < 1) {
          return { ok: false, error: 'rental_days 必須為大於等於 1 的整數' };
        }
        const result = productService.calculateRentalPrice(productId, rentalDays);
        if (!result) return { ok: false, error: `找不到商品 ID：${productId}` };
        return { ok: true, data: result };
      } catch (err) {
        return { ok: false, error: `計算租金失敗：${(err as Error).message}` };
      }
    },
  },
  {
    name: 'get_inventory_summary',
    description: '取得庫存總覽，包含總數、可租借數、租借中數，並依分類細分。',
    parameters: { type: 'object', properties: {} },
    handler: (): ToolResult => {
      try {
        return { ok: true, data: productService.getInventorySummary() };
      } catch (err) {
        return { ok: false, error: `查詢庫存總覽失敗：${(err as Error).message}` };
      }
    },
  },
];
