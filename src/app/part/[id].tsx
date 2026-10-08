import { Image } from 'expo-image';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { db } from '@/db/database';
import { savedPart, savePart } from '@/features/part/part-cache';
import { PartRow } from '@/features/part/part-row';
import { formatPrice, formatQty, stockBadge } from '@/features/part/stock';
import { supabase } from '@/lib/supabase';
import { useRemote } from '@/lib/use-remote';
import { useSession } from '@/session/session-provider';
import { Button } from '@/ui/button';
import { EmptyState } from '@/ui/empty-state';
import { ListGroup, ListRow } from '@/ui/list';
import { StockBadge } from '@/ui/stock-badge';
import { getPartAlternatives, getPartDetail, type PartDetail } from '@/vendor/partslogic/shared/catalogue';
import { classifyQueueError } from '@/vendor/partslogic/shared/errors';
import { roleAtLeast } from '@/vendor/partslogic/shared/members';

export default function PartCard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const partId = Number(id);
  const valid = Number.isInteger(partId) && partId > 0;
  const { data, error, loading, reload } = useRemote(valid ? `part:${partId}` : null, () => loadPart(partId));

  // Coming back from Move (or anywhere else) shows the stock as it is now.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      reload();
    }, [reload]),
  );

  let body;
  if (!valid || data === null) {
    body = <EmptyState icon="lookup" title="Part not found" body="It may have been merged or removed." />;
  } else if (data) {
    body = <Detail detail={data.detail} savedAt={data.savedAt} />;
  } else if (error && !loading) {
    const offline = classifyQueueError(error as { code?: string; message?: string }) === 'retry';
    body = (
      <EmptyState
        icon={offline ? 'offline' : 'warning'}
        title={offline ? 'No signal' : 'Couldn’t load this part'}
        body={offline ? 'Part details need a connection. Try again when you’re back online.' : (error as Error).message}>
        <Button label="Try again" variant="secondary" onPress={reload} />
      </EmptyState>
    );
  } else {
    body = <Skeleton />;
  }

  return (
    <>
      <Stack.Screen
        options={{ title: data ? `${data.detail.part.brand} ${data.detail.part.number}` : '', headerLargeTitle: false }}
      />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerClassName="flex-grow">
        {body}
      </ScrollView>
    </>
  );
}

// Fresh from PartsLogic when there's signal (and saved for later); the copy saved on this phone when not.
async function loadPart(partId: number): Promise<{ detail: PartDetail; savedAt: string | null } | null> {
  try {
    const detail = await getPartDetail(supabase, partId);
    if (detail) await savePart(db(), detail);
    return detail ? { detail, savedAt: null } : null;
  } catch (error) {
    if (classifyQueueError(error as { code?: string; message?: string }) !== 'retry') throw error;
    const saved = await savedPart(db(), partId);
    if (!saved) throw error;
    return { detail: saved.detail, savedAt: saved.cachedAt };
  }
}

const timeOf = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function Detail({ detail, savedAt }: { detail: PartDetail; savedAt: string | null }) {
  const { state } = useSession();
  const currency = state.status === 'member' ? state.member.currency : 'GBP';
  const seesCost = state.status === 'member' && roleAtLeast(state.member.role, 'editor');
  // Moving needs signal and the counter role; a card saved for offline use can't start one.
  const canMove = state.status === 'member' && roleAtLeast(state.member.role, 'counter') && !savedAt;
  const { part, item } = detail;
  const image = detail.images.find((candidate) => candidate.size !== 'thumb') ?? detail.images[0];
  const name = detail.displayName ?? part.description;
  const sell = item ? formatPrice(item.sellPrice, currency) : null;
  const trade = item ? formatPrice(item.pricing.tradePrice, currency) : null;
  const cost = item && seesCost ? formatPrice(item.bestCost, item.bestCurrency ?? currency) : null;
  const barcodes = detail.barcodes.map((barcode) => barcode.display);

  return (
    <View className="gap-6 px-4 pb-10 pt-4">
      {savedAt ? (
        <Text accessibilityRole="alert" className="rounded-xl bg-plate px-4 py-3 text-sm text-mandatory-ink">
          No signal. This is the copy saved on this phone on {timeOf(savedAt)}; stock may have changed since.
        </Text>
      ) : null}
      <View className="flex-row gap-4">
        {image ? (
          <Image
            source={{ uri: image.url }}
            contentFit="contain"
            accessibilityLabel={`Photo of ${part.brand} ${part.number}`}
            style={{ width: 88, height: 88, borderRadius: 12, backgroundColor: 'white' }}
          />
        ) : null}
        <View className="flex-1 gap-1">
          <Text className="text-sm font-semibold text-quiet-ink">{part.brand}</Text>
          <Text selectable className="text-2xl font-bold tabular-nums text-ink">
            {part.number}
          </Text>
          {name ? <Text className="text-base leading-6 text-ink">{name}</Text> : null}
          {detail.categoryTrail.length > 0 ? (
            <Text className="text-sm text-quiet-ink">{detail.categoryTrail[detail.categoryTrail.length - 1]}</Text>
          ) : null}
        </View>
      </View>

      {item ? (
        <ListGroup title="Stock">
          <View
            accessible
            accessibilityLabel={`On hand ${formatQty(item.onHand)}`}
            className="flex-row items-center justify-between border-b border-rule px-4 py-3">
            <Text className="text-base text-ink">On hand</Text>
            <View className="flex-row items-center gap-2">
              <StockBadge badge={stockBadge(item)} />
              <Text className="text-2xl font-bold tabular-nums text-ink">{formatQty(item.onHand)}</Text>
            </View>
          </View>
          {item.stock.length > 0 ? (
            item.stock.map((line, index) => (
              <ListRow
                key={line.binId}
                label={line.place}
                value={formatQty(line.qty)}
                tabular
                onPress={
                  canMove && line.qty > 0
                    ? () => router.push({ pathname: '/move', params: { partId: String(part.id), fromBinId: String(line.binId) } })
                    : undefined
                }
                last={index === item.stock.length - 1}
              />
            ))
          ) : (
            <ListRow label="Not in any bin" last />
          )}
        </ListGroup>
      ) : null}
      {item && canMove && item.stock.some((line) => line.qty > 0) ? (
        <Text className="-mt-4 px-4 text-sm text-quiet-ink">Tap a bin to move stock from it.</Text>
      ) : null}
      {!item ? (
        <ListGroup title="Stock">
          <ListRow label="Not in your range" detail="This part is in the catalogue, but it isn't stocked here." last />
        </ListGroup>
      ) : null}

      {sell || trade || cost ? (
        <ListGroup title="Prices">
          {[
            sell ? { label: 'Sell price', value: sell } : null,
            trade ? { label: 'Trade price', value: trade } : null,
            cost ? { label: 'Best cost', value: cost, detail: item?.bestSupplierName } : null,
          ]
            .filter((row) => row !== null)
            .map((row, index, rows) => (
              <ListRow key={row.label} {...row} tabular last={index === rows.length - 1} />
            ))}
        </ListGroup>
      ) : null}

      {item?.sku || barcodes.length > 0 ? (
        <ListGroup title="Codes">
          {item?.sku ? <ListRow label="SKU" value={item.sku} tabular last={barcodes.length === 0} /> : null}
          {barcodes.map((code, index) => (
            <ListRow key={code} label="Barcode" value={code} tabular last={index === barcodes.length - 1} />
          ))}
        </ListGroup>
      ) : null}

      <Alternatives partId={part.id} currency={currency} />
    </View>
  );
}

function Alternatives({ partId, currency }: { partId: number; currency: string }) {
  const [open, setOpen] = useState(false);
  const { data, error, loading, reload } = useRemote(open ? `alternatives:${partId}` : null, () =>
    getPartAlternatives(supabase, partId),
  );

  if (!open) return <Button label="Show alternatives" variant="secondary" onPress={() => setOpen(true)} />;
  if (loading && !data) return <Text className="px-4 text-base text-quiet-ink">Loading alternatives…</Text>;
  if (error && !data) return <Button label="Couldn’t load alternatives. Try again" variant="secondary" onPress={reload} />;
  if (!data || data.length === 0) {
    return <Text className="px-4 text-base text-quiet-ink">No alternatives on record for this part.</Text>;
  }
  return (
    <ListGroup title="Alternatives">
      {data.map((alternative, index) => (
        <PartRow
          key={alternative.partId}
          brand={alternative.brand}
          number={alternative.number}
          description={
            alternative.inRange
              ? [`${formatQty(alternative.onHand)} on hand`, formatPrice(alternative.sellPrice, currency)]
                  .filter(Boolean)
                  .join(' · ')
              : 'Not stocked here'
          }
          onPress={() => router.push(`/part/${alternative.partId}`)}
          last={index === data.length - 1}
        />
      ))}
    </ListGroup>
  );
}

function Skeleton() {
  return (
    <View accessibilityLabel="Loading part" className="gap-6 px-4 pt-4">
      <View className="gap-2">
        <View className="h-4 w-24 rounded bg-rule" />
        <View className="h-7 w-48 rounded bg-rule" />
        <View className="h-4 w-64 rounded bg-rule" />
      </View>
      <View className="h-32 rounded-xl bg-plate" />
      <View className="h-24 rounded-xl bg-plate" />
    </View>
  );
}
