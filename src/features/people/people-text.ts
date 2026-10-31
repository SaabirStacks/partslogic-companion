import { when } from '@/lib/format';
import { personLabel, roleName, type Person } from '@/vendor/partslogic/shared/people';

// How the People screens word a person. Pure, so it is tested without a phone.

export type PeopleSection = { title: string; people: Person[] };

// Accounts waiting for a role come first (they can't do anything until someone chooses one), then everyone
// with access. The server already sorts each group.
export function peopleSections(people: Person[]): PeopleSection[] {
  const waiting = people.filter((person) => person.role === null);
  const members = people.filter((person) => person.role !== null);
  return [
    waiting.length > 0 ? { title: `Needs a role · ${waiting.length}`, people: waiting } : null,
    members.length > 0 ? { title: `People · ${members.length}`, people: members } : null,
  ].filter((section): section is PeopleSection => section !== null);
}

// The line under a person's name: their role (or that they have none), and when they last signed in.
export function personDetail(person: Person, now = new Date()): string {
  const role = person.role ? roleName(person.role) : 'No role yet';
  if (person.needsPassword) return `${role} · set-up code not used yet`;
  if (!person.lastSignedInAt) return `${role} · never signed in`;
  return `${role} · signed in ${when(person.lastSignedInAt, now)}`;
}

// What the admin hands over with a set-up code, for the share sheet.
export function setupMessage(person: { name: string | null; email: string }, code: string): string {
  return [
    `PartsLogic sign-in for ${personLabel(person)}`,
    `Email: ${person.email}`,
    `Set-up code: ${code}`,
    'Open the PartsLogic app, sign in with this email and the set-up code as the password, then choose your own password.',
  ].join('\n');
}

// The person's first name, for short labels ("Add Rahman"), or null when they have no name yet.
export function firstName(name: string): string | null {
  return name.trim().split(/\s+/)[0] || null;
}
