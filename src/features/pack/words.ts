import { partNumber } from '@/lib/format';
import { packingPlace, pickingCustomer, type PackingOrder } from '@/vendor/partslogic/shared/sales/picking';
import { quantityWords } from '@/vendor/partslogic/shared/sales/words';

import { inBox, type BoxLine } from './pack';

// The phone's words for packing: PartsLogic's copy deck (docs/design-checks/phone-picking.md), with the web's own
// words from the shared code wherever both say the same thing.

export const NOTHING_TO_PACK = { title: 'Nothing to pack', line: 'Deliveries appear here once every part is picked.' };
export const NO_SIGNAL_TO_PACK = { title: 'No signal', line: 'Pack when it’s back.' };

// The banner under the order number: "Northway Fleet Services · Shipley BD18".
export const packingDetail = (order: PackingOrder) => [pickingCustomer(order.customer), packingPlace(order)].filter(Boolean).join(' · ');

export const boxCount = (line: BoxLine) => `${quantityWords(inBox(line))} of ${quantityWords(line.qty)} in the box`;
export const linePart = (line: Pick<BoxLine, 'part'>) => partNumber(line.part);
export const allInBox = (qty: number) => `All ${quantityWords(qty)} in the box`;
export const NOT_ON_ORDER = 'Not on this order';
// Packed's place until every unit is in: "1 of 3 in the box".
export const boxProgress = (inBox: number, units: number) => `${quantityWords(inBox)} of ${quantityWords(units)} in the box`;
export const PARCELS_QUESTION = 'How many parcels?';
// Another order with parts already in the box.
export const LEAVE_NOTE = 'What’s in the box isn’t counted any more; the order stays To pack.';
