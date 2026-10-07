import { ScrollView } from 'react-native';

import { EmptyState } from '@/ui/empty-state';

export default function LookUp() {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerClassName="flex-grow">
      <EmptyState
        icon="barcode"
        title="Look up a part"
        body="Scan a barcode or type a part number to see its stock, price and where it sits. Scanning arrives in the next build."
      />
    </ScrollView>
  );
}
