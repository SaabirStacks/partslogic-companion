import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@partslogic/db-types';

import { dataError } from './errors';

type Client = SupabaseClient<Database>;

export type AppRole = Database['public']['Enums']['app_role'];

export const APP_ROLES: readonly AppRole[] = ['viewer', 'counter', 'editor', 'admin', 'owner'];

export type CurrentMember = {
  userId: string;
  role: AppRole;
  workspaceName: string;
  currency: string;
};

// True when `role` is at least `minimum` (viewer < counter < editor < admin < owner).
export function roleAtLeast(role: AppRole, minimum: AppRole): boolean {
  return APP_ROLES.indexOf(role) >= APP_ROLES.indexOf(minimum);
}

// The signed-in person's role in this deployment, or null when they are not a member yet.
export async function getCurrentMember(supabase: Client, userId: string): Promise<CurrentMember | null> {
  const [member, workspace] = await Promise.all([
    supabase.from('members').select('user_id, role').eq('user_id', userId).maybeSingle(),
    supabase.from('workspace').select('name, currency').maybeSingle(),
  ]);
  if (member.error) throw dataError(member.error);
  if (workspace.error) throw dataError(workspace.error);
  if (!member.data) return null;

  return {
    userId: member.data.user_id,
    role: member.data.role,
    workspaceName: workspace.data?.name ?? 'PartsLogic',
    currency: workspace.data?.currency ?? 'GBP',
  };
}

export type MemberLabel = { userId: string; email: string; role: AppRole };

// Everyone in this deployment by user id, so screens can say who moved stock or stated a fact.
export async function listMemberLabels(supabase: Client): Promise<MemberLabel[]> {
  const { data, error } = await supabase.rpc('member_labels');
  if (error) throw dataError(error);
  return (data ?? []).flatMap((row) =>
    row.user_id && row.email && row.role ? [{ userId: row.user_id, email: row.email, role: row.role }] : [],
  );
}
