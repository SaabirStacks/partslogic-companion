// Barcodes as the database reads them (public.gtin14, public.is_restricted_gtin), so a screen can say
// "that check digit is wrong" before anything is sent.

const LENGTHS = new Set([8, 12, 13, 14]);

function digitsOf(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

// Something typed or scanned that is only digits (spaces allowed) of a barcode's length.
export function looksLikeBarcode(value: string): boolean {
  const trimmed = value.trim();
  return /^[0-9 ]+$/.test(trimmed) && LENGTHS.has(digitsOf(trimmed).length);
}

// The 14-digit form with a valid GS1 check digit, or null.
export function gtin14(value: string): string | null {
  const digits = digitsOf(value);
  if (!LENGTHS.has(digits.length)) return null;
  const padded = digits.padStart(14, '0');
  if (padded === '00000000000000') return null;
  let total = 0;
  for (let i = 0; i < 13; i++) total += Number(padded[i]) * (i % 2 === 0 ? 3 : 1);
  return (10 - (total % 10)) % 10 === Number(padded[13]) ? padded : null;
}

// Shop-own codes (GS1 restricted circulation, such as 2xxxxxxxxxxxx) name nothing outside the shop that
// printed them: the database keeps them as a reference, not a barcode.
export function isRestrictedGtin(value: string): boolean {
  const digits = digitsOf(value);
  switch (digits.length) {
    case 14:
      return digits[0] === '0' && (['02', '04'].includes(digits.slice(1, 3)) || digits[1] === '2');
    case 13:
      return ['02', '04'].includes(digits.slice(0, 2)) || digits[0] === '2';
    case 12:
      return digits[0] === '2' || digits[0] === '4';
    case 8:
      return digits[0] === '0' || digits[0] === '2';
    default:
      return false;
  }
}

// What's wrong with a barcode someone typed, or null when it will be accepted as a barcode.
export function barcodeProblem(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^[0-9 ]+$/.test(trimmed)) return 'A barcode is digits only.';
  if (!LENGTHS.has(digitsOf(trimmed).length)) return 'A barcode has 8, 12, 13 or 14 digits.';
  if (!gtin14(trimmed)) return "The last digit doesn't check out. Scan it again or check for a typo.";
  if (isRestrictedGtin(trimmed)) {
    return "This is a shop's own code (it starts with 2), so it is kept as a reference, not a barcode.";
  }
  return null;
}
