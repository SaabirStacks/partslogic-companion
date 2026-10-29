import { useState } from 'react';

import { binViewPref, type BinView } from '@/lib/prefs';

export const BIN_VIEWS: readonly { value: BinView; label: string }[] = [
  { value: 'tabs', label: 'Tab view' },
  { value: 'list', label: 'List view' },
];

// How someone is browsing a location's bins: Tab view or List view (the phone remembers which they used
// last), and in Tab view the parts of the name chosen so far.
export function useBinBrowse() {
  const [view, setViewState] = useState<BinView>(() => binViewPref.get() ?? 'tabs');
  const [path, setPath] = useState<string[]>([]);

  const setView = (next: BinView) => {
    setViewState(next);
    try {
      binViewPref.set(next);
    } catch {
      // Only a convenience: the view still changes for now.
    }
  };

  // Part-way into Tab view, so there's a step to go back to.
  const inStep = view === 'tabs' && path.length > 0;

  return {
    view,
    setView,
    path,
    setPath,
    inStep,
    back: () => setPath((current) => current.slice(0, -1)),
    reset: () => setPath([]),
  };
}
