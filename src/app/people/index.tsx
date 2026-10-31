import { router } from 'expo-router';

import { PeopleList } from '@/features/people/people-list';
import { messageOf, usePeople } from '@/features/people/use-people';
import { useSession } from '@/session/session-provider';
import { Notice } from '@/ui/notice';
import { roleAtLeast } from '@/vendor/partslogic/shared/members';

// Everyone with an account: those waiting for a role first (people made in Supabase, or who signed up), then
// everyone who can work. Admins and above see it; a person's page changes them.
export default function People() {
  const { state } = useSession();
  const role = state.status === 'member' ? state.member.role : 'viewer';
  const { data, error, loading, reload, online } = usePeople();

  if (!roleAtLeast(role, 'admin')) {
    return <Notice icon="people" title="For admins" line="Admins and owners add people and choose what they can do." />;
  }
  return (
    <PeopleList
      people={data}
      loading={loading}
      problem={error ? messageOf(error) : null}
      online={online}
      onAdd={() => router.push('/people/add')}
      onOpen={(person) => router.push({ pathname: '/people/[id]', params: { id: person.userId } })}
      onRefresh={reload}
    />
  );
}
