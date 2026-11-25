import type { EnrichmentRunRecord } from '../enrichment/runs';
import type { PartConfirmed, PartDetail } from './part-detail';

// The part window's catalogue data (docs/design-checks/part-window.md): the six details a part needs (DESIGN.md, Data
// enrichment level), how many it has, the state of its filling and its last run, in words. The header's figure and
// Overview's card both read these, so the two never say it differently. Pure: no clock, no client; days come in
// through `day`.

export type CatalogueDetailKey = 'photo' | 'category' | 'barcode' | 'oe' | 'vehicles' | 'specs';

// In DESIGN.md's order.
export const CATALOGUE_DETAILS: readonly { key: CatalogueDetailKey; label: string }[] = [
  { key: 'photo', label: 'Photo' },
  { key: 'category', label: 'Category' },
  { key: 'barcode', label: 'Barcode' },
  { key: 'oe', label: 'OE numbers' },
  { key: 'vehicles', label: 'Vehicles' },
  { key: 'specs', label: 'Specs' },
];

// `confirmed` says how much of what the row holds a person has checked ("1 confirmed", "all confirmed"); null when
// nothing is, and for the photo and the category, which carry no claim state. The row's tick stays neutral: a detail
// being there is not the same as it being checked (owner, 24 November 2026).
export type CatalogueDetail = { key: CatalogueDetailKey; label: string; present: boolean; value: string; confirmed: string | null };

type DetailFacts = Pick<PartDetail, 'gaps' | 'counts' | 'categoryTrail'> & { confirmed?: PartConfirmed };

const CONFIRMABLE: Partial<Record<CatalogueDetailKey, keyof PartConfirmed>> = {
  barcode: 'barcodes',
  oe: 'oe',
  vehicles: 'vehicles',
  specs: 'specs',
};
const COUNT_OF: Record<keyof PartConfirmed, keyof PartDetail['counts']> = {
  barcodes: 'barcodes',
  oe: 'oe',
  vehicles: 'vehicles',
  specs: 'specs',
};

function confirmedWord(confirmed: number, of: number): string | null {
  if (confirmed <= 0 || of <= 0) return null;
  if (confirmed >= of) return of === 1 ? 'confirmed' : 'all confirmed';
  return `${confirmed.toLocaleString('en-GB')} confirmed`;
}

const plural = (count: number, one: string, many: string) => `${count.toLocaleString('en-GB')} ${count === 1 ? one : many}`;

// Credits as the card and Fill gaps say them: "1 credit", "9 credits"; the unit alone for "4 Autodoc + 1 Firecrawl credits".
export const creditUnit = (count: number) => (count === 1 ? 'credit' : 'credits');
export const credits = (count: number) => `${count.toLocaleString('en-GB')} ${creditUnit(count)}`;

// Each detail with what the part holds for it ("3 photos", "Braking System › Brake pads", "12") or "Missing".
export function catalogueDetails(part: DetailFacts): CatalogueDetail[] {
  const value: Record<CatalogueDetailKey, string> = {
    photo: plural(part.counts.images, 'photo', 'photos'),
    category: part.categoryTrail.join(' › ') || 'Set',
    barcode: plural(part.counts.barcodes, 'barcode', 'barcodes'),
    oe: part.counts.oe.toLocaleString('en-GB'),
    vehicles: part.counts.vehicles.toLocaleString('en-GB'),
    specs: part.counts.specs.toLocaleString('en-GB'),
  };
  return CATALOGUE_DETAILS.map(({ key, label }) => {
    const present = !part.gaps[key];
    const field = CONFIRMABLE[key];
    const confirmed = present && field && part.confirmed ? confirmedWord(part.confirmed[field], part.counts[COUNT_OF[field]]) : null;
    return { key, label, present, value: present ? value[key] : 'Missing', confirmed };
  });
}

// How a run ended, as the web app reads its stored result (the chain's own shape; extra fields are ignored).
export type CatalogueRunOutcome = {
  status: 'applied' | 'nothing_found' | 'nothing_missing' | 'failed' | 'deferred' | 'preview';
  credits: { piloterr: number; firecrawl: number };
  gapsBefore: readonly string[];
  gapsLeft: readonly string[];
  message: string | null;
};

export type CatalogueStateKind =
  | 'filled'
  | 'checked'
  | 'not_filled'
  | 'filling'
  | 'queued'
  | 'no_match'
  | 'failed'
  | 'covered'
  | 'complete';

// green a settled fact, amber something to check, red what stops; the rest stays quiet (DESIGN.md colour rules)
export type CatalogueTone = 'success' | 'warning' | 'danger' | 'neutral';

export type CatalogueData = {
  details: CatalogueDetail[];
  have: number;
  of: number;
  state: CatalogueStateKind;
  // Under the header's figure: "Filled 24 Nov", "No match 21 Nov", "Queued".
  word: string;
  tone: CatalogueTone;
  // The card's last-run line: "Filled 24 Nov by Priya Shah · added photo, specs".
  lastRun: string;
  // What an editor does next: "Fill gaps", "Check again", "Fill again" (after a failure: a paid run again, not a
  // reload) or "View progress".
  action: 'Fill gaps' | 'Check again' | 'Fill again' | 'View progress';
  // The figure's name for a screen reader: "Catalogue data: 5 of 6 details. Filled 24 Nov".
  label: string;
  // The details the last run filled, for the "New" mark and the developer's sources.
  added: CatalogueDetailKey[];
  // Credits the last run spent (the developer's, with sources shown).
  credits: number;
  // A part skipped because a part on the same OE number was filled: that part, for the card to open.
  coveredBy: { id: number; brand: string; number: string } | null;
};

export type CatalogueDataInput = {
  part: DetailFacts & Pick<PartDetail, 'enrichment'>;
  // The part's newest run and its result read back; null when it has never had one.
  run: Pick<EnrichmentRunRecord, 'status' | 'by' | 'startedAt' | 'finishedAt' | 'updatedAt'> | null;
  outcome: CatalogueRunOutcome | null;
  // What the run is doing now ("Vehicle lists 3 of 10"), while it runs.
  activity?: string | null;
  // The developer with Show sources on: a failure's reason as the server wrote it, provider names and all.
  sources?: boolean;
  day: (iso: string) => string;
};

// How the six gap keys read inside a sentence ("added photo, specs").
const GAP_WORDS: Record<string, string> = {
  photo: 'photo',
  category: 'category',
  barcode: 'barcode',
  oe: 'OE numbers',
  vehicles: 'vehicles',
  specs: 'specs',
  xrefs: "other brands' numbers",
  name: 'name',
  description: 'description',
};

const PROVIDERS = /autodoc|piloterr|firecrawl/i;

// Whether a line names a provider (a server's message, a step's detail): staff are never shown one.
export function namesProvider(text: string | null | undefined): boolean {
  return text != null && PROVIDERS.test(text);
}

// A failure's reason in plain words, to follow a "·" (so it starts in lower case, as the other run lines do). Staff
// never see a provider's name (owner, 24 November 2026): a reason that names one is said without it.
export function runFailureReason(message: string | null, sources = false): string {
  // "enrichment run" is the server's word; the window says "run"
  const text = (message?.trim() || 'the run failed').replace(/\benrichment run\b/i, 'run');
  const plain = !sources && namesProvider(text) ? 'a source could not be read' : text;
  // an ordinary first word goes to lower case; a name (a provider's, for the developer) keeps its capital
  return plain.replace(/\.$/, '').replace(/^(The|A|An|No|Not|Nothing|Ran|Run|Could|Every|None)\b/, (first) => first.toLowerCase());
}

// The same reason as a sentence of its own (the panel's result): capital first, full stop at the end.
export function asSentence(text: string): string {
  const trimmed = text.trim().replace(/\.$/, '');
  return trimmed ? `${trimmed[0]!.toUpperCase()}${trimmed.slice(1)}.` : '';
}

const isDetail = (key: string): key is CatalogueDetailKey => CATALOGUE_DETAILS.some((detail) => detail.key === key);

export function catalogueData(input: CatalogueDataInput): CatalogueData {
  const details = catalogueDetails(input.part);
  const have = details.filter((detail) => detail.present).length;
  const of = details.length;
  const { run, outcome, part, day } = input;
  const target = part.enrichment;
  const by = run?.by ? ` by ${run.by}` : '';
  const ended = run?.finishedAt ?? run?.updatedAt ?? null;
  const when = ended ? ` ${day(ended)}` : target?.updatedAt ? ` ${day(target.updatedAt)}` : '';
  const filled = outcome ? outcome.gapsBefore.filter((gap) => !outcome.gapsLeft.includes(gap)) : [];
  const added = filled.filter(isDetail);
  const credits = outcome ? outcome.credits.piloterr + outcome.credits.firecrawl : (target?.creditsSpent ?? 0);

  let state: CatalogueStateKind;
  let lastRun: string;
  if (run?.status === 'running' || target?.status === 'in_progress') {
    state = 'filling';
    lastRun = input.activity ? `Filling now · ${input.activity}` : 'Filling now';
  } else if (run && outcome) {
    if (outcome.status === 'applied' && filled.length) {
      state = 'filled';
      lastRun = `Filled${when}${by} · added ${filled.map((gap) => GAP_WORDS[gap] ?? gap).join(', ')}`;
    } else if (outcome.status === 'applied' || outcome.status === 'nothing_missing' || outcome.status === 'preview') {
      state = 'checked';
      lastRun = `Checked${when}${by} · ${outcome.status === 'nothing_missing' ? 'nothing was missing' : 'nothing new found'}`;
    } else if (outcome.status === 'nothing_found') {
      state = 'no_match';
      lastRun = `No match${when}${by} · ${target?.status === 'mismatch' ? 'page was for another part' : 'no page found'}`;
    } else {
      state = 'failed';
      const reason = outcome.status === 'deferred' ? 'no credits left in the budget' : runFailureReason(outcome.message, input.sources);
      lastRun = `Failed${when}${by} · ${reason}`;
    }
  } else if (run?.status === 'failed') {
    state = 'failed';
    lastRun = `Failed${when}${by} · ${runFailureReason(null)}`;
  } else if (target?.status === 'queued') {
    state = 'queued';
    // what happens next, not only the state (round 2)
    lastRun = 'Queued · fills in the background';
  } else if (target?.status === 'skipped') {
    state = 'covered';
    // names the part that covered it (round 3: "says nothing usable")
    const cover = target.coveredBy;
    lastRun = cover ? `Covered by ${cover.brand} ${cover.number} · same OE number` : 'Covered by a part on the same OE number';
  } else if (target?.status === 'applied') {
    state = 'filled';
    lastRun = `Filled${when}`;
  } else if (target?.status === 'no_match' || target?.status === 'mismatch') {
    state = 'no_match';
    lastRun = `No match${when} · ${target.status === 'mismatch' ? 'page was for another part' : 'no page found'}`;
  } else if (target?.status === 'failed') {
    state = 'failed';
    lastRun = `Failed${when} · ${runFailureReason(target.lastError, input.sources)}`;
  } else if (have === of) {
    state = 'complete';
    lastRun = 'Complete';
  } else {
    state = 'not_filled';
    lastRun = 'Not filled yet';
  }

  const word = {
    filled: `Filled${when}`,
    checked: `Checked${when}`,
    not_filled: 'Not filled yet',
    filling: 'Filling now',
    queued: 'Queued',
    no_match: `No match${when}`,
    failed: `Failed${when}`,
    covered: 'Covered',
    complete: 'Complete',
  }[state];
  // Green is for what a person confirmed (owner, 24 November 2026: "Only confirmed"): filled, checked and complete
  // are facts from a source, said in ink; amber is something to look at, red what stopped.
  const tone: CatalogueTone =
    state === 'no_match'
        ? 'warning'
        : state === 'failed'
          ? 'danger'
          : 'neutral';
  const action =
    state === 'filling' ? 'View progress' : state === 'failed' ? 'Fill again' : have === of ? 'Check again' : 'Fill gaps';

  return {
    details,
    have,
    of,
    state,
    word,
    tone,
    lastRun,
    action,
    label: `Catalogue data: ${have} of ${of} details. ${word}`,
    added,
    credits,
    coveredBy: state === 'covered' ? (target?.coveredBy ?? null) : null,
  };
}
