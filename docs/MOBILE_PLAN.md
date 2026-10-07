<!-- The build plan approved on 7 Oct 2026, including the impeccable screens and workflows brief. Update it when a decision changes. -->

# PartsLogic Mobile Companion App (Expo): build plan

## Context

PartsLogic is Eclipse Auto Parts' internal parts and stock system: a Next.js back office on Supabase.
The **mobile companion app** is the fourth product in its plan (`docs/PLAN.md` §14). It lets warehouse
and counter staff scan barcodes on iPhone and Android, receive deliveries, count bins and add missing
parts, and it keeps working when the signal drops.

Commit `5c888ee` on branch `add-to-inventory-and-uploads` (7 Oct) added the server side the phone needs,
called the "floor" operations. The mobile-related parts of it are:

| Area | What it added | Where |
|---|---|---|
| Database functions | `resolve_scan(code, location)`, `ensure_bin`, `open_bin_count`, `record_counts`, `commit_bin_count`, `record_receipt_lines`, `close_stock_document`, `quick_add_part`, `scan_index`, `scan_index_version` | `supabase/migrations/20261006210000…20261007110000_floor_*.sql` |
| Shared TypeScript wrappers | Typed calls for every floor function above | `packages/shared/src/floor.ts` |
| Offline session and queue types | The bin-count session reducer and the 7 kinds of queued item | `packages/shared/src/bin-session.ts` |
| Queue error rules | `classifyQueueError`: retry later, or needs attention (never drop) | `packages/shared/src/errors.ts` |
| Barcode helpers | `gtin14`, `barcodeProblem`, `looksLikeBarcode` | `packages/shared/src/gtin.ts` |
| Mobile rules | The contract the app must follow | `.cursor/rules/40-mobile.mdc` |
| Docs | Stock documents, put-away, reversal | `docs/STOCK_DOCUMENTS.md`, `docs/PLAN.md` §12–14 |

PartsLogic is **read-only source material**. The app goes in a **new, separate repo** that the user
created: `SaabirStacks/partslogic-companion`.

## Key decisions (change any of these when you review the plan)

| Decision | Choice | Why |
|---|---|---|
| Framework | Expo SDK 57 (latest, `expo@57.0.27`), Expo Router, TypeScript | Official default template; this is what PartsLogic's `PLAN.md` specifies |
| Package manager | npm | Expo's main documented path; avoids the pnpm 10 vs 12.8.1 mismatch |
| Styling | **NativeWind 4.2.7** (Tailwind 3 classes), set up from NativeWind's official guide on top of `create-expo-app` (chosen over rn-new, which ships SDK 56 and saves the login unencrypted) | Tailwind-style classes, like the web app. Supports Reanimated 3 and 4. |
| Who scaffolds | **The user runs the setup commands locally** and pushes to the new repo; I take over from there | User's choice |
| Sharing PartsLogic code | **Vendored copy**: a sync script copies `packages/shared/src/*` and `packages/db-types/src/database.ts` from a pinned PartsLogic commit into `src/vendor/partslogic/` without changing them, and records the commit in `SOURCE.json` | One source of truth and no hand-copying. No private npm registry and no Metro monorepo setup, so fewer things can loop. Every file in `packages/shared/src` is plain TypeScript that only imports Supabase types, so it runs in React Native unchanged. |
| Database types | Only `import type` uses them, so Babel strips them and Metro never sees them. One `tsconfig` `paths` entry (`@partslogic/db-types`) is all that's needed. | No changes to Metro or Jest config |
| Session storage | Supabase's official Expo pattern **LargeSecureStore**: an AES key in `expo-secure-store` encrypts the session kept in AsyncStorage | Meets the mobile rule (secure store) while working around SecureStore's 2 KB value limit |
| Sign-in | Email and password (`signInWithPassword`), as on the web | Matches `app/login/actions.ts` |
| Offline storage | `expo-sqlite`: the outbox queue, active sessions, cached locations and bins, and the offline scan index | Mobile rule |
| Network detection | `expo-network` (`addNetworkStateListener`) plus `AppState` | Official Expo modules |
| UUIDs | `expo-crypto` `randomUUID()` | Device-made ids for stock takes, count lines, documents and receipt lines |
| Keys | Only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (safe to ship; row-level security protects the data). Never a service key. | Mobile rule |
| Git in the new repo | Scaffold commit to `main` (the repo is empty), then one branch and PR per phase | Each phase can be reviewed on its own |

## Screens and workflows (impeccable `shape` brief)

### 1. Job and audience
- **Who:** Eclipse Auto Parts staff on **their own iPhones and Android phones**, scanning with the camera.
  Counter staff look parts up while a customer waits; warehouse staff receive deliveries, put stock away
  and count bins. Usually one hand holds the phone and the other holds the part.
- **Mode:** Operate. The app should disappear into the job; staff must always know where to go.
- **Most common job:** probably lookups, but every job must be one tap away and obvious.

### 2. Outcome and proof
- **Success:** scan → answer in about a second. A delivery or bin count finishes on the phone, even with
  no signal, and matches what the back office shows on `/goods-receipts` and `/stock-counts`.
- **Product-specific truths the design must show:** received stock lands in **Unbinned**, and *putting
  away is counting a bin* (the count pulls stock from Unbinned onto the shelf). Unknown barcodes are kept,
  not lost. A scan is never guessed: an ambiguous code says so.

### 3. Selected direction: Job tabs
- **Structure:** a native tab bar with four tabs: **Look up · Receive · Count · Outbox**. Each tab
  keeps its own place, so a half-finished delivery waits in Receive during a quick lookup. The app opens
  on **Look up**.
- **Visual world:** the PartsLogic world, rendered natively. Stock Blue is the single tint (the action
  colour), amber means *needs reorder* only, red means *out* or an error, quantities use tabular figures,
  and Mist Blue is used for count pills and header bands. System fonts (SF Pro / Roboto) with Dynamic
  Type, native controls and sheets, and light and dark modes both designed.
- **Focal moment:** the scan. Live camera, a firm haptic and a result strip near the viewfinder
  ("+1 BOSCH 0 986 494 104" with Undo), with no full-screen interruption.
- **Who sees which tabs:** viewer sees Look up and **Account** (their sign-out, since they have no
  Outbox); counter and above see Look up, Receive, Count and Outbox, with the account section at the foot
  of Outbox. Tabs a role can't use are hidden, not greyed out. *(Settled in Phase 1.)*
- **The roll:** dealt Job board / Today's ledger / Job tabs (impeccable roll ran degraded: no challengers,
  the roll service is blocked by the network proxy). The user locked Job tabs.

### 4. Screens

| Screen | Contains | Key states |
|---|---|---|
| **Sign in** | Email + password, PartsLogic name, error line | Wrong details; offline ("Connect to sign in"); not a member ("Ask an owner to add you", shows email, sign out) |
| **Location sheet** | List of locations (system bins excluded); remembered per device | Auto-picked when there's only one; required before Receive or Count; reachable from the header chip "Main ▾" on every tab |
| **Look up** (tab) | Camera viewfinder (top ~40%), one entry field ("Part no. or EAN", also takes Bluetooth scanner Enter), Recent (last 20) | Camera not asked → short why + Allow; denied → "Open Settings", typing still works; offline banner |
| **Scan result → part** | Pushes **Part card** | |
| **Scan result → bin** | Sheet: bin + location, **Count this bin** | Bin in another location (`LOC/BIN`) |
| **Scan result → unknown** | Sheet: the code, check-digit hint (`barcodeProblem`), **Add as new part** (counter+), **Search instead** | Matches more than one part: "Search by part number" |
| **Search results** | `searchParts` list: brand + number (tabular), description (1 line) | Empty: "No match. Check the number or scan the box." |
| **Part card** (pushed) | Brand + part number (large), description; **stock block** (total qty, Out/Reorder badge per the web rules, bins "A-01 · 4", "Unbinned · 2"); prices for roles that see them; barcodes/SKU; Alternatives (collapsed) | Loading skeleton; offline: "Recognised. Details load when you're back online" (cached if viewed before) |
| **Receive** (tab) | No delivery open → **Start a delivery** + today's deliveries. Open delivery → header (GR number or "Not sent yet", location, lines · units), camera strip, entry field, lines grouped by code (× qty, −/+, tap to type a box quantity), line status chips after sync (Booked, Unknown barcode, Refused + reason, Void) | Unknown line → inline "Add part"; no location → "Choose a location first"; offline: everything queues |
| **Finish delivery** | Confirm sheet: lines, units, unknowns → close | After: "GR-0042 finished · 24 units in Unbinned" + **Put away now** (opens Count) |
| **Count** (tab) | No count open → "Scan a bin to start", camera + entry, "Unbinned here: 12 parts · 40 units", open counts. Counting → bin header ("A-01 · Main · Blind count"), camera, scanned lines (name if known, else code), −/+ and tap to type; **expected quantities never shown** | Part scanned before a bin: "That's a part. Scan the bin label first." Unknown bin: "A-07 isn't a bin in Main. Create it?" (online only) |
| **Finish count** | Confirm: "3 parts, 11 units in A-01. Anything not scanned goes back to Unbinned." Nothing scanned → "Confirm A-01 is empty" | Result: Put away · Returned to Unbinned · Found · Unknown; "Needs review" note if partial or large found; offline: "Saved. It will finish when you're back online." |
| **Quick add** (sheet) | Brand picker (`brandOptions`, "New brand: X" needs confirming), part number, barcode (prefilled, read-only, with any warning) | Added: "Added BOSCH 123. 4 waiting scans matched." Conflict: "This barcode belongs to MANN W 712/75. Open it." (never retried); offline: queued |
| **Outbox** (tab) | Status: Online/Offline, "All sent ✓" or "3 waiting", last sent time, scan list freshness. Sections: **Needs attention** (plain reason + Retry / Open), **Waiting**, **Sent today**. Account footer: email, role, location, Update scan list, Sign out | Tab badge = waiting count; red dot = needs attention. Sign out with work waiting → warning. Queued work is never discarded. |

### 5. Workflows
1. **Counter lookup:** open app → Look up (camera live) → scan → Part card → swipe back → camera
   resumes. Or type → results → Part card.
2. **Receive a delivery:** Receive → Start → scan each box (adjust a box quantity with −/+ or type) →
   unknown barcode: Add part now or leave it for the office → Finish → **Put away now**.
3. **Put away / count a bin:** Count → scan bin → scan every part on the shelf (blind) → Finish →
   result shows what came from Unbinned, what went back and what was found.
4. **Unknown barcode anywhere:** sheet → Add as new part → matched scans heal automatically.
5. **No signal:** an offline banner shows; every action still works and queues; the Outbox badge counts
   up; on reconnect, sending is automatic; problems land in Needs attention, never lost.
6. **First run:** sign in → member check → location (if more than one) → camera permission asked at the
   first scan, not at launch.

### 6. Interaction and layout rules
- Primary actions (Start, Finish) pinned at the bottom in the thumb zone; 44 pt / 48 dp minimum targets.
- Native push for Part card (swipe or Back to return); native sheets for scan results, Quick add and
  confirmations; no modal as the first idea.
- Scan cooldown of about 1 s per code; haptics: success / warning (unknown) / error (refused).
- Offline is a thin banner, never a blocking dialog.
- Lists virtualised: deliveries can reach hundreds of lines, and the outbox can hold hundreds of items.
- Copy: plain sentence case, UK English, no jargon ("Unbinned" and "GR-0042" are real PartsLogic terms;
  "stream", "queue" and "RPC" never appear).

### 7. Ranges, constraints and open decisions
- **Ranges:** part numbers up to about 20 characters, brands up to about 30, descriptions truncated to
  2 lines; deliveries typically 5–60 lines; bin counts 1–40 parts; the offline scan list may be
  100k+ codes, so the first download shows progress.
- **Anti-goals:** not a port of the web back office (no tables, reviews, reversals, price edits or
  reports); no hover; no custom navigation; no gamification; never show expected quantities in a count.
- **Settled in Phase 1:** the tab bar is `NativeTabs` from `expo-router/unstable-native-tabs` (what the
  SDK 57 template uses), each tab a folder with its own native `Stack`; icons are `expo-symbols`, SF
  Symbols on iOS and Material symbols on Android (`src/ui/icons.ts`); colours live once in
  `src/ui/palette.ts` and reach NativeWind through `vars()`.
- **Settled in Phase 2:** a scan's bin or unknown result appears in place under the camera (a panel),
  not in a sheet, so the camera stays in view; the part card is pushed inside the Look up tab
  (`/lookup/part/[id]`); a repeat read of the same code only counts after it has been out of view for
  1.2 s (`src/scan/scan-gate.ts`).
- **Settled in Phases 4–6:** Receive and Count record a scan instantly and name it from the phone's own
  scan list (no network wait); a bin label scanned while receiving is refused. Quick add calls
  PartsLogic straight away when there's signal (so a conflict or a new-brand question is answered on the
  spot) and queues when there isn't; a queued quick add that hits a conflict lands in Needs attention
  with the holder named, never retried on its own. Creating a bin needs signal.
- **Still open (verify in docs, don't invent):** the tab label "Outbox" or "Sync"; whether `part_detail`
  already returns only the prices each role may see; how many viewed part cards to cache offline
  (proposed: 200).

## Setup: official commands only

**You run these locally (step 0a):**
1. `npx create-expo-app@latest partslogic-mobile --template default --yes`
2. `npx expo install expo-camera expo-sqlite expo-secure-store expo-network expo-crypto expo-haptics`
3. `npx expo install @supabase/supabase-js react-native-url-polyfill @react-native-async-storage/async-storage aes-js react-native-get-random-values`. These are the dependencies Supabase's Expo guide lists for LargeSecureStore.
4. `npx expo install nativewind react-native-reanimated react-native-safe-area-context` (NativeWind guide)
5. `npx expo install tailwindcss@^3.4.17 prettier-plugin-tailwindcss@^0.5.11 jest-expo jest @types/jest -- --save-dev`
6. `npx expo-doctor`, then commit and push to `main` of the new repo.

**I do the rest (step 0b), with no extra installs:** NativeWind config files (`tailwind.config.js`,
`global.css`, `babel.config.js`, `metro.config.js`, `nativewind-env.d.ts`, checked against NativeWind's
Expo guide), the Jest config, the vendoring script and copy, the Supabase client, `.env.example`, and
replacing the template's example screens directly (I won't run the interactive `reset-project` script).

Loop guard: if the same error appears twice, stop and report it. Check the docs before using each library.

## Architecture (each part does one job)

```
app/                         Expo Router screens: UI only, no data logic
  _layout.tsx                providers: SQLite, session, queue runner; Stack.Protected by session
  sign-in.tsx
  (tabs)/_layout.tsx         native tab bar: Look up · Receive · Count · Outbox (hidden by role)
  (tabs)/lookup.tsx          camera + entry + recent → result sheets
  (tabs)/receive.tsx         start / open delivery
  (tabs)/count.tsx           scan bin / counting
  (tabs)/outbox.tsx          status, needs attention, waiting, sent, account
  part/[id].tsx              part card (pushed)
  location.tsx               location sheet
  quick-add.tsx              quick add sheet
  scan-result.tsx            bin / unknown result sheet
  finish-delivery.tsx        confirm sheet
  finish-count.tsx           confirm sheet
src/
  vendor/partslogic/         synced copy; never edited by hand
  lib/supabase.ts            client + LargeSecureStore + AppState auto-refresh (official snippet)
  lib/device.ts              per-install device id sent as p_device
  db/                        SQLite schema, migrations via PRAGMA user_version (official pattern), one repository per table
  queue/handlers.ts          queue kind → vendored floor wrapper (add a kind = add a handler)
  queue/runner.ts            ordered replay, classifyQueueError, backoff
  queue/triggers.ts          run on enqueue, on reconnect and on app foreground
  scan/lookup.ts             pure offline lookup over the scan index
  scan/sync-index.ts         page scan_index into a staging table, then swap atomically
  scan/camera-scanner.tsx    CameraView + cooldown + haptics; one component reused by every screen
  ui/                        NativeWind theme (colours from PartsLogic DESIGN.md) and a few shared components
scripts/sync-partslogic.mjs  vendoring script
```

### Reused from PartsLogic, not rewritten

- `floor.ts`: `resolveScan`, `ensureBin`, `openBinCount`, `recordCounts`, `commitBinCount`, `recordReceiptLines`, `closeStockDocument`, `quickAddPart`, `scanIndexPage`, `scanIndexVersion`
- `bin-session.ts`: `emptyBinSession`, `reduceBinSession`, `visibleLines`, `sessionLines`, `QueueItem`
- `errors.ts`: `DataError`, `classifyQueueError`
- `gtin.ts`: `gtin14`, `barcodeProblem`, `looksLikeBarcode`
- `members.ts`: `getCurrentMember`, `roleAtLeast`
- `inventory.ts`: `listLocations`, `transferStock` (later)
- `catalogue.ts`: `getPartDetail`, `searchParts`
- `add-part.ts`: `brandOptions`
- `read.ts`: JSON readers, which any new wrapper must use

Only one new rule is written in the app: `normalisePartNumber`, which mirrors the SQL
`public.normalise_part_number` (uppercase, strip anything that isn't A–Z or 0–9). It carries a comment
pointing at the SQL and has a test.

### Offline queue design

- **Outbox table:** `client_id` (primary key), `seq`, `user_id`, `stream_key`, `kind`, `payload`,
  `status` (pending / attention / done), `attempts`, `last_error`, timestamps.
- **Ordering:** replay in `seq` order **within a stream**. A stream is one stock take or one receipt.
  An item that needs attention blocks only its own stream, so other work keeps flowing. A `retry` error
  pauses the runner with backoff. Nothing is ever deleted until the server accepts it.
- **Receipt lines:** each scan queues one line. The runner merges neighbouring lines for the same
  receipt into one call of up to 500 lines. This is safe because the server de-duplicates by
  `client_line_id`.
- **Bin counts:** the session lives in SQLite. Only one pending `bin_count_lines` item is kept per
  stock take, and it sends the **latest** `sessionLines()` when it runs. This is safe because a resent
  total replaces the earlier one. Order per stream: `open_bin_count` → lines → `commit_bin_count`
  (`confirmEmpty` when no lines are visible).
- **Shared phones:** each item stores `user_id`, and only the signed-in user's items run. Signing out
  with items still pending shows a warning first.
- **Results come back to the screens:** refused, void and unresolved receipt lines, partial or
  needs-review counts, and quick-add conflicts.

### Scanning

- `CameraView` with `barcodeScannerSettings.barcodeTypes`: `ean13`, `ean8`, `upc_a`, `upc_e`,
  `code128`, `code39`, `itf14`, `qr`.
- **Cooldown:** after a read, scanning pauses until about 1 second has passed or a different code
  appears, with haptic feedback. The camera fires repeatedly while a barcode stays in view, and
  without this a count would be inflated. Every line also has +/− buttons.
- **One manual-entry field** that also takes Bluetooth/USB scanner input (they type like a keyboard and
  press Enter), as `PLAN.md` §13 describes for warehouse hardware.
- **Online:** `resolveScan(code, workingLocationId)`. The server is always the final word.
- **Offline:** look the code up in the index by `upper(trim(code))`, then `gtin14(code)`, then the
  normalised part number. A plain bin code only matches bins in the working location; `LOC/BIN`
  matches any bin. The first entry that isn't `ambiguous` wins; otherwise the code is "unknown for now"
  and the server resolves it when the queue replays.

## Phases (each ends green on every check below, then commit and push)

| # | Phase | Delivers | Min role |
|---|---|---|---|
| 0a | Scaffold (you, locally) | Template app on SDK 57 with every dependency installed, pushed to `main` | n/a |
| 0b | Foundations (me) | NativeWind config, vendored PartsLogic code, Supabase client, Jest, `.env.example`, template demo removed | n/a |
| 1 | Sign-in and tab shell | Sign in and out, member and role check ("Ask an owner to add you"), location sheet, the four tabs gated by role (empty states only) | viewer |
| 2 | Look up and part card | Camera scan with cooldown and haptics, entry field (also hardware scanners), online `resolveScan`, result sheets, search, Part card via `getPartDetail`, Recent | viewer |
| 3 | Offline engine and Outbox | SQLite outbox, runner, triggers, Outbox tab, offline banner, offline scan list sync and lookup, cached part cards | counter |
| 4 | Receive | Start a goods receipt (device UUID), scan lines, undo (negative line), finish (`closeStockDocument`), per-line outcomes | counter |
| 5 | Bin count | Scan or pick a bin, open the count, scan with running totals, ± corrections, commit (confirm empty), result summary (put away, returned, found, partial) | counter |
| 6 | Quick add | From an unknown scan: brand picker (`brandOptions`) and number → `quickAddPart`; show conflicts with the holder, never retry them | counter |

**Built after the plan:** move stock, from a bin row on the part card (counters and up). It's online only
and never queued or retried: `transfer_stock` takes no id made on the phone, so a move resent after a
lost reply could happen twice. After a lost reply the app says the move may or may not have happened.

**Later, not in this build:** labels (`register_label`, editor), full
stock take (`record_count`), registration lookup (the VRM Edge Function doesn't exist in PartsLogic
yet), creating a new bin while offline (needs the queue to pass the new bin's id to the items after it),
and EAS builds for TestFlight and Play.

**Checked against the live Supabase project (`tarupsxdpaubfhjpsyku`, 7 Oct 2026, read-only via the
Supabase connector; the CLI can't reach Supabase from the cloud session):**
- Every migration in PartsLogic up to `20261007110000_floor_reads` is applied, so the live database
  matches the vendored commit `5c888ee`.
- All 23 functions the app calls exist with the arguments the vendored wrappers send, and signed-in
  users can execute them. `cancel_stale_bin_counts` and `close_stale_receipts` are not callable from
  the app (they run on a timer), so the app never calls them.
- No Edge Functions are deployed (the repo's `enrichment-runner` isn't live). The app doesn't need any.
- `part_card` exists but has no sell or trade price, reorder flag, SKU or photo, so the part card keeps
  using `part_detail` through the vendored `getPartDetail`.
- The web app's money, quantity and date formatters (`lib/inventory-display.ts`) are vendored and used,
  instead of the app's own copies.

**Upstream follow-ups to raise for PartsLogic (I won't change it):** the Out/Reorder badge rule lives
inline in the web's React components; moving it into `packages/shared` would let the phone vendor it
instead of mirroring it (`src/features/part/stock.ts`). `brand_options` now has the right grant
for counters, but `docs/DB_API.md` still lists its role as editor.

## Verification

After every phase, in the cloud container:
- `npx tsc --noEmit` (includes the vendored code)
- `npx expo lint`
- `npx jest`: unit tests for offline lookup, `normalisePartNumber`, runner ordering and per-stream
  blocking, receipt merging, bin-session persistence, and the role gate
- `npx expo-doctor`
- `npx expo export --platform ios` and `--platform android`, which proves the whole app bundles without a device

On your phone, after each phase (I can't run a device here):
1. `npx expo start`, then scan the QR code with Expo Go. Every module used works in Expo Go.
2. Phase 4–5 field test in airplane mode: receive 10 scans, count one bin, turn the signal back on,
   check the outbox empties and the back office (`/goods-receipts`, `/stock-counts`) shows the same numbers.
3. **Done test (from `PHASES.md` step 3):** count one location on two phones with signal dropouts;
   the results must match the web.

## What I need from you

1. The new repo created (empty, private), the setup commands run and pushed to `main`, and the repo's name.
2. Your Supabase project URL and publishable key, for your local `.env` (they're safe to share; I can
   also read them via the Supabase connector if you tell me which project).
3. A test user for each role you want checked (at least counter and editor).
