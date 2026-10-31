import { router } from 'expo-router';
import { getNetworkStateAsync } from 'expo-network';
import { Share } from 'react-native';

import { appFacts, connectionFacts, connectionText, diagnosticsText } from '@/features/developer/app-facts';
import { DeveloperView } from '@/features/developer/developer-view';
import { askPartsLogic } from '@/lib/parts-logic-health';
import { useRemote } from '@/lib/use-remote';
import { useOutbox } from '@/queue/outbox-provider';
import { useSession } from '@/session/session-provider';
import { Notice } from '@/ui/notice';
import type { AppRole } from '@/vendor/partslogic/shared/members';

// For developers: what this copy of the app is, whether it reaches PartsLogic, the state of its outbox, and
// a preview of the app as another role sees it. Share sends it all as text, for a bug report.
export default function Developer() {
  const { state, realRole, previewRole, setPreviewRole } = useSession();
  const outbox = useOutbox();
  const connection = useRemote('connection', async () => {
    const [network, answer] = await Promise.all([getNetworkStateAsync().catch(() => null), askPartsLogic()]);
    return connectionFacts(network, answer);
  });

  if (realRole !== 'developer' || state.status !== 'member') {
    return <Notice icon="developer" title="For developers" line="These tools are for whoever looks after the app." />;
  }

  const app = appFacts();
  const checked = connection.loading ? null : (connection.data ?? null);
  const line = checked ? connectionText(checked) : 'Not checked';
  const facts = { waiting: outbox.waiting, needsAttention: outbox.needsAttention, lastSentAt: outbox.lastSentAt, lastProblem: outbox.lastProblem };
  const account = { email: state.email, userId: state.member.userId };

  return (
    <DeveloperView
      app={app}
      connection={checked}
      checking={connection.loading}
      outbox={facts}
      account={account}
      previewRole={previewRole}
      onCheck={connection.reload}
      onOpenSync={() => router.push('/sync')}
      onPreview={(role: AppRole | null) => {
        setPreviewRole(role);
        // Back to the board, to see it as that role.
        if (role) router.dismissTo('/');
      }}
      onShare={() =>
        void Share.share({ message: diagnosticsText({ app, account: { ...account, role: realRole }, connection: line, sync: facts }) })
      }
    />
  );
}
