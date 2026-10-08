import { checkPublicConfig } from '../config';

describe('checkPublicConfig', () => {
  it('accepts both settings, trimmed', () => {
    expect(checkPublicConfig({ url: ' https://abc.supabase.co ', publishableKey: 'sb_publishable_x\n' })).toEqual({
      ok: true,
      url: 'https://abc.supabase.co',
      publishableKey: 'sb_publishable_x',
    });
  });

  it('names every missing or blank setting', () => {
    expect(checkPublicConfig({ url: '  ' })).toEqual({
      ok: false,
      problems: ['EXPO_PUBLIC_SUPABASE_URL is not set', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set'],
    });
  });

  it('refuses a URL that is not a web address', () => {
    expect(checkPublicConfig({ url: 'abc.supabase.co', publishableKey: 'sb_publishable_x' })).toEqual({
      ok: false,
      problems: ['EXPO_PUBLIC_SUPABASE_URL must start with https://'],
    });
  });
});
