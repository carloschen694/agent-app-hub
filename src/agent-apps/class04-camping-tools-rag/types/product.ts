export interface NumberRange {
  value?: number;
  min?: number;
  max?: number;
}

export interface DimensionCm {
  length?: number;
  width?: number;
  height?: number;
  unit: 'cm';
}

export interface ProductPricing {
  currency: 'TWD' | string;
  base_rental: number | null;
  extra_day: number | null;
  deposit: number | null;
}

export interface ProductInventory {
  listing_status: string | null;
  rental_until: string | null;
  reservation: string | null;
}

export interface ProductSpecs {
  weight_g?: number;
  tent_capacity_persons?: number;
  tent_structure?: string;
  tent_required_trekking_pole_count?: number;
  backpack_capacity_l?: NumberRange;
  backpack_back_length_cm?: NumberRange;
  backpack_waist_belt_cm?: NumberRange;
  backpack_max_load_kg?: number;
  sleeping_bag_style?: string;
  sleeping_bag_down_fill_power_fp?: number;
  sleeping_bag_down_fill_weight_g?: number;
  sleeping_bag_suitable_height_cm_max?: number;
  sleeping_bag_comfort_temperature_c?: number;
  sleeping_bag_limit_temperature_c?: number;
  r_value?: number;
  expanded_size_cm?: DimensionCm;
  packed_size_cm?: DimensionCm;
  power_capacity_mah?: number;
  water_resistance?: string;
}

export interface ProductSearchIndex {
  normalized_text: string;
  tokens: string[];
}

export interface Product {
  id: string;
  source_id: string | null;
  source_category: string | null;
  name: string;
  brand: string | null;
  pricing: ProductPricing;
  inventory: ProductInventory;
  specs: ProductSpecs;
  search: ProductSearchIndex;
  source: {
    row_number: number;
  };
}

export interface ProductsFile {
  schema_version: 5;
  products: Product[];
}
