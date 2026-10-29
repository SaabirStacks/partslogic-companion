// What to say when PartsLogic won't open a bin count, from its answer. One person counts a bin at a time,
// for any job: a count holds its bin while someone scanned into it in the last 2 hours.
export function refusalText(message: string): { title: string; body: string; holder: string | null } {
  const text = message.trim();
  const holder = /^(.+) is counting that bin$/.exec(text)?.[1] ?? null;
  if (holder) return { title: text, body: 'Choose another bin. It frees up once they finish, or after 2 hours without a scan.', holder };
  if (/^That (stock take|opening stock) was finished$/.test(text))
    return { title: text, body: 'Nobody can start another bin of it.', holder: null };
  if (/isn.t on this stock take.s list$/.test(text)) return { title: text, body: 'Count it as a Stock count instead.', holder: null };
  return {
    title: text || 'PartsLogic didn’t open the count',
    body: 'Nothing was started. Choose another bin, or try again.',
    holder: null,
  };
}
