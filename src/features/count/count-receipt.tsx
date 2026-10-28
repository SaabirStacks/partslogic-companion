import { View } from 'react-native';

import { StatusChip } from '@/ui/status-chip';
import { Card } from '@/ui/surface';
import { Tally } from '@/ui/tally';
import { Txt } from '@/ui/text';

import type { countSummary } from './result-text';

// What a finished count did, as a receipt: where it stands (a chip that fills in as PartsLogic answers),
// the bin, and the numbers.
export function CountReceipt({ binCode, summary, units }: { binCode: string; summary: ReturnType<typeof countSummary>; units: number }) {
  return (
    <View className="gap-3">
      <Card className="items-center gap-3 px-4 py-6">
        <StatusChip tone={summary.tone} icon={summary.icon} label={summary.label} large />
        <Txt accessibilityRole="header" variant="display" className="text-center">
          {`Bin ${binCode}`}
        </Txt>
      </Card>
      <Tally items={summary.items.length > 0 ? summary.items : [{ value: units, label: 'Counted' }]} />
    </View>
  );
}
