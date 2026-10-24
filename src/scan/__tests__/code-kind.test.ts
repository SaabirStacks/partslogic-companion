import { classifyRead } from '../code-kind';

describe('classifyRead', () => {
  it('takes a manufacturer barcode that passes its check digit', () => {
    expect(classifyRead({ type: 'ean13', data: '4006381333931' })).toEqual({ kind: 'gtin', code: '4006381333931' });
    expect(classifyRead({ type: 'upc_a', data: '036000291452' })).toEqual({ kind: 'gtin', code: '036000291452' });
    expect(classifyRead({ type: 'ean8', data: '96385074' })).toEqual({ kind: 'gtin', code: '96385074' });
    expect(classifyRead({ type: 'itf14', data: '10012345678902' })).toEqual({ kind: 'gtin', code: '10012345678902' });
    expect(classifyRead({ type: 'upc_e', data: '01234565' })).toEqual({ kind: 'gtin', code: '01234565' });
  });

  it('drops a misread barcode', () => {
    expect(classifyRead({ type: 'ean13', data: '4006381333932' })).toEqual({ kind: 'ignore' });
    expect(classifyRead({ type: 'itf14', data: '1234' })).toEqual({ kind: 'ignore' });
  });

  it('takes a supplier or maker code from Code 128 and Code 39', () => {
    expect(classifyRead({ type: 'code128', data: ' W 712/75 ' })).toEqual({ kind: 'code', code: 'W 712/75' });
    expect(classifyRead({ type: 'code39', data: '0986494123' })).toEqual({ kind: 'code', code: '0986494123' });
  });

  it('ignores links, control characters and codes too short or long to be a part code', () => {
    expect(classifyRead({ type: 'code128', data: 'https://example.com/p/1' })).toEqual({ kind: 'ignore' });
    expect(classifyRead({ type: 'code128', data: 'www.example.com' })).toEqual({ kind: 'ignore' });
    expect(classifyRead({ type: 'code128', data: 'AB' })).toEqual({ kind: 'ignore' });
    expect(classifyRead({ type: 'code128', data: 'X'.repeat(65) })).toEqual({ kind: 'ignore' });
    expect(classifyRead({ type: 'code128', data: '0105012345678900\u001d10ABC' })).toEqual({ kind: 'ignore' });
  });

  it('ignores QR and the other 2D codes', () => {
    for (const type of ['qr', 'datamatrix', 'pdf417', 'aztec']) {
      expect(classifyRead({ type, data: '4006381333931' })).toEqual({ kind: 'ignore' });
    }
  });
});
