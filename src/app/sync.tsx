import { ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { syncState } from '@/features/board/sync-state';
import { clock } from '@/lib/format';
import { useOnline } from '@/lib/network';
import { useOutbox } from '@/queue/outbox-provider';
import { useScanIndex } from '@/scan/scan-index-provider';
import { Button } from '@/ui/button';
import { Fact, Facts } from '@/ui/facts';
import { Icon } from '@/ui/icon';
import { APPEAR, SETTLE } from '@/ui/motion';
import { ON_TONE, Plate, TEXT_ON } from '@/ui/plate';
import { SectionLabel } from '@/ui/section-label';
import { Detail, SignText } from '@/ui/sign-text';
import { StatusStrip } from '@/ui/status-strip';

const number = (value: number) => new Intl.NumberFormat('en-GB').format(value);

// Sync: whether this phone's work has reached PartsLogic. The sign on top says it in two words; problems
// come first, each with Try again, then what's waiting, then what was sent. Nothing to read when all is sent.
export default function Sync() {
  const outbox = useOutbox();
  const scanIndex = useScanIndex();
  const online = useOnline();
  const state = syncState({ waiting: outbox.waiting, needsAttention: outbox.needsAttention, online });

  const attention = outbox.items.filter((item) => item.status === 'attention');
  const waiting = outbox.items.filter((item) => item.status === 'pending' || item.status === 'sending');
  const sent = outbox.items.filter((item) => item.status === 'done');

  return (
    <ScrollView className="bg-ground" contentContainerClassName="gap-3 px-3 pb-10 pt-3">
      <Animated.View key={state.label} entering={APPEAR}>
        <Plate tone={state.tone} heavy accessible accessibilityRole="header" className="gap-1 p-4">
          <View className="flex-row items-center gap-2">
            <Icon name={state.icon} size={32} colour={ON_TONE[state.tone]} />
            <SignText size="display" weight="heavy" ink={TEXT_ON[state.tone]}>
              {state.label}
            </SignText>
          </View>
          {outbox.lastSentAt ? (
            <SignText size="tag" ink={TEXT_ON[state.tone]}>
              {`Last sent ${clock(outbox.lastSentAt)}`}
            </SignText>
          ) : null}
        </Plate>
      </Animated.View>

      {outbox.waiting > 0 && online ? (
        <Button label="Send now" icon="sync" variant="secondary" onPress={outbox.sendNow} />
      ) : null}
      {outbox.lastProblem && outbox.waiting > 0 ? (
        <StatusStrip tone="warning" icon="retry" text={`Last try didn’t get through · ${outbox.lastProblem}`} />
      ) : null}

      {attention.length > 0 ? <SectionLabel>Problems</SectionLabel> : null}
      {attention.map((item) => (
        <Animated.View key={item.clientId} entering={APPEAR} layout={SETTLE}>
          <Plate tone="stop" className="gap-2 p-3">
            <SignText size="label" weight="heavy" ink={TEXT_ON.stop}>
              {item.label}
            </SignText>
            {item.lastError ? <Detail ink={TEXT_ON.stop}>{item.lastError}</Detail> : null}
            <Button label="Try again" icon="retry" variant="secondary" compact onPress={() => void outbox.retry(item.clientId)} />
          </Plate>
        </Animated.View>
      ))}

      {waiting.length > 0 ? <SectionLabel>{`Waiting · ${waiting.length}`}</SectionLabel> : null}
      {waiting.slice(0, 50).map((item) => (
        <Animated.View key={item.clientId} entering={APPEAR} layout={SETTLE}>
          <Plate className="min-h-14 flex-row items-center gap-3 px-3 py-2">
            <Icon name="waiting" size={18} colour="warning-ink" />
            <SignText size="label" numberOfLines={2} caps={false} className="flex-1">
              {item.label}
            </SignText>
          </Plate>
        </Animated.View>
      ))}

      {sent.length > 0 ? <SectionLabel>Sent</SectionLabel> : null}
      {sent.slice(0, 10).map((item) => (
        <Animated.View key={item.clientId} entering={APPEAR} layout={SETTLE}>
          <Plate className="min-h-14 flex-row items-center gap-3 px-3 py-2">
            <Icon name="sent" size={18} colour="safe-ink" />
            <SignText size="label" numberOfLines={2} caps={false} className="flex-1">
              {item.label}
            </SignText>
            <Detail>{clock(item.updatedAt)}</Detail>
          </Plate>
        </Animated.View>
      ))}

      <SectionLabel>Scan list on this phone</SectionLabel>
      {scanIndex.failed ? <StatusStrip tone="warning" icon="warning" text="Last update didn’t finish · tries again with signal" /> : null}
      <Facts>
        <Fact
          label="Codes"
          value={
            scanIndex.progress !== null
              ? `Updating · ${number(scanIndex.progress)}`
              : scanIndex.saved
                ? number(scanIndex.saved.codes)
                : 'Not downloaded'
          }
          last={!scanIndex.saved}
        />
        {scanIndex.saved ? <Fact label="Updated" value={clock(scanIndex.saved.syncedAt)} last /> : null}
      </Facts>
      {online && scanIndex.progress === null ? (
        <Button label="Update scan list" icon="retry" variant="secondary" onPress={scanIndex.update} />
      ) : null}
    </ScrollView>
  );
}
