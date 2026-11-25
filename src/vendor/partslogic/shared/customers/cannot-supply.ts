import { call } from '../core/call';
import type { Client } from '../core/client';
import { requireDetail, type CustomerDetail } from './accounts';

// What to do when a supplier can't supply a part for an account (owner, 21 November 2026; docs/SALES.md 13.14): the
// account's setting, which sales follows and an order can change for itself. Ask first is the default, and a walk-in
// sale always asks first.
export const CANNOT_SUPPLY_PREFERENCES = ['same_part', 'equivalent', 'ask', 'take_off'] as const;
export type CannotSupplyPreference = (typeof CANNOT_SUPPLY_PREFERENCES)[number];
export const CANNOT_SUPPLY_PREFERENCE_LABELS: Record<CannotSupplyPreference, string> = {
  same_part: 'Same part, another supplier',
  equivalent: 'Equivalent that fits',
  ask: 'Ask first',
  take_off: 'Remove from order',
};
// What each one does, for the account's Ordering setting.
export const CANNOT_SUPPLY_PREFERENCE_HELP: Record<CannotSupplyPreference, string> = {
  same_part: 'Purchasing reorders it elsewhere.',
  equivalent: 'The counter picks a part that fits.',
  ask: 'The counter asks the customer first.',
  take_off: 'The counter removes it; the rest of the line stays.',
};
export function isCannotSupplyPreference(value: unknown): value is CannotSupplyPreference {
  return typeof value === 'string' && (CANNOT_SUPPLY_PREFERENCES as readonly string[]).includes(value);
}

// Sets an account's answer (editors). Kept in the account's history.
export function setCustomerCannotSupply(supabase: Client, accountId: number, value: CannotSupplyPreference): Promise<CustomerDetail> {
  return call(supabase.rpc('set_customer_cannot_supply', { p_account: accountId, p_value: value }), requireDetail('saving its preference'));
}
