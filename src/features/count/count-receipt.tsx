import { ReceiptCard } from '@/ui/receipt';

import type { countSummary } from './result-text';

// What a finished count did, as a receipt like every job's: where it stands (a chip that fills in as
// PartsLogic answers), the bin, and the numbers.
export function CountReceipt({ binCode, summary, units }: { binCode: string; summary: ReturnType<typeof countSummary>; units: number }) {
  const rows = summary.items.length > 0 ? summary.items : [{ value: units, label: 'Counted' }];
  return (
    <ReceiptCard
      chip={{ tone: summary.tone, icon: summary.icon, label: summary.label }}
      reference={`Bin ${binCode}`}
      rows={rows.map((item) => ({ label: item.label, value: item.value, tone: item.tone }))}
    />
  );
}
