import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { RISE } from './motion';
import type { Tone } from './palette';
import { StatusChip, type ChipState } from './status-chip';
import { Card, TONE_TEXT } from './surface';
import { Txt } from './text';

export type ReceiptRow = { label: string; value: string | number; tone?: Tone };

// The end of every job, laid out the same way so a finished job always looks finished: where it stands (a
// chip that fills in as PartsLogic answers), the reference large (GR-0042, Bin A-01, 4 bins), when, then the
// numbers as rows. It rises into place once.
export function ReceiptCard({
  chip,
  reference,
  line,
  rows,
  accessibilityLabel,
}: {
  chip: ChipState;
  reference: string;
  line?: string | null;
  rows: ReceiptRow[];
  accessibilityLabel?: string;
}) {
  const spoken = accessibilityLabel ?? [chip.label, reference, line, ...rows.map((row) => `${row.label} ${row.value}`)].filter(Boolean).join('. ');
  return (
    <Animated.View entering={RISE}>
      <Card accessible accessibilityLabel={spoken} className="gap-4 p-5">
        <View className="items-center gap-2">
          <StatusChip {...chip} large />
          <Txt accessibilityRole="header" variant="display" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} className="text-center">
            {reference}
          </Txt>
          {line ? (
            <Txt variant="caption" numbers className="text-center">
              {line}
            </Txt>
          ) : null}
        </View>
        {rows.length > 0 ? (
          <View className="border-t border-rule pt-1">
            {rows.map((row) => (
              <View key={row.label} className="min-h-12 flex-row items-center justify-between gap-3">
                <Txt variant="body" className="flex-1">
                  {row.label}
                </Txt>
                <Txt variant="title" numbers ink={TONE_TEXT[row.tone ?? 'neutral']} className="font-extrabold">
                  {row.value}
                </Txt>
              </View>
            ))}
          </View>
        ) : null}
      </Card>
    </Animated.View>
  );
}
