import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/session/session-provider';
import { Button } from '@/ui/button';
import { EmptyState } from '@/ui/empty-state';

// Signed in, but the app can't be used yet: not a member, or PartsLogic can't be reached on first use.
export default function NoAccess() {
  const { state, checking, retry, signOut } = useSession();
  const notMember = state.status === 'not-member';
  const email = state.status === 'not-member' || state.status === 'unavailable' ? state.email : '';

  return (
    <SafeAreaView className="flex-1 bg-ground">
      <EmptyState
        icon={notMember ? 'account' : 'offline'}
        title={notMember ? 'Ask an owner to add you' : "Can't reach PartsLogic"}
        body={
          notMember
            ? `You're signed in as ${email}, but this account isn't a PartsLogic member yet. An owner can add you in the back office.`
            : 'Check your signal, then try again.'
        }>
        <Button label={notMember ? 'Check again' : 'Try again'} onPress={retry} busy={checking} />
        <Button label="Sign out" variant="secondary" onPress={signOut} disabled={checking} />
      </EmptyState>
    </SafeAreaView>
  );
}
