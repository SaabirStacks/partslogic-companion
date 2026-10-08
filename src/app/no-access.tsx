import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/session/session-provider';
import { Button } from '@/ui/button';
import { Notice } from '@/ui/notice';

// Signed in, but the app can't be used yet: not a member, or PartsLogic can't be reached on first use.
export default function NoAccess() {
  const { state, checking, retry, signOut } = useSession();
  const notMember = state.status === 'not-member';
  const email = state.status === 'not-member' || state.status === 'unavailable' ? state.email : '';

  return (
    <SafeAreaView className="flex-1 bg-ground">
      <Notice
        icon={notMember ? 'account' : 'offline'}
        tone={notMember ? 'stop' : 'warning'}
        title={notMember ? 'No access yet' : 'No signal'}
        line={notMember ? `${email} isn't a PartsLogic member. An owner adds you in the back office.` : 'PartsLogic can’t be reached.'}>
        <Button label={notMember ? 'Check again' : 'Try again'} icon="retry" onPress={retry} busy={checking} />
        <Button label="Sign out" variant="secondary" onPress={signOut} disabled={checking} />
      </Notice>
    </SafeAreaView>
  );
}
