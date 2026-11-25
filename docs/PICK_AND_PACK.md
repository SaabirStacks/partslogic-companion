# Pick and Pack on the phone (S5b-2)

The phone half of S5b. The design sheet, owner decisions, copy deck and checklist (P1 to P14) are in PartsLogic's
`docs/design-checks/phone-picking.md`; the database and the web's To pack and Pack window shipped there as S5b-1
(PartsLogic PR 81). This file records the phone's build: what it does, where it departs from the deck, and its checks.

## What the phone does

| Job | How |
|---|---|
| Board | Outbound tiles in copper: Pick counts units to pick at the branch, Pack orders to pack (`pick_job_status`). An open pick job has a Resume row and an amber "6 of 14" on Pick |
| Start | Start picking claims the next orders at the branch (`pick_job_start`); it needs signal. A job running on another phone is carried on (Carry on) |
| Pick | The bin to go to at display size, then Next, orders and units. Each scan adds one unit to the first row of that part still to pick, the bin to go to first, and the card says which order it goes with. No confirm in between |
| A row's menu | The count on each row opens Can't scan (why, then units) or Short pick (how many are here, why the rest aren't) |
| End | Finish, or Stop at the foot of the rows. Units not picked are said first. The job ends on the phone at once |
| Receipt | Sending, then Sent; each order's stage once PartsLogic has the end (To pack, Ready for collection, To pick); each refused pick in words with its order |
| Pack | The branch's deliveries to pack (`picking_list`, view to_pack); scan each part into the box, or + when it won't scan; How many parcels? from 1; Packed |

## Offline

Starting needs signal; everything after is saved on the phone and queued (`src/queue/items.ts`). `sales_order_pick`
adds each call to the row's pick and takes no id made on the phone, so the phone never sends one call per scan: it
queues each row's total so far (by scan, and by tap), and the sender reads the job and sends the difference
(`src/features/pick/pick-queue.ts`). Sent twice, the second sends nothing; a scan taken back sends the units back
(`pick_job_unscan`). Each row is its own stream, so a refused pick holds back only its row; the job's end is queued
last. Packed sent twice finds the order packed, which counts as done.

## Decisions made in the build

| Decision | Why |
|---|---|
| Copper is #8B5A2B (dark #E2B280) | The owner's deep brown-orange; 5.8:1 on white and 5.0:1 on its soft fill. OKLab ΔE 13.9 from `stop` red, as close as plum is to violet; never the only sign (name and icon) |
| No second No signal strip on the job | Every job screen already has the offline banner ("Offline · saving on this phone"); the deck's strip would say it twice (P7) |
| Can't scan starts at 1 unit | A tap stands in for a scan, which adds one; the deck's "− 0 +" would need a step before Add works |
| A short pick on the phone is recorded as the phone's (scan) | The units found in it move as the web's short pick moves them; only scans and taps say how a unit was confirmed |
| The receipt names stages in the web's words | `fulfilmentLabel`: "Ready for collection", not the deck's "Ready to collect"; the database has no "Part ready" stage (an order part picked is still To pick) |
| A scanned bin label, and a code the phone can't check offline, have their own cards | "A bin label · Scan the part"; "Not checked · No signal · use Can't scan on its row" (words not in the deck) |
| Stop picking sits at the foot of the rows | The job's only other action; the native header holds no menu on any job screen |
| Rows sit under the bin they're in | The walk reads bin by bin; picked rows and rows needing a count follow |
| Finish says what's picked | "Finish · 9 units"; units not picked are said in its sheet before anything ends |
| Pack: + puts a part in without a scan | The deck's tap; Packed is sent as tap when any unit went in that way |

## Checks

| Phase | Evidence |
|---|---|
| 5 Build | Commits from `Sync PartsLogic shared code from main (a802a03)` to the review; 241 unit tests (job, queue, receipt, pack, badges) |
| 6 Script, detector | Review gallery: 28 outbound screens at 390 wide, light and dark, no page errors, no sideways scroll; detector `[]` on the source and on rendered screens; server contract: 43 functions, nothing broken |
