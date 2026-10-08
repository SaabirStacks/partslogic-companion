// Small wording helpers shared by every screen, so times and counts read the same everywhere.

// 09:14, in the phone's own time zone.
export function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// "1 unit", "24 units".
export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}
