import { FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@partslogic/db-types';

import { DataError, dataError } from './errors';
import { APP_ROLES, roleAtLeast, type AppRole } from './members';

type Client = SupabaseClient<Database>;

// Managing people. Admins and above give roles, names and access; they never change themselves, never
// someone above their own role, and never give a role above their own (public.people_rule_problem holds
// those rules). Adding a person, a new set-up code and a new sign-in email need the service key, so they go
// through the people Edge Function, which checks the same rules first.

// What each role adds, in the words both apps show.
export const ROLE_HINTS: Record<AppRole, string> = {
  viewer: 'Looks things up',
  counter: 'Counts and moves stock',
  editor: 'Books stock, prices parts, runs enrichment',
  admin: 'Sets margins, reviews catalogue links, manages people',
  owner: 'Everything, including company settings',
  developer: 'Everything, plus developer tools. Owners can’t change a developer',
};

export function roleName(role: AppRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

// "an admin", "a counter".
export function aRole(role: AppRole): string {
  return `${role === 'admin' || role === 'owner' ? 'an' : 'a'} ${role}`;
}

// The roles a person with this role may give: up to their own, for admins and above.
export function rolesYouCanGive(myRole: AppRole): AppRole[] {
  return roleAtLeast(myRole, 'admin') ? APP_ROLES.filter((role) => roleAtLeast(myRole, role)) : [];
}

// Whether a person with this role may change someone with that role (or none yet). The server decides;
// this is for showing or hiding the controls.
export function canChangePerson(myRole: AppRole, theirRole: AppRole | null, isMe: boolean): boolean {
  return !isMe && roleAtLeast(myRole, 'admin') && (theirRole === null || roleAtLeast(myRole, theirRole));
}

export type Person = {
  userId: string;
  email: string;
  name: string | null;
  // null while the account waits for a role: they see "No access yet".
  role: AppRole | null;
  // Signed in with a set-up code and not yet chosen their own password (or not signed in yet).
  needsPassword: boolean;
  signedUpAt: string;
  lastSignedInAt: string | null;
  isMe: boolean;
  // Whether the signed-in person may change them (the server's rules).
  canChange: boolean;
};

// The name to show for a person: their name, or their email until they have one.
export function personLabel(person: { name: string | null; email: string }): string {
  return person.name ?? person.email;
}

// Everyone with an account, for admins and above: accounts waiting for a role first, then by role.
export async function listPeople(supabase: Client): Promise<Person[]> {
  const { data, error } = await supabase.rpc('people');
  if (error) throw dataError(error);
  return (data ?? []).map((row) => ({
    userId: row.user_id,
    email: row.email,
    name: row.name || null,
    role: row.role ?? null,
    needsPassword: row.needs_password,
    signedUpAt: row.signed_up_at,
    lastSignedInAt: row.last_signed_in_at ?? null,
    isMe: row.is_me,
    canChange: row.can_change,
  }));
}

// Gives someone a role: an account waiting for one, or a person who has one already.
export async function setPersonRole(supabase: Client, userId: string, role: AppRole): Promise<void> {
  const { error } = await supabase.rpc('set_person_role', { p_user_id: userId, p_role: role });
  if (error) throw dataError(error);
}

// Sets the name screens show. Anyone can set their own; an empty name goes back to their email.
export async function setPersonName(supabase: Client, userId: string, name: string): Promise<void> {
  const { error } = await supabase.rpc('set_person_name', { p_user_id: userId, p_name: name });
  if (error) throw dataError(error);
}

// Takes their role away. The account stays, waiting for a role again.
export async function removePersonAccess(supabase: Client, userId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_person_access', { p_user_id: userId });
  if (error) throw dataError(error);
}

// The signed-in person has chosen their own password: their set-up code is finished with.
export async function finishSetup(supabase: Client): Promise<void> {
  const { error } = await supabase.rpc('finish_setup');
  if (error) throw dataError(error);
}

// A one-time code a person signs in with first, like "K7MQ-4XPA-2RHT". Shown once; never stored.
export type SetupCode = { userId: string; code: string };

// Makes an account for a new person, with their role and name, and a set-up code to hand them.
export async function addPerson(
  supabase: Client,
  person: { email: string; name: string; role: AppRole },
): Promise<SetupCode> {
  return setupCodeFrom(await callPeople(supabase, { action: 'add', ...person }));
}

// A fresh set-up code for someone who has forgotten their password. Their old password stops working.
export async function newSetupCode(supabase: Client, userId: string): Promise<SetupCode> {
  return setupCodeFrom(await callPeople(supabase, { action: 'new_code', userId }));
}

// Changes the email a person signs in with. Admins can change their own too.
export async function changePersonEmail(supabase: Client, userId: string, email: string): Promise<void> {
  await callPeople(supabase, { action: 'change_email', userId, email });
}

// Set-up codes are typed in capitals; accept them however they were typed.
export function tidySetupCode(typed: string): string {
  const letters = typed.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return letters.length === 12 ? `${letters.slice(0, 4)}-${letters.slice(4, 8)}-${letters.slice(8)}` : typed.trim();
}

type PeopleReply = { userId?: string; code?: string; error?: string };

// The function's HTTP status as the database code callers already understand.
const STATUS_CODES: Record<number, string> = { 400: '22023', 401: 'PGRST301', 403: '42501', 409: '23505' };

async function callPeople(supabase: Client, body: Record<string, unknown>): Promise<PeopleReply> {
  const { data, error } = await supabase.functions.invoke<PeopleReply>('people', { body });
  if (!error) return data ?? {};
  // A reply from the function carries its own message (error.context is the response); anything else
  // never reached it.
  if (error instanceof FunctionsHttpError) {
    const response = error.context as { status: number; json: () => Promise<unknown> };
    const reply = (await response.json().catch(() => null)) as PeopleReply | null;
    throw new DataError(reply?.error ?? 'PartsLogic couldn’t do that. Try again.', STATUS_CODES[response.status] ?? null);
  }
  throw new DataError('Can’t reach PartsLogic. Check your signal and try again.', '08001');
}

function setupCodeFrom(reply: PeopleReply): SetupCode {
  if (!reply.userId || !reply.code) throw new DataError('PartsLogic didn’t send a set-up code back. Try again.');
  return { userId: reply.userId, code: reply.code };
}
