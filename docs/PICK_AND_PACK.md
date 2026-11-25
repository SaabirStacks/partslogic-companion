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
| No second No signal strip on the job | The job screen's one offline banner says the deck's words ("No signal · Picks send when it's back"; Pack's "Packed sends when it's back") instead of the app's; a second strip would say it twice (P7) |
| Can't scan starts at 1 unit | A tap stands in for a scan, which adds one; the deck's "− 0 +" would need a step before Add works |
| A short pick on the phone is recorded as the phone's (scan) | The units found in it are counted, not scanned, and move as the web's short pick moves them; the record keeps the short and its reason, which is what the owner asked to see |
| The receipt names stages in the web's words | `fulfilmentLabel`: "Ready for collection", not the deck's "Ready to collect"; the database has no "Part ready" stage (an order part picked is still To pick) |
| A scanned bin label, and a code the phone can't check offline, have their own cards | "A bin label · Scan the part"; "Not checked · No signal · scan it again when it's back, or use Can't scan" (words not in the deck). The phone keeps every part's codes, so a known part scans offline; this card is for a code it has never seen |
| Not on this pick leads with Scan again, not Short pick | A misread or a neighbour's part is commoner than a missing one; Short pick is the second button, and stays on the row's menu |
| Pack's list needs signal; Packed is queued | Which deliveries are ready changes as others pick and pack; a list from earlier could send a packer to an order already packed. Packed itself is saved and sent when the signal is back |
| Undo the last scan is the square icon beside Finish, named for screen readers | As Receive's, so both jobs undo alike |
| Start picking and Carry on sit in the empty state, not a pinned bar | As every job's first screen (Notice) |
| Start reads "20 units for 9 orders": no branch, and the orders free to claim | Owner, 25 November 2026: the board's pill names the branch (DESIGN.md), and orders on other pickers' jobs can't be claimed |
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
| 10 Confirm (round 2) | A 31/40, B 33/40 (audit 16/20; B's queue simulation: replays, lost answers and an undo all come to the right count); combined 30/40, every heuristic 3. No P0 or P1. Both rounds below 31, so the owner decides: ship or a third round |

## Run log

| Round | Found | Done |
|---|---|---|
| 1, A | The order was small on the scan card; part numbers broke across lines; the row menu was a small target; Finish and Packed pressable with nothing to finish; Stop's sheet said less than Finish's; "All picked" with units short; the job's offline words; Scan again not the lead on Not on this pick | The card leads "Put with SO-000019"; codes never break; the whole row opens its menu; Finish waits for a pick or a short and Packed reads "1 of 3 in the box" till ready; Stop shows Picked and Not picked; "Nothing left to pick · 3 short"; "No signal · Picks send when it's back"; Scan again leads |
| 1, A (not taken) | Offline scans fall back to Can't scan | The phone keeps every part's codes (the offline scan list, every 15 minutes), so known parts scan offline; only a code never seen says Not checked, now with "scan it again with signal, or use Can't scan" |
| 1, B | Pack could lose a scan made while another was checked, and bring back a closed box; Pack rows cut "MANN-FILTE / R" at 360; sheets opened on the backdrop for screen readers; the camera counted scans under sheets, and a late scan could reopen an ended job; the receipt counted refused units as picked; bin codes broke in refusals; Pack's box was lost on leaving; Can't scan reasons merged; "1 units"; iOS didn't announce scans | Pack builds on its latest box and drops answers for a closed one; − n + under the part, only the number unbreakable; the backdrop is hidden from screen readers and focus goes to the sheet's title, which names the dialog; sheets pause the camera and Finish clears the job before saving; the receipt uses PartsLogic's counts once the end is sent; codes in reasons kept whole; the box is kept on the phone and Another order asks first; taps join only the same reason; spoken plurals; each scan is announced |
| 1 (kept) | Two phones on one job with unsent picks on both; a job quiet for two hours ends and its queued picks are refused; Pack's list needs signal; the scan card's buttons are 48 tall; location named on Start | Rare and visible: the refused picks are on the receipt in words (owner, 25 November 2026); orders change while offline; the same size as Receive's card; the deck's words, for the owner |
| 2, A | A tally's number alone on a line at 360; the parcels − live at 1; Pack said "1 of 2" four times; Not on this order had no next step; a red chip for a mostly sent job; bin headings looked pressable; the Resume line cut at 360; gallery gaps | Numbers stay with "of"; steppers know their bounds; rows say "1 to go in"; "Put it back"; amber "1 pick refused"; plain bin headings; "6 of 14 units picked"; Can't scan, sent receipt, Pack ready and a job's foot added |
| 2, B | The row sheet kept focus nowhere on a step change; the chip counted items, and an end refused said "0 not picked"; a last scan could queue after the end; an empty job read would pick a row twice; the spoken row left out Urgent; Android heard scans twice; long bin codes cut at large text; Pack's offline words | Focus follows the sheet's title; "1 pick refused", or "Check in Sync" with "Not ended · why"; every save and send runs in turn and the end waits for them; no job, nothing sent; the row says urgent and its state; announce on iOS only; the banner shrinks to fit; "No signal · Packed sends when it's back"; Undo reads "Undo the last unit" |
| 2 (kept) | 48 pt buttons on the scan card; no Short pick undo on the phone | As Receive's card; Picked today on the web undoes a short pick |
| 2 (owner) | Location named on Start, and its order count included orders on other pickers' jobs | Owner, 25 November 2026: "20 units for 9 orders", no branch, free orders |
| 11 Hand-off | Owner, 25 November 2026: open the pull request at 30/40 (two rounds, 29 then 30, no P0 or P1); the kept items above are its design debt |
