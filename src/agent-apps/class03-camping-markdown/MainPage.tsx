import { useState } from 'react';
import productsJson from './data/products.json';
import type { Product } from '../../shared/types/product';
import { ProductTable } from '../../shared/components/ProductTable';
import { campingMarkdownProductList } from './prompts/campingMarkdownPrompt';

const products = productsJson as Product[];

export default function CampingMarkdownMainPage() {
  const [showMarkdown, setShowMarkdown] = useState(false);

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
          <span className="material-symbols-outlined text-xl">description</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">露營裝備客服（系統提示詞 + Markdown 商品清單）</h1>
          <p className="text-sm text-gray-500">商品資料已完整寫入系統提示詞，Agent 直接依據這份清單回答，不使用工具查詢</p>
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <button
          type="button"
          onClick={() => setShowMarkdown(!showMarkdown)}
          className="text-xs font-medium text-blue-600 hover:underline"
        >
          {showMarkdown ? '收合' : '展開'} 目前寫入系統提示詞的 Markdown 商品清單
        </button>
        {showMarkdown && (
          <div className="relative">
            <pre className="max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-2 text-[10px] text-gray-600">
              {campingMarkdownProductList}
            </pre>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(campingMarkdownProductList)}
              className="absolute right-2 top-2 flex items-center gap-1 rounded bg-white/90 px-2 py-1 text-[10px] text-blue-600 shadow hover:bg-white"
            >
              <span className="material-symbols-outlined text-xs">content_copy</span>
              複製
            </button>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400">共 {products.length} 筆商品（下方僅供參考，實際回答依據上方已寫入系統提示詞的內容）。</p>

      <ProductTable products={products} />
    </div>
  );
}
