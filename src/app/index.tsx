import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { BoardView } from '@/features/board/board-view';
import { resumeText } from '@/features/board/open-work';
import { syncState } from '@/features/board/sync-state';
import { useOpenWork } from '@/features/board/use-open-work';
import { useOnline } from '@/lib/network';
import { recentPartsPref } from '@/lib/prefs';
import { useAppUpdate } from '@/lib/use-app-update';
import { supabase } from '@/lib/supabase';
import { useRemote } from '@/lib/use-remote';
import { useOutbox } from '@/queue/outbox-provider';
import { useWorkingLocation } from '@/session/location-provider';
import { useSession } from '@/session/session-provider';
import { roleAtLeast } from '@/vendor/partslogic/shared/members';
import { PreviewStrip } from '@/features/developer/preview-strip';
import { unlocatedStockSummary } from '@/vendor/partslogic/shared/floor';
import { boardFor } from '@/workflows/catalogue';

// The job board, home for everyone signed in.
export default function Board() {
  const { state } = useSession();
  const { location } = useWorkingLocation();
  const { waiting, needsAttention } = useOutbox();
  const online = useOnline();
  const openWork = useOpenWork();
  const role = state.status === 'member' ? state.member.role : 'viewer';
  const update = useAppUpdate();
  // What's waiting to be put away here, for Put away's tile; read again each time the board comes back.
  // Read the id here, not inside the loader (the React Compiler reads what a callback uses while rendering).
  const locationId = location?.id ?? null;
  const unbinned = useRemote(online && locationId !== null && roleAtLeast(role, 'counter') ? `unbinned:${locationId}` : null, () =>
    unlocatedStockSummary(supabase, locationId),
  );
  const { reload } = unbinned;
  // A viewer's board lists the parts looked up lately (Look up keeps them); read again on each return.
  const [recent, setRecent] = useState(() => recentPartsPref.get() ?? []);
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      setRecent(recentPartsPref.get() ?? []);
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      reload();
    }, [reload]),
  );

  return (
    <BoardView
      sections={boardFor(role)}
      notice={<PreviewStrip />}
      openWork={openWork}
      unbinned={unbinned.data?.qty ?? null}
      update={update}
      location={location?.name ?? null}
      sync={syncState({ waiting, needsAttention, online })}
      onJob={(workflow) => router.push(workflow.href)}
      onResume={(work) => router.push(resumeText(work).href)}
      onLocation={() => router.push('/location')}
      onSync={() => router.push('/sync')}
      onAccount={() => router.push('/account')}
      recent={recent.slice(0, 6)}
      onPart={(part) => router.push({ pathname: '/part/[id]', params: { id: String(part.partId) } })}
      onRefresh={online ? reload : undefined}
      refreshing={unbinned.loading && !!unbinned.data}
    />
  );
}
