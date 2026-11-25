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
| 6 Script, detector | Review gallery: 29 outbound screens at 360, 390 and 430 wide, light and dark, no page errors, no sideways scroll, no code broken across lines (`broken-words` check); detector `[]` on the source and on rendered screens; server contract: 43 functions, nothing broken |
| 7 Audit | Reviewer B: 15/20 (Accessibility 3, Performance 3, Theming 4, Responsive 2, Integrity 3); every text AA (lowest 5.12:1), every target at least 48 |
| 8 Critique round 1 | A 29/40 (on the first build), B 31/40 (after A's fixes); combined 29, lowest per heuristic (Consistency 2) |
| 9 Fixes | Run log below |

## Run log

| Round | Found | Done |
|---|---|---|
| 1, A | The order was small on the scan card; part numbers broke across lines; the row menu was a small target; Finish and Packed pressable with nothing to finish; Stop's sheet said less than Finish's; "All picked" with units short; the job's offline words; Scan again not the lead on Not on this pick | The card leads "Put with SO-000019"; codes never break; the whole row opens its menu; Finish waits for a pick or a short and Packed reads "1 of 3 in the box" till ready; Stop shows Picked and Not picked; "Nothing left to pick · 3 short"; "No signal · Picks send when it's back"; Scan again leads |
| 1, A (not taken) | Offline scans fall back to Can't scan | The phone keeps every part's codes (the offline scan list, every 15 minutes), so known parts scan offline; only a code never seen says Not checked, now with "scan it again with signal, or use Can't scan" |
| 1, B | Pack could lose a scan made while another was checked, and bring back a closed box; Pack rows cut "MANN-FILTE / R" at 360; sheets opened on the backdrop for screen readers; the camera counted scans under sheets, and a late scan could reopen an ended job; the receipt counted refused units as picked; bin codes broke in refusals; Pack's box was lost on leaving; Can't scan reasons merged; "1 units"; iOS didn't announce scans | Pack builds on its latest box and drops answers for a closed one; − n + under the part, only the number unbreakable; the backdrop is hidden from screen readers and focus goes to the sheet's title, which names the dialog; sheets pause the camera and Finish clears the job before saving; the receipt uses PartsLogic's counts once the end is sent; codes in reasons kept whole; the box is kept on the phone and Another order asks first; taps join only the same reason; spoken plurals; each scan is announced |
| 1 (kept) | Two phones on one job with unsent picks on both; a job quiet for two hours ends and its queued picks are refused; Pack's list needs signal; the scan card's buttons are 48 tall; location named on Start | Rare and visible: the refused picks are on the receipt in words (owner, 25 November 2026); orders change while offline; the same size as Receive's card; the deck's words, for the owner |

