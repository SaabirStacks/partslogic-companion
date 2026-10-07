import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { moveProblem, outcomeUnknown } from '@/features/move/move-rules';
import { formatQty } from '@/features/part/stock';
import { deviceLabel } from '@/lib/device';
import { useOnline } from '@/lib/network';
import { supabase } from '@/lib/supabase';
import { useRemote } from '@/lib/use-remote';
import { CameraScanner } from '@/scan/camera-scanner';
import { scanFeedback } from '@/scan/feedback';
import { resolveCode } from '@/scan/resolve';
import { ScanField } from '@/scan/scan-field';
import { useWorkingLocation } from '@/session/location-provider';
import { Button } from '@/ui/button';
import { ListGroup, ListRow } from '@/ui/list';
import { Panel } from '@/ui/panel';
import { Quantity } from '@/ui/quantity';
import { getPartDetail } from '@/vendor/partslogic/shared/catalogue';
import { transferStock } from '@/vendor/partslogic/shared/inventory';

type Destination = { binId: number; label: string };
type Result = { kind: 'moved' | 'unknown' | 'refused'; message: string };

// Moves stock of one part from one bin to another. Online only: a move has no id made on the phone, so it
// is never queued or sent twice (see move-rules.ts).
export default function Move() {
  const params = useLocalSearchParams<{ partId: string; fromBinId: string }>();
  const partId = Number(params.partId);
  const fromBinId = Number(params.fromBinId);
  const online = useOnline();
  const { location } = useWorkingLocation();

  // Read again here, so "here" is the current quantity and the part's other bins are offered.
  const part = useRemote(`move:${partId}:${fromBinId}`, () => getPartDetail(supabase, partId));
  const stock = part.data?.item?.stock ?? [];
  const from = stock.find((line) => line.binId === fromBinId);
  const available = from?.qty ?? 0;
  const name = part.data ? `${part.data.part.brand} ${part.data.part.number}` : '';

  const [to, setTo] = useState<Destination | null>(null);
  const [qty, setQty] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function chooseBin(code: string) {
    setNotice(null);
    try {
      const hit = await resolveCode(code, location);
      if (hit.type === 'bin') {
        scanFeedback.found();
        setTo({ binId: hit.binId, label: `${hit.bin} · ${hit.location}` });
      } else {
        scanFeedback.unknown();
        setNotice(hit.type === 'part' ? 'That’s a part. Scan the label of the bin it’s going to.' : `${code} isn’t a bin we know.`);
      }
    } catch (error) {
      setNotice((error as Error).message);
    }
  }

  async function move() {
    if (!to) return;
    setBusy(true);
    try {
      await transferStock(supabase, { fromBinId, toBinId: to.binId, partId, qty, reference: `Moved on ${deviceLabel()}` });
      scanFeedback.found();
      setResult({ kind: 'moved', message: `Moved ${formatQty(qty)} of ${name} from ${from?.place} to ${to.label}.` });
    } catch (error) {
      scanFeedback.failed();
      setResult(
        outcomeUnknown(error)
          ? {
              kind: 'unknown',
              message:
                'No answer from PartsLogic, so the move may or may not have happened. Check the stock on the part card before trying again.',
            }
          : { kind: 'refused', message: (error as Error).message },
      );
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <ScrollView contentContainerClassName="gap-4 px-4 pb-10 pt-6">
        <Panel
          icon={result.kind === 'moved' ? 'sent' : 'warning'}
          iconColour={result.kind === 'moved' ? 'tint' : 'out'}
          title={result.kind === 'moved' ? 'Moved' : result.kind === 'unknown' ? 'Not sure it moved' : 'Not moved'}
          body={result.message}>
          {result.kind === 'refused' ? (
            <Button label="Change and try again" variant="secondary" onPress={() => setResult(null)} />
          ) : null}
          <Button label="Done" onPress={() => router.back()} />
        </Panel>
      </ScrollView>
    );
  }

  const problem = moveProblem({ fromBinId, toBinId: to?.binId ?? null, qty, available });
  const otherBins = stock.filter((line) => line.binId !== fromBinId);

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-5 px-4 pb-10 pt-6">
      <View className="gap-1 px-1">
        <Text accessibilityRole="header" className="text-xl font-semibold text-ink">
          Move {name || 'stock'}
        </Text>
        <Text className="text-base tabular-nums text-quiet-ink">
          {from ? `From ${from.place}: ${formatQty(available)} here` : part.loading ? 'Checking the bin…' : 'This bin no longer holds it.'}
        </Text>
      </View>

      {!online ? (
        <Panel
          icon="offline"
          title="Moving stock needs signal"
          body="A move is checked against the bin there and then, so it can’t be saved for later."
        />
      ) : (
        <>
          <View className="gap-2">
            <Text className="px-1 text-sm font-semibold text-ink">Going to</Text>
            {to ? (
              <ListRow label={to.label} value="Change" onPress={() => setTo(null)} last />
            ) : (
              <>
                <CameraScanner className="h-36" onScan={(code) => void chooseBin(code)} />
                <ScanField placeholder="Bin label, for example B-07" onSubmit={(code) => void chooseBin(code)} />
                {notice ? <Text className="px-1 text-sm text-out">{notice}</Text> : null}
                {otherBins.length > 0 ? (
                  <ListGroup title="Bins that already hold it">
                    {otherBins.map((line, index) => (
                      <ListRow
                        key={line.binId}
                        label={line.place}
                        value={`${formatQty(line.qty)} there`}
                        tabular
                        onPress={() => setTo({ binId: line.binId, label: line.place })}
                        last={index === otherBins.length - 1}
                      />
                    ))}
                  </ListGroup>
                ) : null}
              </>
            )}
          </View>

          <View className="flex-row items-center justify-between gap-3 px-1">
            <Text className="text-base text-ink">How many</Text>
            <View className="flex-row items-center gap-3">
              <Quantity total={qty} name={name} onStep={(change) => setQty((n) => Math.max(0, n + change))} onSet={setQty} />
              {available > 1 && qty !== available ? (
                <Button label={`All ${formatQty(available)}`} variant="secondary" onPress={() => setQty(available)} />
              ) : null}
            </View>
          </View>

          {problem && to ? <Text className="px-1 text-sm text-quiet-ink">{problem}</Text> : null}
          <Button label={`Move ${formatQty(qty)}`} busy={busy} disabled={!!problem || !from} onPress={() => void move()} />
        </>
      )}
    </ScrollView>
  );
}
