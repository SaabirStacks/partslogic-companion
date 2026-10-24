# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Staff at Eclipse Auto Parts, on their own Android and iOS phones:

- **Counter staff** look a part up while a customer waits at the counter. They need to be fast and confident.
- **Warehouse staff** receive deliveries in the goods-in bay, then put the stock away by counting each bin.
  They also count shelves, move stock between bins and add parts PartsLogic doesn't know yet.

Usually one hand holds the phone and the other holds the part or the box. On the warehouse floor the light
can be poor, the phone is held at arm's length and there may be gloves. In goods-in, many boxes are scanned
quickly one after another.

Roles come from PartsLogic: **viewer** (look up only), **counter** (all floor jobs), **editor** (also sees
cost prices), plus admin and owner.

## Product Purpose

The phone companion to PartsLogic, the parts and stock system on Supabase. It turns the camera into a
scanner for the floor jobs: **look up, receive, put away & count, move, add part**. Every job keeps working
with no signal. Work queues on the phone and sends itself when the signal returns, and nothing is ever
dropped.

Success means:
- A scan gives an answer in about a second.
- A delivery or count finishes on the phone, signal or not.
- The back office then shows the same numbers as the phone.

## Positioning

A job tool, not a reference app. It doesn't browse PartsLogic: it does the floor jobs, and each one is
built around scanning. The phone never invents stock rules. It calls the same database functions as the
back office, so what the phone does and what the office sees agree.

## Operating Context

- **Workflows,** in the standard warehouse families (one list in `src/workflows/catalogue.ts`; the board
  shows only the ones PartsLogic supports today):
  - **Parts:**
    - **Look up:** scan or type, then see the part, on-hand stock per bin, prices, codes and
      alternatives.
    - **Add part:** add an unknown barcode as a new part. Waiting scans of that barcode then match up.
  - **Inbound:**
    - **Receive goods:** a delivery becomes a goods receipt (GR-0042), and the stock lands in the
      location's **Unbinned** bin, which serves as inbound staging.
    - **Put away:** choose a bin and count it, blind. Counting a bin pulls stock from Unbinned onto the
      shelf; anything not scanned goes back to Unbinned.
    - Later: inbound staging areas, customer returns.
  - **Stock control:**
    - **Stock count:** the same blind bin count, to check a shelf.
    - **Transfer stock:** move stock between bins. Needs signal.
    - Later: full stock take, opening stock (initial setup), adjust stock.
  - **Outbound** (later): pick, pack, outbound staging, dispatch, return to supplier.
  - **Sync:** what's waiting to send, what needs attention, and what was sent.
- **Working location:** each phone works in one location at a time, chosen once and remembered.
- **Labels in use:** manufacturer and supplier labels. PartsLogic's own labels come later; bins carry a
  name on the shelf, not a barcode, so bins are typed or picked.
- **Scanning:**
  - phone camera, product and supplier barcodes only (EAN-13/8, UPC-A/E, ITF-14, Code 128, Code 39);
    QR and other 2D codes are ignored
  - one scan at a time: a scan pauses the camera on a card to check it (and how many) before it's
    recorded
  - typing a part number
  - hardware scanners that type like a keyboard
- **Terms used on the floor:** Unbinned, GR-0042, bin codes like A-01 and `LOC/BIN`, on hand, reorder,
  out of stock.

## Capabilities and Constraints

- **Built with:** Expo SDK 57, Expo Router, React Native, NativeWind.
- **Offline:**
  - outbox kept in SQLite
  - a scan list saved on the phone for offline lookups
  - part cards saved after viewing
- **Fixes:** reach phones as over-the-air updates (EAS Update, channel `preview`).
- **Blind counts:** expected quantities are never shown during a count.
- **Not yet built:**
  - full stock take
  - labels
  - creating bins offline
  - registration lookup (needs a vehicle-lookup function that doesn't exist yet)
- Unknown barcodes are kept for the office, never dropped.

## Brand Commitments

- The name is **PartsLogic**. The app icon is a white "PL" with a scan line on blue.
- The voice is plain UK English in sentence case. It uses the floor's own words. Nothing technical
  ("queue", "RPC", "stream") ever reaches staff.
- The owner's binding list of what must not happen:
  - **Stock detail must not be hidden.** Stock per bin, prices and reorder status stay one tap from any
    scan.
  - **Nothing playful or gamey.** No confetti, mascots or streaks.
  - **No explanation text.** No paragraphs telling staff what a screen does. The design must be intuitive
    and focused on the job, not a reference app.
- The current Stock Blue look is **not** binding. It may be replaced.

## Evidence on Hand

- Real data lives in PartsLogic's Supabase: parts, brands, bins, locations and stock.
- No customer quotes, metrics or photos of the warehouse exist. Do not invent any.

## Product Principles

1. **The job is the screen.** Each screen does one job, and its main action sits in the thumb zone.
2. **The scan is the moment.** A scan lands as a big, unmistakable result, with sound-free haptics and
   colour by outcome.
3. **Numbers over sentences.** Quantities, codes and states carry the meaning; prose is a last resort.
4. **Never lose work.** Offline is normal. Everything queues and shows where it stands.
5. **Same truth as the office.** The phone calls PartsLogic's own functions and never re-implements stock
   rules.

## Accessibility & Inclusion

- **Readable at arm's length in poor light:**
  - high contrast in light and dark
  - large type for codes and quantities
  - support for Dynamic Type and font scaling
- **Usable one-handed with gloves:** main targets at least 56 dp, and nothing that needs precision taps.
- **Never by colour alone:** every outcome also carries a word or an icon.
