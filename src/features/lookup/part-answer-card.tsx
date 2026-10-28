import { View } from 'react-native';

import { BinChip } from '@/ui/bin-chip';
import { ScanResultCard } from '@/ui/scan-result-card';
import { Txt } from '@/ui/text';

import type { PartAnswer } from './answer';

// A scanned part on the result card: the stock chip's colour and word, on hand in big numbers, the
// bins holding it, and the sell price. Tapping it opens the whole part.
export function PartAnswerCard({
  title,
  answer,
  savedAt,
  onOpen,
}: {
  title: string;
  answer: PartAnswer;
  savedAt: string | null;
  onOpen: () => void;
}) {
  return (
    <ScanResultCard
      tone={answer.tone}
      status={savedAt ? { icon: 'offline', label: `${answer.status.label} · saved copy` } : answer.status}
      title={title}
      detail={answer.name}
      quantity={answer.onHand !== null ? { value: answer.onHand, label: 'On hand' } : undefined}
      onPress={onOpen}>
      {answer.bins.length > 0 || answer.price ? (
        <View className="flex-row flex-wrap items-center gap-2">
          {answer.bins.map((bin) => (
            <BinChip key={bin.binId} code={bin.place} qty={bin.qty} />
          ))}
          {answer.moreBins > 0 ? (
            <Txt variant="label" numbers ink="text-quiet-ink">
              {`+${answer.moreBins}`}
            </Txt>
          ) : null}
          {answer.price ? (
            <Txt variant="title" numbers className="ml-auto font-extrabold">
              {answer.price}
            </Txt>
          ) : null}
        </View>
      ) : null}
    </ScanResultCard>
  );
}
