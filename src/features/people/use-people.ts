import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

import { useOnline } from '@/lib/network';
import { supabase } from '@/lib/supabase';
import { useRemote } from '@/lib/use-remote';
import { listPeople } from '@/vendor/partslogic/shared/people';

// Everyone with an account, read from PartsLogic while online, and again each time the screen comes back
// (after a person's page changed something).
export function usePeople() {
  const online = useOnline();
  const people = useRemote(online ? 'people' : null, () => listPeople(supabase));
  const { reload } = people;
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      reload();
    }, [reload]),
  );
  return { ...people, online };
}

export const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));
