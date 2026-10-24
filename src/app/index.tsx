import { router } from 'expo-router';

import { BoardView } from '@/features/board/board-view';
import { resumeText } from '@/features/board/open-work';
import { syncState } from '@/features/board/sync-state';
import { useOpenWork } from '@/features/board/use-open-work';
import { useOnline } from '@/lib/network';
import { useOutbox } from '@/queue/outbox-provider';
import { useWorkingLocation } from '@/session/location-provider';
import { useSession } from '@/session/session-provider';
import { boardFor } from '@/workflows/catalogue';

// The job board, home for everyone signed in.
export default function Board() {
  const { state } = useSession();
  const { location } = useWorkingLocation();
  const { waiting, needsAttention } = useOutbox();
  const online = useOnline();
  const openWork = useOpenWork();
  const role = state.status === 'member' ? state.member.role : 'viewer';

  return (
    <BoardView
      sections={boardFor(role)}
      openWork={openWork}
      location={location?.name ?? null}
      sync={syncState({ waiting, needsAttention, online })}
      onJob={(workflow) => router.push(workflow.href)}
      onResume={(work) => router.push(resumeText(work).href)}
      onLocation={() => router.push('/location')}
      onSync={() => router.push('/sync')}
      onAccount={() => router.push('/account')}
    />
  );
}
