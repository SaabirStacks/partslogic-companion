import { fromCache, passwordCheck, passwordProblem, signInProblem, stateAfterLookup, toCache } from '../session-state';

const member = {
  userId: 'u1',
  role: 'counter' as const,
  name: null,
  needsPassword: false,
  workspaceName: 'Eclipse Auto Parts',
  currency: 'GBP',
};

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

  it('asks someone on a set-up code to choose a password first, online or not', () => {
    const coded = { ...member, needsPassword: true };
    expect(stateAfterLookup('a@b.co', { ok: true, member: coded }, null).status).toBe('choose-password');
    expect(stateAfterLookup('a@b.co', { ok: false }, coded).status).toBe('choose-password');
  });
});

describe('fromCache', () => {
  const cached = { userId: 'u1', role: 'counter', workspaceName: 'Eclipse Auto Parts', currency: 'GBP' };

  it('uses the saved member for the same user, including one saved before names existed', () => {
    expect(fromCache(cached, 'u1')).toEqual(member);
    expect(fromCache(toCache({ ...member, name: 'Rahman', needsPassword: true }), 'u1')).toEqual({
      ...member,
      name: 'Rahman',
      needsPassword: true,
    });
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

describe('choosing a password', () => {
  it('checks the length and that both match', () => {
    expect(passwordCheck('short', '')).toBe('Use at least 8 characters.');
    expect(passwordCheck('long enough', 'long enougj')).toBe('The two passwords don’t match.');
    expect(passwordCheck('long enough', '')).toBeNull();
    expect(passwordCheck('long enough', 'long enough')).toBeNull();
  });

  it('words a refused password plainly', () => {
    expect(passwordProblem({ code: 'weak_password', message: 'weak' })).toMatch(/too easy to guess/);
    expect(passwordProblem({ code: 'same_password', message: 'same' })).toMatch(/different from your set-up code/);
    expect(passwordProblem({ name: 'AuthRetryableFetchError', message: 'x', status: 0 })).toMatch(/Can't reach PartsLogic/);
  });
});
