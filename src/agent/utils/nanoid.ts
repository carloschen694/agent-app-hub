export function nanoid() {
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
