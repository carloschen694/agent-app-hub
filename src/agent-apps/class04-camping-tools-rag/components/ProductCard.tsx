import { useState } from 'react';
import type { DimensionCm, NumberRange, Product } from '../types/product';
import { Card } from '../../../shared/components/Card';
import { Badge } from '../../../shared/components/Badge';
import { formatInfoLabel } from './infoFieldLabels';
import { getInventoryStatus } from '../services/productService';

function formatRange(value: NumberRange): string {
  if (typeof value.value === 'number') return String(value.value);
  if (typeof value.min === 'number' && typeof value.max === 'number') return `${value.min} - ${value.max}`;
  return '';
}

function formatDimension(value: DimensionCm): string {
  return [value.length, value.width, value.height].filter((item) => typeof item === 'number').join(' x ') + ` ${value.unit}`;
}

function formatSpecValue(key: string, value: unknown): string {
  if (value && typeof value === 'object') {
    if ('unit' in value) return formatDimension(value as DimensionCm);
    return formatRange(value as NumberRange);
  }

  if (typeof value !== 'number') return String(value);
  if (key.endsWith('_g')) return `${value} g`;
  if (key.endsWith('_kg')) return `${value} kg`;
  if (key.endsWith('_mah')) return `${value} mAh`;
  if (key.endsWith('_c')) return `${value} °C`;
  if (key.endsWith('_fp')) return `${value} FP`;
  return String(value);
}

export function ProductCard({ product }: { product: Product }) {
  const [expanded, setExpanded] = useState(false);
  const inventoryStatus = getInventoryStatus(product);
  const isAvailable = inventoryStatus === 'available';

  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-gray-800">{product.name}</p>
          <p className="text-xs text-gray-400">
            {product.source_category ?? '未分類'} {product.brand ? `· ${product.brand}` : ''}
          </p>
        </div>
        <Badge tone={isAvailable ? 'emerald' : 'gray'}>{isAvailable ? '可租借' : inventoryStatus === 'rented' ? '租借中' : product.inventory.listing_status ?? '不可租借'}</Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone="blue">NT$ {product.pricing.base_rental ?? 0} / 兩天一夜</Badge>
        <Badge tone="orange">押金 NT$ {product.pricing.deposit ?? 0}</Badge>
        <Badge tone="gray">{product.id}</Badge>
      </div>

      <p className="text-xs text-gray-400">每多一日 NT$ {product.pricing.extra_day ?? 0}</p>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-1 flex items-center gap-1 self-start text-xs font-medium text-blue-600 hover:underline"
      >
        <span className="material-symbols-outlined text-sm">{expanded ? 'expand_less' : 'expand_more'}</span>
        {expanded ? '收合規格' : '查看規格'}
      </button>

      {expanded && (
        <dl className="mt-1 grid grid-cols-1 gap-x-3 gap-y-1 rounded bg-gray-50 p-3 text-xs sm:grid-cols-2">
          {Object.entries(product.specs)
            .filter(([, value]) => value !== undefined && value !== '' && value !== 'N/A')
            .map(([key, value]) => (
              <div key={key} className="flex justify-between gap-2">
                <dt className="text-gray-400">{formatInfoLabel(key)}</dt>
                <dd className="text-right font-medium text-gray-700 break-all">{formatSpecValue(key, value)}</dd>
              </div>
            ))}
          {product.inventory.rental_until && <div className="col-span-full text-gray-400">歸還日：{product.inventory.rental_until}</div>}
          {product.inventory.reservation && <div className="col-span-full text-gray-400">預約：{product.inventory.reservation}</div>}
        </dl>
      )}
    </Card>
  );
}
