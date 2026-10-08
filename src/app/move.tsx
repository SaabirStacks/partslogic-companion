import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { useMove } from '@/features/move/use-move';
import { formatQty } from '@/features/part/stock';
import { ActionBar } from '@/ui/action-bar';
import { BinChip } from '@/ui/bin-chip';
import { Button } from '@/ui/button';
import { JobBanner } from '@/ui/job-banner';
import { JobScreen } from '@/ui/job-screen';
import { Plate } from '@/ui/plate';
import { Quantity } from '@/ui/quantity';
import { ScanResultCard } from '@/ui/scan-result-card';
import { SectionLabel } from '@/ui/section-label';
import { Detail } from '@/ui/sign-text';
import { StatusStrip } from '@/ui/status-strip';

const idParam = (value: string | undefined) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// Move: one part from one bin to another, in the order it's done on the floor. Opened from the board it
// starts with a scan of the part; opened from a bin on the part screen, the part and bin are filled in.
export default function Move() {
  const params = useLocalSearchParams<{ partId?: string; fromBinId?: string }>();
  const moving = useMove({ partId: idParam(params.partId), fromBinId: idParam(params.fromBinId) });
  const { from, to, result } = moving;

  return (
    <JobScreen
      placeholder="Part number, barcode or bin"
      scanEnabled={moving.online && !moving.busy && !result}
      onScan={moving.scan}
      banner={<JobBanner title={moving.name ?? 'Scan the part'} detail={from ? `From ${from.place}` : null} />}
      result={<Answer moving={moving} />}
      action={
        result ? (
          <ActionBar label={result.kind === 'refused' ? 'Change and try again' : 'Move more'} icon="move" onPress={moving.again} />
        ) : from && to ? (
          <ActionBar
            label={`Move ${formatQty(moving.qty)} · ${from.place} → ${to.label}`}
            icon="move"
            busy={moving.busy}
            disabled={!!moving.problem || !moving.online}
            onPress={moving.move}
          />
        ) : null
      }>
      {!moving.online ? <StatusStrip tone="stop" icon="offline" text="Moving stock needs signal" /> : null}

      {moving.partId !== null && !result ? (
        <>
          <SectionLabel>From</SectionLabel>
          {moving.stock.length > 0 ? (
            <View className="flex-row flex-wrap gap-2">
              {moving.stock.map((line) => (
                <BinChip
                  key={line.binId}
                  code={line.place}
                  qty={formatQty(line.qty)}
                  selected={line.binId === from?.binId}
                  onPress={() => moving.chooseFrom(line.binId)}
                />
              ))}
            </View>
          ) : (
            <Detail className="px-1">{moving.loading ? 'Checking the bins' : 'Not in any bin'}</Detail>
          )}
        </>
      ) : null}

      {from && !result ? (
        <>
          <SectionLabel>To</SectionLabel>
          {to ? (
            <View className="flex-row flex-wrap gap-2">
              <BinChip code={to.label} selected onPress={moving.clearTo} />
            </View>
          ) : (
            <>
              <Detail className="px-1">Scan the bin label, or choose:</Detail>
              <View className="flex-row flex-wrap gap-2">
                {moving.stock
                  .filter((line) => line.binId !== from.binId)
                  .map((line) => (
                    <BinChip key={line.binId} code={line.place} qty={formatQty(line.qty)} onPress={() => moving.chooseTo({ binId: line.binId, label: line.place })} />
                  ))}
              </View>
            </>
          )}

          <SectionLabel>How many</SectionLabel>
          <Plate className="flex-row items-center justify-between gap-3 px-3 py-2">
            <Quantity total={moving.qty} name={moving.name ?? 'the part'} onStep={(change) => moving.setQty(moving.qty + change)} onSet={moving.setQty} />
            {moving.available > 1 && moving.qty !== moving.available ? (
              <Button label={`All ${formatQty(moving.available)}`} variant="secondary" compact onPress={() => moving.setQty(moving.available)} />
            ) : null}
          </Plate>
          {moving.problem && to ? <Detail ink="text-stop-ink" className="px-1">{moving.problem}</Detail> : null}
        </>
      ) : null}
    </JobScreen>
  );
}

function Answer({ moving }: { moving: ReturnType<typeof useMove> }) {
  const { result, notice } = moving;
  if (result) {
    const tone = result.kind === 'moved' ? 'safe' : result.kind === 'unknown' ? 'warning' : 'stop';
    return (
      <ScanResultCard
        tone={tone}
        status={
          result.kind === 'moved'
            ? { icon: 'sent', label: 'Moved' }
            : result.kind === 'unknown'
              ? { icon: 'warning', label: 'Not sure it moved' }
              : { icon: 'stop', label: 'Not moved' }
        }
        title={moving.name ?? 'Stock'}
        detail={result.message}
      />
    );
  }
  if (notice) {
    return <ScanResultCard key={`${notice.title}:${notice.detail}`} tone="warning" status={{ icon: 'warning', label: 'Not used' }} title={notice.title} detail={notice.detail} />;
  }
  return null;
}
