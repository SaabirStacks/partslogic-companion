import { View } from 'react-native';

import { BinChip } from '@/ui/bin-chip';
import { TEXT_ON } from '@/ui/plate';
import { ScanResultCard } from '@/ui/scan-result-card';
import { SignText } from '@/ui/sign-text';

import type { PartAnswer } from './answer';

// A scanned part on the result plate: the stock sign's colour and word, on hand in big numbers, the
// bins holding it, and the sell price. Tapping it opens the whole part.
export function PartAnswerPlate({
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
            <SignText size="label" ink={TEXT_ON[answer.tone]}>
              {`+${answer.moreBins}`}
            </SignText>
          ) : null}
          {answer.price ? (
            <SignText size="title" weight="heavy" className="ml-auto" ink={TEXT_ON[answer.tone]}>
              {answer.price}
            </SignText>
          ) : null}
        </View>
      ) : null}
    </ScanResultCard>
  );
}
