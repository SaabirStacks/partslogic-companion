// Joins class names, skipping the falsy ones: cx('a', busy && 'opacity-50').
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
