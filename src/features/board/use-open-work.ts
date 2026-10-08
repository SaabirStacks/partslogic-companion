import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { db } from '@/db/database';
import { useSession } from '@/session/session-provider';

import { readOpenWork, type OpenWork } from './open-work';

// Open work, read again each time the board comes back into view (a job may have just finished).
export function useOpenWork(): OpenWork[] {
  const { state } = useSession();
  const userId = state.status === 'member' ? state.member.userId : null;
  const [work, setWork] = useState<OpenWork[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let current = true;
      void readOpenWork(db(), userId).then((next) => {
        if (current) setWork(next);
      });
      return () => {
        current = false;
      };
    }, [userId]),
  );

  return work;
}
