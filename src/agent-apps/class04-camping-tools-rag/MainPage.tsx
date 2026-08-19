import { useEffect, useMemo, useState } from 'react';
import { productService } from './services/productService';
import { ProductCard } from './components/ProductCard';
import { PolicyBrowser } from './components/PolicyBrowser';
import { EmptyState } from '../../shared/components/EmptyState';
import { useAgent } from '../../agent/hooks/useAgent';
import { productTools } from './tools/productTools';
import { createPolicyTools } from './tools/policyTools';

type MobileTab = 'products' | 'policy';

export function MainPage() {
  const { settings, setRuntimeContext, registerToolHandlers } = useAgent();
  const allProducts = useMemo(() => productService.getAllProducts(), []);
  const categories = useMemo(() => productService.getCategories(), []);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [keyword, setKeyword] = useState('');
  const [mobileTab, setMobileTab] = useState<MobileTab>('products');

  const filteredProducts = useMemo(() => {
    let result = allProducts;
    if (selectedCategory !== 'all') {
      result = result.filter((p) => p.source_category === selectedCategory);
    }
    const kw = keyword.trim().toLowerCase();
    if (kw) {
      result = result.filter((p) => p.search.normalized_text.includes(kw) || p.search.tokens.some((token) => token.includes(kw)));
    }
    return result;
  }, [allProducts, selectedCategory, keyword]);

  // Runtime Context（§23.3）：讓 Agent 知道目前頁面篩選狀態，可協助更精準地回答
  useEffect(() => {
    setRuntimeContext(JSON.stringify({
      currentPage: '商品瀏覽 / 租賃查詢',
      selectedCategory,
      searchKeyword: keyword,
      visibleProductCount: filteredProducts.length,
    }));
  }, [selectedCategory, keyword, filteredProducts.length, setRuntimeContext]);

  useEffect(() => {
    const tools = [...productTools, ...createPolicyTools(() => settings.apiKey)];
    registerToolHandlers(Object.fromEntries(tools.map((tool) => [tool.name, tool.handler])));
    return () => registerToolHandlers({});
  }, [settings.apiKey, registerToolHandlers]);

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">露營裝備出租商｜露營裝備租賃</h1>
        <p className="mt-1 text-sm text-gray-500">
          瀏覽登山露營裝備租借商品，或點擊右下角 AI 小助手詢問租金試算與服務規章。
        </p>
      </div>

      {/* 手機版 tab 切換 */}
      <div className="mb-4 flex gap-2 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileTab('products')}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
            mobileTab === 'products' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-gray-600'
          }`}
        >
          商品瀏覽
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('policy')}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
            mobileTab === 'policy' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-gray-600'
          }`}
        >
          服務規章
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <section className={mobileTab === 'products' ? 'block' : 'hidden lg:block'}>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg text-gray-400">
                search
              </span>
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="搜尋商品名稱或類型..."
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-blue-400 focus:outline-none"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
            >
              <option value="all">全部分類</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {filteredProducts.length === 0 ? (
            <EmptyState icon="search_off" title="找不到符合條件的商品" description="請調整篩選條件或搜尋關鍵字" />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>

        <aside className={mobileTab === 'policy' ? 'block' : 'hidden lg:block'}>
          <div className="rounded-lg border border-slate-200 bg-gray-50 p-3 lg:sticky lg:top-4">
            <PolicyBrowser />
          </div>
        </aside>
      </div>
    </div>
  );
}
