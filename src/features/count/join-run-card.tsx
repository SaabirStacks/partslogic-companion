import { View } from 'react-native';

import { plural, when } from '@/lib/format';
import { Button } from '@/ui/button';
import { Card } from '@/ui/surface';
import { Txt } from '@/ui/text';
import type { SharedRun } from '@/vendor/partslogic/shared/floor';

import { runCountText } from './run-progress';

// A stock take or opening-stock run open in this location, which someone started: who, when and how far it
// has got, and Join to count it with them (one person per bin).
export function JoinRunCard({ run, busy = false, onJoin }: { run: SharedRun; busy?: boolean; onJoin: () => void }) {
  const counted = run.bins.filter((bin) => bin.state === 'counted').length;
  const counting = run.bins.filter((bin) => bin.state === 'counting' && bin.active).length;
  const noun = run.purpose === 'opening' ? 'opening stock' : 'stock take';
  const title = `${run.startedBy}’s ${noun}`;
  const detail = [
    `Started ${when(run.startedAt)}`,
    `${runCountText({ counted, total: run.bins.length })} counted`,
    counting > 0 ? `${plural(counting, 'bin', 'bins')} being counted now` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Card className="gap-3 p-4">
      <View className="gap-0.5" accessible accessibilityLabel={`${title}. ${detail}`}>
        <Txt variant="title" className="font-extrabold">
          {title}
        </Txt>
        <Txt variant="caption">{detail}</Txt>
      </View>
      <Button label={`Join ${run.startedBy}`} icon="stockTake" busy={busy} onPress={onJoin} />
    </Card>
  );
}
