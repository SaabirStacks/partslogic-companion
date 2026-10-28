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
