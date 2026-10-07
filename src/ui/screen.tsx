import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';

import { OfflineBanner } from './offline-banner';

// The scrolling body of every tab: native large-title behaviour, taps that work with the keyboard up,
// and the offline line at the top.
export function Screen({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerClassName="flex-grow">
      <OfflineBanner />
      {children}
    </ScrollView>
  );
}
