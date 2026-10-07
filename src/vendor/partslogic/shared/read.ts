import type { Json } from '@partslogic/db-types';

// Narrow untyped JSON from the database into the shapes the app uses. Anything malformed
// becomes null or an empty list rather than a crash in the UI.

export type JsonRecord = { [key: string]: Json | undefined };

export function readRecord(value: Json | undefined): JsonRecord | null {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value;
  }
  return null;
}

export function readArray(value: Json | undefined): Json[] {
  return Array.isArray(value) ? value : [];
}

export function readStrings(value: Json | undefined): string[] {
  return readArray(value).filter((item): item is string => typeof item === 'string');
}

export function readString(value: Json | undefined): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

// Postgres numerics arrive as numbers or strings depending on size; both are accepted.
export function readNumber(value: Json | number | string | null | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function readBoolean(value: Json | undefined): boolean | null {
  return typeof value === 'boolean' ? value : null;
}
