import type { Product } from '../types/product';

function statusBadgeClass(status: string) {
  if (status.includes('未到貨')) return 'bg-orange-100 text-orange-700';
  if (status.includes('送洗')) return 'bg-purple-100 text-purple-700';
  return 'bg-emerald-100 text-emerald-700';
}

export function ProductTable({ products }: { products: Product[] }) {
  if (!products.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-gray-400">
        目前沒有商品資料，請確認資料來源設定。
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-gray-500">編號</th>
            <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-gray-500">品名</th>
            <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-gray-500">分類</th>
            <th className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold text-gray-500">兩天一夜租金</th>
            <th className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold text-gray-500">押金</th>
            <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-gray-500">狀態</th>
            <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-gray-500">出租中／歸還日</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {products.slice(0, 60).map((product) => (
            <tr key={product.id} className="hover:bg-slate-50">
              <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">{product.id}</td>
              <td className="px-3 py-2 text-gray-800">{product.name}</td>
              <td className="whitespace-nowrap px-3 py-2 text-gray-500">{product.category}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right text-gray-800">
                {product.price != null ? `NT$${product.price}` : '—'}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right text-gray-600">
                {product.deposit != null ? `NT$${product.deposit}` : '—'}
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(product.status)}`}>
                  {product.status || '未標示'}
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">{product.rentalUntil || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {products.length > 60 && (
        <p className="border-t border-slate-100 px-3 py-2 text-xs text-gray-400">僅顯示前 60 筆，共 {products.length} 筆商品。</p>
      )}
    </div>
  );
}
