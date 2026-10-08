import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { AddForm, ScanCode } from '@/features/quick-add/add-part-screens';

// Add part: a barcode PartsLogic doesn't know becomes a new part, so it scans next time and the scans
// waiting on it are booked. From an unknown scan the code is filled in; from the board, scan it first.
export default function QuickAdd() {
  const { code: param } = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState((param ?? '').trim());
  return code ? <AddForm code={code} /> : <ScanCode onCode={setCode} />;
}

