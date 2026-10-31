import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@partslogic/db-types';

import { dataError } from './errors';

type Client = SupabaseClient<Database>;

export type AppRole = Database['public']['Enums']['app_role'];

// Lowest to highest. Each role can do everything the one before it can.
export const APP_ROLES: readonly AppRole[] = ['viewer', 'counter', 'editor', 'admin', 'owner', 'developer'];

export type CurrentMember = {
  userId: string;
  role: AppRole;
  // The name screens show for them; null shows their email.
  name: string | null;
  // True while they are signed in with a set-up code and still have to choose their own password.
  needsPassword: boolean;
  workspaceName: string;
  currency: string;
};

// True when `role` is at least `minimum` (viewer < counter < editor < admin < owner < developer).
export function roleAtLeast(role: AppRole, minimum: AppRole): boolean {
  return APP_ROLES.indexOf(role) >= APP_ROLES.indexOf(minimum);
}

// The signed-in person's role in this deployment, or null when they are not a member yet.
export async function getCurrentMember(supabase: Client, userId: string): Promise<CurrentMember | null> {
  const [member, workspace] = await Promise.all([
    supabase.from('members').select('user_id, role, display_name, needs_password').eq('user_id', userId).maybeSingle(),
    supabase.from('workspace').select('name, currency').maybeSingle(),
  ]);
  if (member.error) throw dataError(member.error);
  if (workspace.error) throw dataError(workspace.error);
  if (!member.data) return null;

  return {
    userId: member.data.user_id,
    role: member.data.role,
    name: member.data.display_name,
    needsPassword: member.data.needs_password,
    workspaceName: workspace.data?.name ?? 'PartsLogic',
    currency: workspace.data?.currency ?? 'GBP',
  };
}

export type MemberLabel = { userId: string; email: string; role: AppRole; name: string | null };

// Everyone in this deployment by user id, so screens can say who moved stock or stated a fact.
export async function listMemberLabels(supabase: Client): Promise<MemberLabel[]> {
  const { data, error } = await supabase.rpc('member_labels');
  if (error) throw dataError(error);
  return (data ?? []).flatMap((row) =>
    row.user_id && row.email && row.role
      ? [{ userId: row.user_id, email: row.email, role: row.role, name: row.name || null }]
      : [],
  );
}
