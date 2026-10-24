import { gtin14 } from '@/vendor/partslogic/shared/gtin';

// The barcodes on a box: a manufacturer's EAN or UPC, an ITF-14 on an outer carton, and the Code 128 or
// Code 39 a supplier (or a maker) prints with its own code. QR, DataMatrix, PDF417 and Aztec are left off:
// on parts packaging they carry links and "check it's genuine" codes, never the part.
export const PRODUCT_SYMBOLOGIES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'itf14', 'code128', 'code39'] as const;

const GTIN_SYMBOLOGIES = new Set(['ean13', 'ean8', 'upc_a', 'itf14']);
const CODE_SYMBOLOGIES = new Set(['code128', 'code39']);

// The same limits quick_add_part puts on a code that isn't a barcode.
const CODE_MIN = 3;
const CODE_MAX = 64;

export type CodeRead = { kind: 'gtin' | 'code'; code: string } | { kind: 'ignore' };

// What the camera read, and whether it's worth anything: a GTIN that passes its check digit, a supplier or
// maker code of printable characters, or nothing (a link, a misread, a symbology the app doesn't use).
// Misreads are dropped quietly: the camera reads again a moment later.
export function classifyRead(read: { type: string; data: string }): CodeRead {
  const code = read.data.trim();
  const type = read.type.toLowerCase();
  if (GTIN_SYMBOLOGIES.has(type)) {
    return /^[0-9]+$/.test(code) && gtin14(code) ? { kind: 'gtin', code } : { kind: 'ignore' };
  }
  // UPC-E's check digit belongs to its expanded UPC-A form, so only its shape is checked here.
  if (type === 'upc_e') return /^[0-9]{6,8}$/.test(code) ? { kind: 'gtin', code } : { kind: 'ignore' };
  if (CODE_SYMBOLOGIES.has(type)) {
    const printable = /^[\x20-\x7e]+$/.test(code);
    const link = /:\/\/|^www\./i.test(code);
    return printable && !link && code.length >= CODE_MIN && code.length <= CODE_MAX ? { kind: 'code', code } : { kind: 'ignore' };
  }
  return { kind: 'ignore' };
}
