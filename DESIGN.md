# PartsLogic phone app: design system

The look is the **trade counter**: calm like a good till, built for a warehouse floor. Staff read it at arm's
length, in poor light, often one-handed with gloves on. This file records the system as it ships. The code is
the source: when they differ, the code wins and this file gets updated. `PRODUCT.md` says who the app is for
and what must never happen.

| Where | What |
|---|---|
| `src/ui/palette.ts` | Every colour, light and dark, as named roles |
| `src/ui/text.tsx` | The type scale |
| `src/ui/surface.tsx`, `depth.ts` | Cards, pressable cards, fills and depth |
| `src/ui/family.ts` | The family colours, as literal class names |
| `src/ui/motion.ts`, `ticking.tsx`, `progress-bar.tsx` | Every move the app makes |
| `src/feel/moments.ts` | Every sound and haptic, one row per moment |
| `src/dev/gallery.web.tsx` | The review gallery: every screen drawn from fixtures |

## Colour has three jobs

Nothing is coloured for decoration. If something is coloured, it is doing one of these three jobs.

| Job | Colours | Where it appears |
|---|---|---|
| **Press this** | Blue `action` #154889 (the app icon's blue) | The main button; a second button is the blue tint `action-soft` with blue words |
| **A state** | Green `ok`, yellow `warn`, red `stop` | Chips, strips and receipt numbers, always with a word and a symbol |
| **Which family** | Teal `inbound`, violet `control` (stock), plum `parts` | A job's tile, the rule under its header, its section dot, its progress bar. Never a button |

Everything else is the counter's neutrals:

| Role | Light | Dark | Use |
|---|---|---|---|
| `ground` | #F2F4F6 | #0F1113 | The counter, behind everything |
| `surface` | #FFFFFF | #1B1E22 | Cards |
| `edge` | #D8DDE2 | #34393F | A card's hairline border |
| `rule` | #E8EBEE | #262A2F | Lines between rows; disabled fills; tracks |
| `ink` | #121417 | #EEF0F2 | Words |
| `label` | #343A42 | #CDD2D7 | Section headings and field labels (darker than quiet, readable at arm's length) |
| `quiet-ink` | #565D65 | #AAB1B8 | Secondary lines |

Each state and family colour has a `-soft` fill for chips and icon squares. Each state also has an `-ink` for
its words on white or on its soft fill, and a strong fill with `on-*` words. The strong fill is kept for the
rare thing that must be seen across the room. Dark mode keeps the same roles, lifted so they read on graphite.

Rules:
- Never colour alone. A state is a word plus a symbol; a family is also a name and an icon.
- A list choice is marked by shape, not colour: a dark outline and a tick (`Choice`, `BinChip`, tiles).
- The location is shown once, on the board's pill. Job screens never repeat it. A bin in another location is
  named with that location first (`features/bins/bin-name.ts`).

## Type

The phone's own typeface (San Francisco, Roboto), in sentence case. Codes and quantities use tabular figures
(`numbers`), except codes with hyphens such as A-01 or GR-0042.

| Variant | Size / line | Weight | For |
|---|---|---|---|
| `display` | 40 / 44 | 800 | Part numbers, a receipt's reference |
| `headline` | 28 / 32 | 700 | Totals (on hand, a tally), quantities, screen titles |
| `title` | 20 / 25 | 700 | Card titles, bin names in rows |
| `body` | 17 / 23 | 400 | Sentences, when one is needed |
| `label` | 17 / 22 | 600 | Row names, button words |
| `caption` | 15 / 20 | 400 | The line under a name |
| `section` | 14 / 19 | 700, upper case, 0.6 tracking | Section headings, in `label` grey |

Text follows the phone's reading size. The largest sizes grow less (display up to 1.35×, headline 1.5×), so
the layout holds at the biggest settings.

## Surfaces and depth

White cards with 12 pt corners and a hairline `edge` sit on the grey counter. Depth has three levels
(`depth.ts`):

| Level | Light mode | Dark mode | Used for |
|---|---|---|---|
| `flat` | none | none | Rows inside a card, tinted and state cards, anything disabled |
| `lift` | 6% shadow, 4 pt blur, 1 pt down | none | Ordinary white cards (the default) |
| `raise` | 14% shadow, 14 pt blur, 6 pt down | elevation 6 | The scan result card over the camera; the photo |

A pressable card darkens and sinks to 98% while held. Main targets are at least 56 pt tall; the − and +
steppers are 56 × 56.

## Buttons

| Variant | Look | Touch |
|---|---|---|
| `primary` | Solid blue, white words | Light tap |
| `tinted` | Blue tint, blue words | Light tap |
| `secondary` | White card, dark words | None |
| `destructive` | Solid red, white words | Firm tap |

One primary per screen, pinned at the bottom (`ActionBar`, `BottomBar`) in the thumb zone.

## Layout of a job

Every scanning job is laid out the same way (`JobScreen`), so a scan always lands in the same place:
1. A banner saying what the job is locked to (who a delivery is from, which bin), with its family rule.
2. The camera across the top third, with white aim marks. It dims and says Paused while a scan is held.
3. The result card, raised, rising over the camera's bottom edge.
4. The tally (big totals) and the lines, scrolling.
5. The one main action, pinned at the bottom.

A part's stock (`StockCard`) opens like a scan's result card: where stock stands as a chip on the left (In
stock, Reorder, Out of stock), the total on hand on the right. Under it, three compact tiles that always add
up to on hand: **Available** (green, can be sold), **Reserved** (yellow, promised to an order) and
**Unavailable** (red, held or locked). Each is an outlined tile with the cards' 12 pt corners, the count over
its name; a tile with nothing in it stays grey. Inside a tile, its statuses (a pause mark for held, a lock
for locked); under each bin, what in it is set aside. The nine stock statuses and their groups live in
`src/stock/statuses.ts`. PartsLogic doesn't tag stock yet, so today everything on hand is Available.

A job ends with a receipt (`ReceiptCard`): where it stands (a chip that fills in as PartsLogic answers), the
reference large, when, then the numbers as rows. Lists that can be fetched again pull to refresh. Loading
lists show grey placeholder rows in the list's shape, not a lone spinner.

## Motion

Motion only ever shows a change of state, and is fast enough that nobody waits for it. With Reduce Motion
on, anything that travels or grows is switched off; fades stay.

| Move | What it shows | Timing |
|---|---|---|
| **Chip sweep** (the app's one authored moment) | PartsLogic answering: a status chip turns to its new state (Sending → Delivery booked, Counting → Counted). The new colour sweeps in from the symbol's side as the old one draws back, and the symbol lands | 300 ms sweep, 220 ms land |
| `RISE` / `DROP` | The result card or a receipt arriving; the result card leaving once its scan is dealt with | 160 ms in, 120 ms out |
| `APPEAR` / `FADE` | Something new in place (a line, a resume row, a line's new status, a stock take notice); the camera's dim fading in and lifting when a scan is held | 160 ms in, 120 ms out |
| `BANNER_IN` / `BANNER_OUT` | The no-signal strip dropping in when signal goes, lifting when it's back (not on a screen opened offline) | 200 ms in, 150 ms out |
| `TICK_IN` | The tick landing on the one chosen (a location, a supplier, a bin) | 160 ms |
| Segmented slide | The white selector sliding to the chosen view (Supplier \| Manufacturer, Tab view \| List view) | 200 ms |
| `SETTLE` | Neighbours making room | 180 ms |
| `STEP_IN` / `STEP_BACK` | Tab view's next tiles, from the side being moved towards | 180 ms |
| `Ticking` | A number changed (tally, − / + quantity, on hand): it swells to 114% and back | 80 + 220 ms |
| `ProgressBar` | A stock take's bins counted, filling in the family colour | 420 ms |
| `PlaceholderRows` | A list on its way: grey rows breathing | 900 ms each way |

## Sound and touch

One table (`src/feel/moments.ts`) says what each moment sounds and feels like; `feel(moment)` plays it.
Touch always plays. Sounds can be turned off in Account, and they follow the silent switch and mix with
music or a radio. The tones come from `scripts/render-sounds.mjs`: short, plain tones, never tunes.

| Moment | When | Sound | Haptic |
|---|---|---|---|
| `scan` | A barcode is read and it's what the job expects | One short beep | Success |
| `unknown` | Not known, a doubtful match, or not what this step needs | Two beeps | Warning |
| `refused` | PartsLogic said no, or the phone couldn't ask | A low buzz | Error |
| `done` | A delivery, count, stock take, move or new part is finished | Two rising notes | Success |
| `found` / `nothing` | A look-up filled in a part, or found nothing | Three rising notes / two falling | Success / warning |
| `tick` | − and +, switches, choosing from a list | A quiet tick | Selection |
| `press` | A main button | None | Light |
| `firm` | A red button | None | Heavy |

## Words

Plain UK English, sentence case, the floor's own words ("Put away", "Unbinned", "Stock take"). Numbers over
sentences. No explanation paragraphs; at most one short line where a number can't say it. Nothing technical
reaches staff.

## Review gallery

Every screen can be drawn on the web from fixtures, at phone size, in light and dark:

```sh
npx expo export --platform web --output-dir /tmp/web-dist
python3 -m http.server 8099 --directory /tmp/web-dist
# then open http://localhost:8099/?screen=board (or part, receive, count, account, ...)
```

Screenshots from it go in `.impeccable/review/`, which git ignores (they're remade, not kept). The phones
never load the web build.
