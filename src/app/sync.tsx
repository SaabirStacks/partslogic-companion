import { Text, View } from 'react-native';

import { AccountSection } from '@/features/account/account-section';
import { outboxSummary } from '@/features/outbox/status';
import { useOnline } from '@/lib/network';
import { useOutbox } from '@/queue/outbox-provider';
import { useScanIndex } from '@/scan/scan-index-provider';
import { Button } from '@/ui/button';
import { Icon } from '@/ui/icon';
import { ListGroup, ListRow } from '@/ui/list';
import { Screen } from '@/ui/screen';

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const number = (value: number) => new Intl.NumberFormat('en-GB').format(value);

export default function Outbox() {
  const outbox = useOutbox();
  const scanIndex = useScanIndex();
  const online = useOnline();
  const summary = outboxSummary({ ...outbox, online });

  const attention = outbox.items.filter((item) => item.status === 'attention');
  const waiting = outbox.items.filter((item) => item.status === 'pending' || item.status === 'sending');
  const sent = outbox.items.filter((item) => item.status === 'done');

  return (
    <Screen>
      <View accessible className="items-center gap-2 px-8 py-8">
        <Icon
          name={summary.icon}
          size={36}
          colour={summary.icon === 'warning' ? 'stop-ink' : summary.icon === 'sent' ? 'safe-ink' : 'quiet-ink'}
        />
        <Text accessibilityRole="header" className="text-center text-xl font-semibold text-ink">
          {summary.title}
        </Text>
        <Text className="text-center text-base leading-6 text-quiet-ink">{summary.body}</Text>
        {outbox.lastSentAt ? (
          <Text className="text-sm tabular-nums text-quiet-ink">Last sent at {time(outbox.lastSentAt)}</Text>
        ) : null}
      </View>

      <View className="gap-6 px-4">
        {attention.length > 0 ? (
          <ListGroup title="Needs attention">
            {attention.map((item, index) => (
              <View key={item.clientId} className={index < attention.length - 1 ? 'border-b border-rule' : undefined}>
                <ListRow label={item.label} detail={item.lastError} last />
                <View className="px-4 pb-3">
                  <Button label="Try again" variant="secondary" onPress={() => void outbox.retry(item.clientId)} />
                </View>
              </View>
            ))}
          </ListGroup>
        ) : null}

        {waiting.length > 0 ? (
          <ListGroup title="Waiting to send">
            {waiting.slice(0, 50).map((item, index, shown) => (
              <ListRow key={item.clientId} label={item.label} last={index === shown.length - 1} />
            ))}
          </ListGroup>
        ) : null}

        {sent.length > 0 ? (
          <ListGroup title="Sent in the last day">
            {sent.slice(0, 10).map((item, index, shown) => (
              <ListRow
                key={item.clientId}
                label={item.label}
                value={time(item.updatedAt)}
                tabular
                last={index === shown.length - 1}
              />
            ))}
          </ListGroup>
        ) : null}

        <ListGroup title="Scan list on this phone">
          <ListRow
            label={
              scanIndex.progress !== null
                ? `Updating: ${number(scanIndex.progress)} codes so far`
                : scanIndex.saved
                  ? `${number(scanIndex.saved.codes)} codes`
                  : 'Not downloaded yet'
            }
            detail={
              scanIndex.failed
                ? 'The last update didn’t finish. It tries again when there’s signal.'
                : scanIndex.saved
                  ? `Updated at ${time(scanIndex.saved.syncedAt)}. Lets you scan with no signal.`
                  : 'Lets you scan with no signal. It downloads when there’s signal.'
            }
            last={!online || scanIndex.progress !== null}
          />
          {online && scanIndex.progress === null ? (
            <ListRow label="Update now" onPress={scanIndex.update} last />
          ) : null}
        </ListGroup>
      </View>

      <View className="mt-6">
        <AccountSection />
      </View>
    </Screen>
  );
}
