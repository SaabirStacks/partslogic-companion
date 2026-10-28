import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { db } from '@/db/database';
import { syncState } from '@/features/board/sync-state';
import { CountStore } from '@/features/count/count-store';
import { clock } from '@/lib/format';
import { useOnline } from '@/lib/network';
import { countOfStream, discardPlan } from '@/queue/discard';
import { useOutbox } from '@/queue/outbox-provider';
import type { OutboxItem } from '@/queue/types';
import { useScanIndex } from '@/scan/scan-index-provider';
import { Button } from '@/ui/button';
import { ConfirmSheet } from '@/ui/confirm-sheet';
import { Fact, Facts } from '@/ui/facts';
import { Icon } from '@/ui/icon';
import { APPEAR, SETTLE } from '@/ui/motion';
import { StatusChip } from '@/ui/status-chip';
import { Card } from '@/ui/surface';
import { SectionLabel } from '@/ui/section-label';
import { Txt } from '@/ui/text';
import { StatusStrip } from '@/ui/status-strip';

const number = (value: number) => new Intl.NumberFormat('en-GB').format(value);

// Sync: whether this phone's work has reached PartsLogic. The card on top says it in two words; problems
// come first, each with Try again or Discard (for work PartsLogic will never take, such as a count of a
// system bin), then what's waiting, then what was sent. Nothing to read when all is sent.
export default function Sync() {
  const outbox = useOutbox();
  const scanIndex = useScanIndex();
  const online = useOnline();
  const state = syncState({ waiting: outbox.waiting, needsAttention: outbox.needsAttention, online });

  const attention = outbox.items.filter((item) => item.status === 'attention');
  // The refused item being discarded, and what would go with it (discard.ts).
  const [discarding, setDiscarding] = useState<OutboxItem | null>(null);
  const plan = discarding ? discardPlan(outbox.items, discarding.clientId) : [];
  const behind = plan.length - 1;
  const isCount = discarding ? countOfStream(discarding.streamKey) !== null : false;

  // Throws the refused work away, and for a bin count also the count kept on this phone, so it stops
  // showing as open work.
  async function discardProblem(item: OutboxItem) {
    const removed = await outbox.discard(item.clientId);
    const stocktakeId = countOfStream(item.streamKey);
    if (removed.length > 0 && stocktakeId) await new CountStore(db()).discard(stocktakeId);
  }
  const waiting = outbox.items.filter((item) => item.status === 'pending' || item.status === 'sending');
  const sent = outbox.items.filter((item) => item.status === 'done');

  return (
    <ScrollView className="bg-ground" contentContainerClassName="gap-3 px-4 pb-10 pt-3">
      <Animated.View key={state.label} entering={APPEAR}>
        <Card accessible accessibilityRole="header" accessibilityLabel={state.label} className="gap-2 p-4">
          <StatusChip tone={state.tone} icon={state.icon} label={state.label} large />
          {outbox.lastSentAt ? <Txt variant="caption">{`Last sent ${clock(outbox.lastSentAt)}`}</Txt> : null}
        </Card>
      </Animated.View>

      {outbox.waiting > 0 && online ? (
        <Button label="Send now" icon="sync" variant="secondary" onPress={outbox.sendNow} />
      ) : null}
      {outbox.lastProblem && outbox.waiting > 0 ? (
        <StatusStrip tone="warn" icon="retry" text={`Last try didn’t get through · ${outbox.lastProblem}`} />
      ) : null}

      {attention.length > 0 ? <SectionLabel>Problems</SectionLabel> : null}
      {attention.map((item) => (
        <Animated.View key={item.clientId} entering={APPEAR} layout={SETTLE}>
          <Card className="gap-2 p-4">
            <StatusChip tone="stop" icon="stop" label="Not sent" />
            <Txt variant="label" className="font-bold">
              {item.label}
            </Txt>
            {item.lastError ? <Txt variant="caption" ink="text-stop-ink">{item.lastError}</Txt> : null}
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Button label="Try again" icon="retry" variant="secondary" compact onPress={() => void outbox.retry(item.clientId)} />
              </View>
              <View className="flex-1">
                <Button label="Discard" icon="close" variant="secondary" compact onPress={() => setDiscarding(item)} />
              </View>
            </View>
          </Card>
        </Animated.View>
      ))}

      {waiting.length > 0 ? <SectionLabel>{`Waiting · ${waiting.length}`}</SectionLabel> : null}
      {waiting.slice(0, 50).map((item) => (
        <Animated.View key={item.clientId} entering={APPEAR} layout={SETTLE}>
          <Card className="min-h-14 flex-row items-center gap-3 px-4 py-2">
            <Icon name="waiting" size={18} colour="warn-ink" />
            <Txt variant="label" numberOfLines={2} className="flex-1">
              {item.label}
            </Txt>
          </Card>
        </Animated.View>
      ))}

      {sent.length > 0 ? <SectionLabel>Sent</SectionLabel> : null}
      {sent.slice(0, 10).map((item) => (
        <Animated.View key={item.clientId} entering={APPEAR} layout={SETTLE}>
          <Card className="min-h-14 flex-row items-center gap-3 px-3 py-2">
            <Icon name="sent" size={18} colour="ok-ink" />
            <Txt variant="label" numberOfLines={2} className="flex-1">
              {item.label}
            </Txt>
            <Txt variant="caption">{clock(item.updatedAt)}</Txt>
          </Card>
        </Animated.View>
      ))}

      <SectionLabel>Scan list on this phone</SectionLabel>
      {scanIndex.failed ? <StatusStrip tone="warn" icon="warning" text="Last update didn’t finish · tries again with signal" /> : null}
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
      <ConfirmSheet
        visible={discarding !== null}
        title="Discard this?"
        facts={behind > 0 ? [{ value: 1, label: 'refused', tone: 'stop' }, { value: behind, label: 'waiting behind it' }] : undefined}
        note={isCount ? 'None of it reaches PartsLogic, and the count is forgotten here.' : 'None of it reaches PartsLogic.'}
        confirm={{
          label: 'Discard',
          destructive: true,
          onPress: () => {
            const item = discarding;
            setDiscarding(null);
            if (item) void discardProblem(item);
          },
        }}
        cancelLabel="Keep it"
        onCancel={() => setDiscarding(null)}
      />
    </ScrollView>
  );
}
