export const infoFieldLabels: Record<string, string> = {
  weight_g: '重量',
  tent_capacity_persons: '帳篷容量',
  tent_structure: '帳篷結構',
  tent_required_trekking_pole_count: '需登山杖數',
  backpack_capacity_l: '背包容量',
  backpack_back_length_cm: '背長',
  backpack_waist_belt_cm: '腰圍',
  backpack_max_load_kg: '背包限重',
  sleeping_bag_style: '睡袋款式',
  sleeping_bag_down_fill_power_fp: '羽絨蓬鬆度',
  sleeping_bag_down_fill_weight_g: '羽絨填充量',
  sleeping_bag_suitable_height_cm_max: '適合身高上限',
  sleeping_bag_comfort_temperature_c: '舒適溫度',
  sleeping_bag_limit_temperature_c: '極限溫度',
  r_value: 'R 值',
  expanded_size_cm: '展開尺寸',
  packed_size_cm: '收納尺寸',
  power_capacity_mah: '電源容量',
  water_resistance: '防水等級',
};

export function formatInfoLabel(key: string): string {
  return infoFieldLabels[key] ?? key;
}
