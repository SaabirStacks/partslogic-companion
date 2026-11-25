// Small wording helpers shared by every screen, so times and counts read the same everywhere.

// 09:14, in the phone's own time zone.
export function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// A time with its day when it isn't today: "09:14", "Yesterday 15:57", "27 Oct 13:28" (and the year when
// it isn't this year), so an old time never passes for today's.
export function when(iso: string, now = new Date()): string {
  const at = new Date(iso);
  const day = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((day(now) - day(at)) / 86_400_000);
  if (days === 0) return clock(iso);
  if (days === 1) return `Yesterday ${clock(iso)}`;
  const date = at.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(at.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
  return `${date} ${clock(iso)}`;
}

// "1 unit", "24 units".
export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

// A code that must never break across lines (a part number, an order number, B-02): its spaces and hyphens become
// ones a line never breaks at, so "C 35 154" can't leave "154" alone on a line where it reads as a quantity.
export function unbroken(text: string): string {
  return text.replace(/ /g, '\u00a0').replace(/-/g, '\u2011');
}

// A part as the floor reads it off the label: "MANN-FILTER C 35 154" (the description goes on its own line). The
// number never breaks; a long brand may.
export function partNumber(part: { brand: string; number: string }): string {
  return [part.brand, unbroken(part.number)].filter(Boolean).join(' ');
}
