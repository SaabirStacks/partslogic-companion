import type { DriverDelivery } from '@/vendor/partslogic/shared/sales/delivery';
import { pickingCustomer } from '@/vendor/partslogic/shared/sales/picking';

// The phone's words for Deliver: the signed-off copy deck (PartsLogic docs/design-checks/proof-of-delivery.md), with
// the web's own words from the shared code wherever both say the same thing.

export const NO_SIGNAL_LIST = { title: 'No signal', line: 'The list shows once it’s back.' };
// The list and the drop with no signal, read from the last list: Delivered still saves.
export const DELIVER_OFFLINE = 'No signal · Delivered sends when it’s back';
export const CHECKING = 'Checking what’s out';
export const SIGN_PAD_LABEL = 'Signature';

// A row's first line: who it's for (Cash sale for an order with no customer, as Pick says it).
export const deliveryCustomer = (delivery: Pick<DriverDelivery, 'customer'>) => pickingCustomer(delivery.customer);
