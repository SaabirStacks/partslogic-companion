import { fromCache, signInProblem, stateAfterLookup } from '../session-state';

const member = { userId: 'u1', role: 'counter' as const, workspaceName: 'Eclipse Auto Parts', currency: 'GBP' };

describe('stateAfterLookup', () => {
  it('lets a member in', () => {
    expect(stateAfterLookup('a@b.co', { ok: true, member }, null)).toEqual({ status: 'member', email: 'a@b.co', member });
  });

  it('says so when the account is not a member, even if this phone remembered one', () => {
    expect(stateAfterLookup('a@b.co', { ok: true, member: null }, member)).toEqual({
      status: 'not-member',
      email: 'a@b.co',
    });
  });

  it('keeps working offline with the member this phone last loaded', () => {
    expect(stateAfterLookup('a@b.co', { ok: false }, member)).toEqual({ status: 'member', email: 'a@b.co', member });
  });

  it('reports PartsLogic unreachable when offline with nothing saved', () => {
    expect(stateAfterLookup('a@b.co', { ok: false }, null)).toEqual({ status: 'unavailable', email: 'a@b.co' });
  });
});

describe('fromCache', () => {
  const cached = { userId: 'u1', role: 'counter', workspaceName: 'Eclipse Auto Parts', currency: 'GBP' };

  it('uses the saved member for the same user', () => {
    expect(fromCache(cached, 'u1')).toEqual(member);
  });

  it("ignores another user's saved member and unknown roles", () => {
    expect(fromCache(cached, 'u2')).toBeNull();
    expect(fromCache({ ...cached, role: 'superuser' }, 'u1')).toBeNull();
    expect(fromCache(null, 'u1')).toBeNull();
  });
});

describe('signInProblem', () => {
  it('words the common failures plainly', () => {
    expect(signInProblem({ code: 'invalid_credentials', message: 'Invalid login credentials' })).toBe(
      "That email and password don't match.",
    );
    expect(signInProblem({ name: 'AuthRetryableFetchError', message: 'Network request failed', status: 0 })).toMatch(
      /Can't reach PartsLogic/,
    );
    expect(signInProblem({ message: 'Something else' })).toBe('Something else');
  });
});
