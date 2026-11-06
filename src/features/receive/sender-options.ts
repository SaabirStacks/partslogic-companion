import type { Sender } from './sender';

// One row in the Who's it from? list.
export type SenderOption = Sender & { detail: string | null };

// Suppliers filtered by what's typed: any part of the name, ignoring case and spaces.
export function filterSenders(options: SenderOption[], query: string): SenderOption[] {
  const want = squash(query);
  return want === '' ? options : options.filter((option) => squash(option.name).includes(want));
}

const squash = (text: string) => text.toLowerCase().replace(/\s+/g, '');

const RECENT_MAX = 8;

// The senders this phone used last, newest first, one of each: they sit at the top of the list so the
// usual suppliers are a tap away, with or without signal.
export function rememberSender(recent: Sender[], used: Sender): Sender[] {
  const others = recent.filter((sender) => !(sender.kind === used.kind && sender.id === used.id));
  return [{ kind: used.kind, id: used.id, name: used.name }, ...others].slice(0, RECENT_MAX);
}

// The list to show for one kind: recent ones first (only while nothing is typed), then the rest, each
// sender once.
export function senderList(kind: Sender['kind'], options: SenderOption[], recent: Sender[], query: string): SenderOption[] {
  const matches = filterSenders(options, query);
  if (query.trim() !== '') return matches;
  const mine = recent
    .filter((sender) => sender.kind === kind)
    .map((sender) => matches.find((option) => option.id === sender.id) ?? { ...sender, detail: null });
  const ids = new Set(mine.map((sender) => sender.id));
  return [...mine, ...matches.filter((option) => !ids.has(option.id))];
}

// Suppliers expected today go to the top, in the order they're due, each saying what's due ("2 orders due today ·
// 13:00–15:00"); the rest keep their place. While something is typed the list isn't reordered, but still says.
export function withExpected(
  options: SenderOption[],
  expected: readonly { supplierId: number; text: string }[],
  query: string,
): SenderOption[] {
  if (expected.length === 0) return options;
  const due = new Map(expected.map((item) => [item.supplierId, item.text]));
  const marked = options.map((option) => (option.kind === 'supplier' && due.has(option.id) ? { ...option, detail: due.get(option.id) ?? null } : option));
  if (query.trim() !== '') return marked;
  const rank = new Map(expected.map((item, index) => [item.supplierId, index]));
  const first = marked.filter((option) => option.kind === 'supplier' && rank.has(option.id)).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
  return [...first, ...marked.filter((option) => !(option.kind === 'supplier' && rank.has(option.id)))];
}
