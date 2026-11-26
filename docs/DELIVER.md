# Deliver on the phone (S5a-2c)

The phone half of proof of delivery. The design sheet, owner decisions, copy deck and checklist (D1 to D12) are in
PartsLogic's `docs/design-checks/proof-of-delivery.md`; the database, the web's "Signed by" and "No signature" lines
and the signature on the reprinted delivery note ship there (PartsLogic `20261126090000_sales_proof_of_delivery.sql`,
suite 189). This file records the phone's build: what it does, where it departs from the deck, and its checks.

## What the phone does

| Job | How |
|---|---|
| Board | Deliver, in copper with Pick and Pack, says "3 with you": the orders out for delivery with the signed-in driver (`driver_deliveries`, `mine`) |
| The list | With you first, then Out from the branch: each row the customer, where and the parcels (or Not packed), the order and when it was sent. Couriers' orders aren't listed; the office marks those |
| The drop | The order large, the customer, the address, Call (when the order or account has a number), what's in the van for it, then Get signature and Not delivered in the thumb zone |
| Sign | Sign for SO-000043 · 3 units · 2 parcels; Name; the pad (Sign here, a line to sign on); Clear; Delivered. Delivered says what is missing, the name first, in the database's own words, instead of sending |
| Not delivered | The web's reasons (No one in, Closed, Address not found, Ran out of time, Other with a note); the parts come back to the shelf when it's sent |
| Receipt | Delivered · SO-000043 · Signed by Jo Smith · 14:05, or Waiting for signal with "Sends when back online."; the chip sweeps to Delivered when PartsLogic has it. Next delivery, Done |

## Offline

The list is kept on the phone each time it's read (`deliveriesPref`), so a van at a door with no signal still has the
address, the number to ring and the parts. Delivered and Not delivered go into the outbox (`src/queue/items.ts`,
stream `deliver:<order>`) and leave the list at once. A signed delivery carries a client id made on the phone:
PartsLogic answers a second send as it answered the first and delivers once (`sales.deliver`, suite 189's replay).
The signature is saved as strokes on PartsLogic's 1000 by 400 pad (`padStrokes`), not as a picture, so every surface
draws it alike and it stays small.

## Decisions made in the build

| Decision | Why |
|---|---|
| `react-native-svg` 15.16.0 for the pad, through Gesture Handler's pan (JS thread) | Approved by the owner, 26 November 2026; the version Expo SDK 58 pins. A native package, so the app moved to `1.2.0` (`docs/DEPLOY.md`): phones need the new build |
| The list is the last one read when there's no signal | The driver is out of the branch; Pack's "needs signal" rule is for a list others change while you work, and a van's load doesn't change under the driver |
| Delivered says what's missing on press, not greyed out | One line at a time under its field (DESIGN.md), as the sheets do; a greyed button can't say why |
| Not delivered is blue, not red | Red is only for what blocks; the parts come back and the order can go out again |
| "Another delivery" on the drop | Pack's "Another order"; back to the list without leaving Deliver (not in the deck) |
| "No address on the order" when the order has none | The drop still works from the parts and Call (not in the deck) |
| A refused Not delivered says "Check in Sync" | As Pack's receipt; a refused Delivered says "Not delivered" with PartsLogic's reason, as the deck asks |
| Not delivered sent twice (an answer lost) waits in Sync | `sales_order_not_delivered` has no client id; its second answer ("Nothing is out for delivery on this order.") can't be told from the office marking it delivered, so the phone doesn't guess |

## Checks

| Check | Result |
|---|---|
| `npx jest` | 253 passed (Deliver: list less handled drops, saved list, receipt states, tile, queue senders and streams) |
| `npx tsc --noEmit`, `npx expo lint` | Clean |
| `node scripts/check-server-contract.mjs --ref 4256a48` | Nothing the app uses is broken |
| Gallery (`?screen=deliver-…`) | List, offline list, nothing out, no signal, drop, loose drop, Not delivered, Sign (empty, name missing, signature missing, signed), receipt (sent, waiting, refused, Not delivered) |
