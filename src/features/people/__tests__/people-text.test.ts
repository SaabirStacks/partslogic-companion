import type { Person } from '@/vendor/partslogic/shared/people';

import { firstName, peopleSections, personDetail, setupMessage } from '../people-text';

const NOW = new Date('2026-10-31T12:00:00');

function person(overrides: Partial<Person>): Person {
  return {
    userId: 'u',
    email: 'rahman@example.com',
    name: null,
    role: 'counter',
    needsPassword: false,
    signedUpAt: '2026-10-29T13:47:00',
    lastSignedInAt: null,
    isMe: false,
    canChange: true,
    ...overrides,
  };
}

describe('peopleSections', () => {
  it('puts accounts waiting for a role first, and counts each group', () => {
    const sections = peopleSections([
      person({ userId: 'a', role: null }),
      person({ userId: 'b', role: 'owner' }),
      person({ userId: 'c', role: 'counter' }),
    ]);
    expect(sections.map((section) => [section.title, section.people.map((p) => p.userId)])).toEqual([
      ['Needs a role · 1', ['a']],
      ['People · 2', ['b', 'c']],
    ]);
  });

  it('leaves out an empty group', () => {
    expect(peopleSections([person({})]).map((section) => section.title)).toEqual(['People · 1']);
    expect(peopleSections([])).toEqual([]);
  });
});

describe('personDetail', () => {
  it('says the role and when they last signed in', () => {
    expect(personDetail(person({ lastSignedInAt: '2026-10-30T09:05:00' }), NOW)).toBe('Counter · signed in Yesterday 09:05');
    expect(personDetail(person({ role: null }), NOW)).toBe('No role yet · never signed in');
    expect(personDetail(person({ needsPassword: true }), NOW)).toBe('Counter · set-up code not used yet');
  });
});

describe('setupMessage', () => {
  it('has everything they need to sign in', () => {
    const message = setupMessage({ name: 'Rahman Ali', email: 'rahman@example.com' }, 'K7MQ-4XPA-2RHT');
    expect(message).toContain('PartsLogic sign-in for Rahman Ali');
    expect(message).toContain('Email: rahman@example.com');
    expect(message).toContain('Set-up code: K7MQ-4XPA-2RHT');
  });
});

describe('firstName', () => {
  it('takes the first word', () => {
    expect(firstName('  Rahman Ali ')).toBe('Rahman');
    expect(firstName('   ')).toBeNull();
  });
});
