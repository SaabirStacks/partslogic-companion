// The app's copy of public.normalise_part_number in PartsLogic (supabase/schema.sql):
//   NULLIF(regexp_replace(upper(COALESCE(value, '')), '[^A-Z0-9]', '', 'g'), '')
// so an offline lookup keys a typed or scanned part number exactly as the server does.
// "W 712/75", "w712-75" and "W71275" all become "W71275".
export function normalisePartNumber(value: string | null | undefined): string | null {
  const key = (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return key === '' ? null : key;
}
