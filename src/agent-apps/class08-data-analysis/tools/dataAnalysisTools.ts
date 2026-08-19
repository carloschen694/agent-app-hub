import type { AgentTool } from '../../../agent/types/tool';
import { NORTHWIND_CATEGORIES, type CategorySales } from '../data/northwindData';
import { TRENDS_DATA } from '../data/trendsData';
import { sandboxStore } from '../store/sandboxStore';

const DEFAULT_API_BASE_URL = 'https://gemini.printii.com/northwind/api';
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

interface CategoryMonthlySalesRow {
  category: string;
  month: string;
  sales: number;
}

interface RpcReadOnlySqlResult {
  rowCount: number;
  rows: Record<string, unknown>[];
  executedSql: string;
  limit: number;
}

const ALLOWED_PREVIEW_TABLES = new Set([
  'categories',
  'products',
  'suppliers',
  'customers',
  'orders',
  'order_details',
  'employees',
  'shippers',
  'category_monthly_sales',
  'product_inventory_status',
]);

function getBaseUrl(args: Record<string, unknown>): string {
  return ((args.apiBaseUrl as string | undefined) || DEFAULT_API_BASE_URL).replace(/\/+$/, '');
}

function clampLimit(value: unknown, fallback = DEFAULT_LIMIT): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), MAX_LIMIT);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function optionalDate(value: unknown): string | undefined {
  const text = optionalString(value);
  if (!text) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : undefined;
}

function encodeFilter(column: string, value: string): string {
  return `${encodeURIComponent(column)}=eq.${encodeURIComponent(value)}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return (await res.json()) as T;
}

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} for ${url}${text ? `: ${text}` : ''}`);
  }
  return (await res.json()) as T;
}

function groupByCategory(rows: CategoryMonthlySalesRow[]): CategorySales[] {
  const map = new Map<string, CategorySales>();
  for (const row of rows) {
    if (!map.has(row.category)) {
      map.set(row.category, { category: row.category, monthly: [], annualTotal: 0 });
    }
    const entry = map.get(row.category)!;
    entry.monthly.push({ month: row.month, sales: Number(row.sales) });
    entry.annualTotal += Number(row.sales);
  }
  return [...map.values()];
}

function appendDateWhere(conditions: string[], startDate?: string, endDate?: string, column = 'o.order_date') {
  if (startDate) conditions.push(`${column} >= '${startDate}'`);
  if (endDate) conditions.push(`${column} <= '${endDate}'`);
}

async function runReadOnlySqlViaApi(
  apiBaseUrl: string,
  sql: string,
  limit = DEFAULT_LIMIT,
): Promise<RpcReadOnlySqlResult> {
  const raw = await postJson<RpcReadOnlySqlResult | RpcReadOnlySqlResult[]>(
    `${apiBaseUrl}/rpc/run_read_only_sql`,
    { sql_text: sql, row_limit: clampLimit(limit) },
  );
  return Array.isArray(raw) ? raw[0] : raw;
}

function makeError(error: unknown, apiBaseUrl: string) {
  return {
    error: `無法連線資料庫 API（${apiBaseUrl}）：${error instanceof Error ? error.message : String(error)}。請確認網路連線是否正常。`,
  };
}

export const dataAnalysisTools: AgentTool[] = [
  {
    name: 'listTables',
    description: '列出 Agent 可以查詢的 Northwind 資料表與分析 View，協助判斷有哪些資料可用。',
    parameters: {
      type: 'object',
      properties: {
        apiBaseUrl: {
          type: 'string',
          description: `可選。資料庫 REST API 網址。未填時使用 ${DEFAULT_API_BASE_URL}。`,
        },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const baseUrl = getBaseUrl(args);
      try {
        const rows = await fetchJson<Record<string, unknown>[]>(`${baseUrl}/analysis_tables?order=table_name.asc`);
        return { source: 'live', count: rows.length, data: rows };
      } catch (error) {
        return makeError(error, baseUrl);
      }
    },
  },
  {
    name: 'describeTable',
    description: '查看指定資料表或 View 的欄位、型別與分析提示，讓 Agent 能依需求選欄位與組查詢。',
    parameters: {
      type: 'object',
      properties: {
        tableName: {
          type: 'string',
          description: '資料表或 View 名稱，例如 orders、order_details、products、customers。',
        },
        apiBaseUrl: {
          type: 'string',
          description: `可選。資料庫 REST API 網址。未填時使用 ${DEFAULT_API_BASE_URL}。`,
        },
      },
      required: ['tableName'],
    },
    handler: async (args: Record<string, unknown>) => {
      const baseUrl = getBaseUrl(args);
      const tableName = optionalString(args.tableName);
      if (!tableName) return { error: '請提供 tableName。' };
      try {
        const rows = await fetchJson<Record<string, unknown>[]>(
          `${baseUrl}/analysis_columns?${encodeFilter('table_name', tableName)}&order=column_name.asc`,
        );
        return { source: 'live', tableName, count: rows.length, data: rows };
      } catch (error) {
        return makeError(error, baseUrl);
      }
    },
  },
  {
    name: 'listRelationships',
    description: '列出常用資料表關聯，協助 Agent 自行 JOIN 訂單、客戶、產品、業務員、供應商與物流商。',
    parameters: {
      type: 'object',
      properties: {
        apiBaseUrl: {
          type: 'string',
          description: `可選。資料庫 REST API 網址。未填時使用 ${DEFAULT_API_BASE_URL}。`,
        },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const baseUrl = getBaseUrl(args);
      try {
        const rows = await fetchJson<Record<string, unknown>[]>(`${baseUrl}/analysis_relationships`);
        return { source: 'live', count: rows.length, data: rows };
      } catch (error) {
        return makeError(error, baseUrl);
      }
    },
  },
  {
    name: 'previewTable',
    description: '預覽指定資料表或 View 的幾筆資料，讓 Agent 看懂欄位內容與資料長相。',
    parameters: {
      type: 'object',
      properties: {
        tableName: {
          type: 'string',
          description: '資料表或 View 名稱。允許：categories、products、suppliers、customers、orders、order_details、employees、shippers、category_monthly_sales、product_inventory_status。',
        },
        limit: {
          type: 'number',
          description: '回傳筆數，1-500，預設 20。',
        },
        apiBaseUrl: {
          type: 'string',
          description: `可選。資料庫 REST API 網址。未填時使用 ${DEFAULT_API_BASE_URL}。`,
        },
      },
      required: ['tableName'],
    },
    handler: async (args: Record<string, unknown>) => {
      const baseUrl = getBaseUrl(args);
      const tableName = optionalString(args.tableName);
      if (!tableName) return { error: '請提供 tableName。' };
      if (!ALLOWED_PREVIEW_TABLES.has(tableName)) {
        return { error: `不允許預覽資料表 "${tableName}"。請先用 listTables 查看可用清單。` };
      }
      try {
        const limit = clampLimit(args.limit, 20);
        const rows = await fetchJson<Record<string, unknown>[]>(`${baseUrl}/${tableName}?limit=${limit}`);
        return { source: 'live', tableName, count: rows.length, data: rows };
      } catch (error) {
        return makeError(error, baseUrl);
      }
    },
  },
  {
    name: 'runReadOnlySql',
    description: `執行唯讀 SQL，讓 Agent 可依使用者問題自行組裝資料。
只允許 SELECT 或 WITH ... SELECT；資料庫端會拒絕 INSERT/UPDATE/DELETE/DROP/ALTER/CREATE 等寫入或 DDL 指令，並強制限制回傳筆數。`,
    parameters: {
      type: 'object',
      properties: {
        sql: {
          type: 'string',
          description: '唯讀 SQL。請只使用 SELECT 或 WITH ... SELECT，不要加分號，不要使用寫入或 DDL 指令。',
        },
        limit: {
          type: 'number',
          description: '最多回傳筆數，1-500，預設 100。',
        },
        apiBaseUrl: {
          type: 'string',
          description: `可選。資料庫 REST API 網址。未填時使用 ${DEFAULT_API_BASE_URL}。`,
        },
      },
      required: ['sql'],
    },
    handler: async (args: Record<string, unknown>) => {
      const baseUrl = getBaseUrl(args);
      const sql = optionalString(args.sql);
      if (!sql) return { error: '請提供 sql。' };
      try {
        return await runReadOnlySqlViaApi(baseUrl, sql, clampLimit(args.limit));
      } catch (error) {
        return makeError(error, baseUrl);
      }
    },
  },
  {
    name: 'getProductContribution',
    description: '常用報表 shortcut：查詢產品或類別的銷售貢獻、銷售量、訂單數與營收占比，用於產品線貢獻與 ABC 分析。',
    parameters: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: '可選。起始日期 YYYY-MM-DD。' },
        endDate: { type: 'string', description: '可選。結束日期 YYYY-MM-DD。' },
        groupBy: { type: 'string', description: 'product 或 category，預設 category。' },
        limit: { type: 'number', description: '最多回傳筆數，預設 20。' },
        apiBaseUrl: { type: 'string', description: `可選。資料庫 REST API 網址。未填時使用 ${DEFAULT_API_BASE_URL}。` },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const baseUrl = getBaseUrl(args);
      const groupBy = optionalString(args.groupBy) === 'product' ? 'product' : 'category';
      const conditions: string[] = [];
      appendDateWhere(conditions, optionalDate(args.startDate), optionalDate(args.endDate));
      const dimension = groupBy === 'product' ? 'p.product_name' : 'c.category_name';
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const sql = `
        WITH sales AS (
          SELECT
            ${dimension} AS segment,
            ROUND(SUM(od.unit_price * od.quantity * (1 - od.discount))::numeric, 2) AS sales_amount,
            SUM(od.quantity) AS quantity_sold,
            COUNT(DISTINCT o.order_id) AS order_count
          FROM order_details od
          JOIN orders o ON o.order_id = od.order_id
          JOIN products p ON p.product_id = od.product_id
          JOIN categories c ON c.category_id = p.category_id
          ${where}
          GROUP BY ${dimension}
        )
        SELECT
          segment,
          sales_amount,
          quantity_sold,
          order_count,
          ROUND((sales_amount / NULLIF(SUM(sales_amount) OVER (), 0) * 100)::numeric, 2) AS sales_share_pct,
          ROUND((SUM(sales_amount) OVER (ORDER BY sales_amount DESC) / NULLIF(SUM(sales_amount) OVER (), 0) * 100)::numeric, 2) AS cumulative_share_pct
        FROM sales
        ORDER BY sales_amount DESC
      `;
      try {
        return await runReadOnlySqlViaApi(baseUrl, sql, clampLimit(args.limit, 20));
      } catch (error) {
        return makeError(error, baseUrl);
      }
    },
  },
  {
    name: 'getCustomerValueSegments',
    description: '常用報表 shortcut：計算客戶 RFM 基礎資料（最近購買、購買頻率、總消費、平均訂單金額），用於高價值、回購、沉睡客戶分析。',
    parameters: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: '可選。起始日期 YYYY-MM-DD。' },
        endDate: { type: 'string', description: '可選。結束日期 YYYY-MM-DD。' },
        limit: { type: 'number', description: '最多回傳筆數，預設 50。' },
        apiBaseUrl: { type: 'string', description: `可選。資料庫 REST API 網址。未填時使用 ${DEFAULT_API_BASE_URL}。` },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const baseUrl = getBaseUrl(args);
      const conditions: string[] = [];
      appendDateWhere(conditions, optionalDate(args.startDate), optionalDate(args.endDate));
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const sql = `
        WITH customer_orders AS (
          SELECT
            c.customer_id,
            c.company_name,
            c.country,
            c.city,
            MAX(o.order_date)::date AS last_order_date,
            COUNT(DISTINCT o.order_id) AS frequency,
            ROUND(SUM(od.unit_price * od.quantity * (1 - od.discount))::numeric, 2) AS monetary,
            ROUND((SUM(od.unit_price * od.quantity * (1 - od.discount)) / NULLIF(COUNT(DISTINCT o.order_id), 0))::numeric, 2) AS average_order_value
          FROM customers c
          JOIN orders o ON o.customer_id = c.customer_id
          JOIN order_details od ON od.order_id = o.order_id
          ${where}
          GROUP BY c.customer_id, c.company_name, c.country, c.city
        ),
        reference_day AS (
          SELECT MAX(last_order_date) AS d FROM customer_orders
        )
        SELECT
          customer_id,
          company_name,
          country,
          city,
          last_order_date,
          (SELECT d FROM reference_day) - last_order_date AS recency_days,
          frequency,
          monetary,
          average_order_value
        FROM customer_orders
        ORDER BY monetary DESC
      `;
      try {
        return await runReadOnlySqlViaApi(baseUrl, sql, clampLimit(args.limit, 50));
      } catch (error) {
        return makeError(error, baseUrl);
      }
    },
  },
  {
    name: 'getRegionalSales',
    description: '常用報表 shortcut：依國家或城市分析銷售額、訂單數、客戶數與平均訂單金額，用於市場熱區與地理分布分析。',
    parameters: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: '可選。起始日期 YYYY-MM-DD。' },
        endDate: { type: 'string', description: '可選。結束日期 YYYY-MM-DD。' },
        groupBy: { type: 'string', description: 'ship_country、ship_city、customer_country 或 customer_city，預設 ship_country。' },
        limit: { type: 'number', description: '最多回傳筆數，預設 30。' },
        apiBaseUrl: { type: 'string', description: `可選。資料庫 REST API 網址。未填時使用 ${DEFAULT_API_BASE_URL}。` },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const baseUrl = getBaseUrl(args);
      const groupBy = optionalString(args.groupBy) || 'ship_country';
      const dimensionMap: Record<string, string> = {
        ship_country: 'o.ship_country',
        ship_city: 'o.ship_city',
        customer_country: 'c.country',
        customer_city: 'c.city',
      };
      const dimension = dimensionMap[groupBy] ?? dimensionMap.ship_country;
      const conditions: string[] = [];
      appendDateWhere(conditions, optionalDate(args.startDate), optionalDate(args.endDate));
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const sql = `
        SELECT
          ${dimension} AS region,
          ROUND(SUM(od.unit_price * od.quantity * (1 - od.discount))::numeric, 2) AS sales_amount,
          COUNT(DISTINCT o.order_id) AS order_count,
          COUNT(DISTINCT c.customer_id) AS customer_count,
          ROUND((SUM(od.unit_price * od.quantity * (1 - od.discount)) / NULLIF(COUNT(DISTINCT o.order_id), 0))::numeric, 2) AS average_order_value
        FROM orders o
        JOIN customers c ON c.customer_id = o.customer_id
        JOIN order_details od ON od.order_id = o.order_id
        ${where}
        GROUP BY ${dimension}
        ORDER BY sales_amount DESC
      `;
      try {
        return await runReadOnlySqlViaApi(baseUrl, sql, clampLimit(args.limit, 30));
      } catch (error) {
        return makeError(error, baseUrl);
      }
    },
  },
  {
    name: 'getEmployeeSalesPerformance',
    description: '常用報表 shortcut：依業務員分析銷售額、訂單數、平均訂單金額與平均折扣，用於判斷業績品質。',
    parameters: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: '可選。起始日期 YYYY-MM-DD。' },
        endDate: { type: 'string', description: '可選。結束日期 YYYY-MM-DD。' },
        limit: { type: 'number', description: '最多回傳筆數，預設 20。' },
        apiBaseUrl: { type: 'string', description: `可選。資料庫 REST API 網址。未填時使用 ${DEFAULT_API_BASE_URL}。` },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const baseUrl = getBaseUrl(args);
      const conditions: string[] = [];
      appendDateWhere(conditions, optionalDate(args.startDate), optionalDate(args.endDate));
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const sql = `
        SELECT
          e.employee_id,
          CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
          e.title,
          COUNT(DISTINCT o.order_id) AS order_count,
          ROUND(SUM(od.unit_price * od.quantity * (1 - od.discount))::numeric, 2) AS sales_amount,
          ROUND((SUM(od.unit_price * od.quantity * (1 - od.discount)) / NULLIF(COUNT(DISTINCT o.order_id), 0))::numeric, 2) AS average_order_value,
          ROUND((AVG(od.discount) * 100)::numeric, 2) AS average_discount_pct
        FROM employees e
        JOIN orders o ON o.employee_id = e.employee_id
        JOIN order_details od ON od.order_id = o.order_id
        ${where}
        GROUP BY e.employee_id, e.first_name, e.last_name, e.title
        ORDER BY sales_amount DESC
      `;
      try {
        return await runReadOnlySqlViaApi(baseUrl, sql, clampLimit(args.limit, 20));
      } catch (error) {
        return makeError(error, baseUrl);
      }
    },
  },
  {
    name: 'getShippingPerformance',
    description: '常用報表 shortcut：依物流商、國家或城市分析運費、平均出貨天數與延遲訂單數，用於物流成本與履約效率分析。',
    parameters: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: '可選。起始日期 YYYY-MM-DD。' },
        endDate: { type: 'string', description: '可選。結束日期 YYYY-MM-DD。' },
        groupBy: { type: 'string', description: 'shipper、country 或 city，預設 shipper。' },
        delayDays: { type: 'number', description: '超過幾天視為延遲出貨，預設 7。' },
        limit: { type: 'number', description: '最多回傳筆數，預設 30。' },
        apiBaseUrl: { type: 'string', description: `可選。資料庫 REST API 網址。未填時使用 ${DEFAULT_API_BASE_URL}。` },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const baseUrl = getBaseUrl(args);
      const groupBy = optionalString(args.groupBy) || 'shipper';
      const dimensionMap: Record<string, string> = {
        shipper: 's.company_name',
        country: 'o.ship_country',
        city: 'o.ship_city',
      };
      const dimension = dimensionMap[groupBy] ?? dimensionMap.shipper;
      const delayDays = clampLimit(args.delayDays, 7);
      const conditions: string[] = [];
      appendDateWhere(conditions, optionalDate(args.startDate), optionalDate(args.endDate));
      conditions.push('o.shipped_date IS NOT NULL');
      const where = `WHERE ${conditions.join(' AND ')}`;
      const sql = `
        SELECT
          ${dimension} AS segment,
          COUNT(*) AS shipped_order_count,
          ROUND(AVG(o.freight)::numeric, 2) AS average_freight,
          ROUND(AVG((o.shipped_date::date - o.order_date::date))::numeric, 2) AS average_ship_days,
          COUNT(*) FILTER (WHERE (o.shipped_date::date - o.order_date::date) > ${delayDays}) AS delayed_order_count
        FROM orders o
        JOIN shippers s ON s.shipper_id = o.ship_via
        ${where}
        GROUP BY ${dimension}
        ORDER BY delayed_order_count DESC, average_ship_days DESC
      `;
      try {
        return await runReadOnlySqlViaApi(baseUrl, sql, clampLimit(args.limit, 30));
      } catch (error) {
        return makeError(error, baseUrl);
      }
    },
  },
  {
    name: 'readNorthwindData',
    description: `快捷工具：讀取 Northwind 各類別月銷售數據（USD）。
優先連線真實資料庫 API（category_monthly_sales view）；連線失敗時自動退回內建範例資料，並在回傳中以 source 欄位標示 "live" 或 "sample"。
可選擇指定類別篩選，不指定則回傳全部類別。`,
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: '可選。類別名稱，例如 "Beverages"、"Meat/Poultry"。不填則回傳所有類別。',
        },
        apiBaseUrl: {
          type: 'string',
          description: `可選。資料庫 REST API 網址。未填時使用 ${DEFAULT_API_BASE_URL}。`,
        },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const category = args.category as string | undefined;
      const baseUrl = getBaseUrl(args);

      let categories: CategorySales[];
      let source: 'live' | 'sample';
      try {
        const rows = await fetchJson<CategoryMonthlySalesRow[]>(`${baseUrl}/category_monthly_sales`);
        categories = groupByCategory(rows);
        source = 'live';
      } catch {
        categories = NORTHWIND_CATEGORIES;
        source = 'sample';
      }

      const data = category
        ? categories.filter(c => c.category.toLowerCase() === category.toLowerCase())
        : categories;
      if (data.length === 0) {
        return { error: `找不到類別 "${category}"。可用類別：${categories.map(c => c.category).join('、')}` };
      }
      return {
        source,
        note: source === 'live'
          ? `資料來自真實資料庫 API（${baseUrl}）`
          : '無法連線資料庫 API，以下為內建範例資料（2023 年模擬值）',
        data,
      };
    },
  },
  {
    name: 'readInventoryStatus',
    description: `快捷工具：讀取商品庫存與補貨判斷基礎資料（product_inventory_status view）。
每列包含：商品、類別、單價、現有庫存 units_in_stock、已訂購 units_on_order、補貨點 reorder_level、是否停售 discontinued、近 90 天銷量 qty_last_90d、日均銷量 avg_daily_qty、庫存可售天數 days_of_stock。`,
    parameters: {
      type: 'object',
      properties: {
        apiBaseUrl: {
          type: 'string',
          description: `可選。資料庫 REST API 網址。未填時使用 ${DEFAULT_API_BASE_URL}。`,
        },
        category: {
          type: 'string',
          description: '可選。類別名稱篩選，例如 "Beverages"。',
        },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const baseUrl = getBaseUrl(args);
      const category = args.category as string | undefined;
      const query = category ? `?${encodeFilter('category', category)}` : '';
      try {
        const rows = await fetchJson<Record<string, unknown>[]>(`${baseUrl}/product_inventory_status${query}`);
        return { source: 'live', count: rows.length, data: rows };
      } catch (error) {
        return makeError(error, baseUrl);
      }
    },
  },
  {
    name: 'readTrendsData',
    description: '讀取模擬 Google Trends 2023 年關鍵字搜尋熱度指數（0-100）。',
    parameters: {
      type: 'object',
      properties: {
        keyword: {
          type: 'string',
          description: '要查詢的關鍵字。可用：beverages、chocolate、meat、seafood、dairy、organic produce。',
        },
      },
      required: ['keyword'],
    },
    handler: async (args: Record<string, unknown>) => {
      const keyword = args.keyword as string;
      const data = TRENDS_DATA.find(t => t.keyword.toLowerCase() === keyword.toLowerCase());
      if (!data) {
        return {
          error: `找不到關鍵字 "${keyword}"。可用：${TRENDS_DATA.map(t => t.keyword).join('、')}`,
        };
      }
      return { data };
    },
  },
  {
    name: 'generateAnalysisReport',
    description: `將分析結果以 HTML+Chart.js 報告輸出到右側面板。支援兩種模式：
- mode="replace"（預設）：以完整 HTML 取代目前報告（須含 <!DOCTYPE html>、Chart.js CDN）
- mode="append"：將 HTML 區塊追加到目前報告 </body> 前（只提供 <div>+<script>，不重複 CDN）
分段生成時：第一次用 replace 建立外殼，後續用 append 逐段填入，每個 <canvas> 使用唯一 id（chart1、chart2…）。`,
    parameters: {
      type: 'object',
      properties: {
        html: {
          type: 'string',
          description: 'replace 模式：完整 HTML 文件。append 模式：要追加的 <div> 區塊與 <script>，不含 <head>/<html> 標籤。',
        },
        title: {
          type: 'string',
          description: '報告標題（用於報告庫顯示）。append 模式可省略，沿用第一次 replace 時的標題。',
        },
        mode: {
          type: 'string',
          description: '"replace"（預設，全部取代）或 "append"（追加到現有報告末尾）。',
        },
      },
      required: ['html'],
    },
    handler: async (args: Record<string, unknown>) => {
      const html = args.html as string;
      const title = args.title as string | undefined;
      const mode = (args.mode as string | undefined) === 'append' ? 'append' : 'replace';
      sandboxStore.emit(html, title, mode);
      return {
        success: true,
        message: mode === 'append'
          ? '已追加到報告。可繼續呼叫 append 補充更多內容。'
          : '報告已顯示在右側面板。',
      };
    },
  },
];
