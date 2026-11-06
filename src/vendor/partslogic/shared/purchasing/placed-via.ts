// How an order goes to a supplier: kept on a placed order (placed_via) and as a supplier's usual way to order.
export const PLACED_VIA = ['portal', 'phone', 'email', 'printed', 'in_person'] as const;
export type PlacedVia = (typeof PLACED_VIA)[number];

export function isPlacedVia(value: unknown): value is PlacedVia {
  return typeof value === 'string' && (PLACED_VIA as readonly string[]).includes(value);
}
