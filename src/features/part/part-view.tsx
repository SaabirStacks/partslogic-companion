import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { partAnswer } from '@/features/lookup/answer';
import { supabase } from '@/lib/supabase';
import { useRemote } from '@/lib/use-remote';
import { useSession } from '@/session/session-provider';
import { Button } from '@/ui/button';
import { Fact, Facts } from '@/ui/facts';
import { Icon } from '@/ui/icon';
import { StatusChip } from '@/ui/status-chip';
import { Card, PressableCard } from '@/ui/surface';
import { SectionLabel } from '@/ui/section-label';
import { Txt } from '@/ui/text';
import { StatusStrip } from '@/ui/status-strip';
import { useColour } from '@/ui/theme';
import { Scroll } from '@/ui/scroll';
import { getPartAlternatives, type PartDetail } from '@/vendor/partslogic/shared/catalogue';
import { roleAtLeast } from '@/vendor/partslogic/shared/members';

import { PartRow } from './part-row';
import { formatPrice, formatQty } from './stock';

// The whole part, stock first: how many on hand with its stock chip, then every bin (with Move), prices,
// codes and alternatives. savedAt is set when this is the copy saved on the phone (no signal).
const savedTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function PartView({ detail, savedAt }: { detail: PartDetail; savedAt: string | null }) {
  const { state } = useSession();
  const currency = state.status === 'member' ? state.member.currency : 'GBP';
  const seesCost = state.status === 'member' && roleAtLeast(state.member.role, 'editor');
  // Moving needs signal and the counter role; a copy saved for offline use can't start one.
  const canMove = state.status === 'member' && roleAtLeast(state.member.role, 'counter') && !savedAt;
  const { part, item } = detail;
  const answer = partAnswer(detail, currency);
  const image = detail.images.find((candidate) => candidate.size !== 'thumb') ?? detail.images[0];
  const sell = item ? formatPrice(item.sellPrice, currency) : null;
  const trade = item ? formatPrice(item.pricing.tradePrice, currency) : null;
  const cost = item && seesCost ? formatPrice(item.bestCost, item.bestCurrency ?? currency) : null;
  const prices = [
    sell ? { label: 'Sell', value: sell } : null,
    trade ? { label: 'Trade', value: trade } : null,
    cost ? { label: 'Best cost', value: item?.bestSupplierName ? `${cost} · ${item.bestSupplierName}` : cost } : null,
  ].filter((row) => row !== null);
  const codes = [
    ...(item?.sku ? [{ label: 'SKU', value: item.sku }] : []),
    ...detail.barcodes.map((barcode) => ({ label: 'Barcode', value: barcode.display })),
  ];

  return (
    <Scroll className="bg-ground" contentContainerClassName="gap-3 px-4 pt-3">
      {savedAt ? <StatusStrip tone="warn" icon="offline" text={`Saved copy · ${savedTime(savedAt)}`} /> : null}

      <Card className="flex-row gap-3 p-3">
        {image ? (
          <Image
            source={{ uri: image.url }}
            contentFit="contain"
            accessibilityLabel={`Photo of ${part.brand} ${part.number}`}
            style={{ width: 80, height: 80, borderRadius: 8, backgroundColor: 'white' }}
          />
        ) : null}
        <View className="flex-1 gap-0.5">
          <Txt variant="caption" ink="text-quiet-ink">
            {part.brand}
          </Txt>
          <Txt selectable variant="headline" numbers className="font-extrabold">
            {part.number}
          </Txt>
          {answer.name ? <Txt variant="caption" ink="text-ink">{answer.name}</Txt> : null}
          {detail.categoryTrail.length > 0 ? <Txt variant="caption">{detail.categoryTrail[detail.categoryTrail.length - 1]}</Txt> : null}
        </View>
      </Card>

      <Card accessible accessibilityLabel={`${answer.status.label}${answer.onHand !== null ? `, ${answer.onHand} on hand` : ''}`} className="flex-row items-end gap-3 p-4">
        <View className="flex-1 self-start">
          <StatusChip tone={answer.tone} icon={answer.status.icon} label={answer.status.label} large />
        </View>
        {answer.onHand !== null ? (
          <View className="items-end">
            <Txt variant="display" numbers>
              {answer.onHand}
            </Txt>
            <Txt variant="caption">On hand</Txt>
          </View>
        ) : null}
      </Card>

      {item ? (
        <>
          <SectionLabel>Bins</SectionLabel>
          {item.stock.length === 0 ? <Txt variant="caption" className="px-1">Not in any bin</Txt> : null}
          {item.stock.map((line) => (
            <Card key={line.binId} className="min-h-16 flex-row items-center gap-3 py-2 pl-3 pr-2">
              <Txt variant="title" numberOfLines={1} className="flex-1 font-bold">
                {line.place}
              </Txt>
              <Txt variant="headline" numbers className="font-extrabold">
                {formatQty(line.qty)}
              </Txt>
              {canMove && line.qty > 0 ? (
                <PressableCard
                  accessibilityLabel={`Move stock from ${line.place}`}
                  onPress={() => router.push({ pathname: '/move', params: { partId: String(part.id), fromBinId: String(line.binId) } })}
                  className="h-12 flex-row items-center gap-1.5 px-3">
                  <Icon name="move" size={18} colour="action-ink" />
                  <Txt variant="label" className="font-bold">
                    Move
                  </Txt>
                </PressableCard>
              ) : null}
            </Card>
          ))}
        </>
      ) : null}

      {prices.length > 0 ? (
        <>
          <SectionLabel>Prices</SectionLabel>
          <Facts>
            {prices.map((row, index) => (
              <Fact key={row.label} label={row.label} value={row.value} last={index === prices.length - 1} />
            ))}
          </Facts>
        </>
      ) : null}

      {codes.length > 0 ? (
        <>
          <SectionLabel>Codes</SectionLabel>
          <Facts>
            {codes.map((row, index) => (
              <Fact key={`${row.label}:${row.value}`} label={row.label} value={row.value} selectable last={index === codes.length - 1} />
            ))}
          </Facts>
        </>
      ) : null}

      <Alternatives partId={part.id} currency={currency} />
    </Scroll>
  );
}

function Alternatives({ partId, currency }: { partId: number; currency: string }) {
  const colourOf = useColour();
  const [open, setOpen] = useState(false);
  const { data, error, loading, reload } = useRemote(open ? `alternatives:${partId}` : null, () =>
    getPartAlternatives(supabase, partId),
  );

  if (!open) return <Button label="Alternatives" icon="lookup" variant="secondary" onPress={() => setOpen(true)} />;
  if (loading && !data) return <ActivityIndicator accessibilityLabel="Loading alternatives" color={colourOf('quiet-ink')} className="py-4" />;
  if (error && !data) return <Button label="Alternatives didn’t load · try again" icon="retry" variant="secondary" onPress={reload} />;
  if (!data || data.length === 0) return <StatusStrip tone="neutral" icon="lookup" text="No alternatives on record" />;
  return (
    <>
      <SectionLabel>Alternatives</SectionLabel>
      {data.map((alternative) => (
        <PartRow
          key={alternative.partId}
          brand={alternative.brand}
          number={alternative.number}
          description={alternative.inRange ? formatPrice(alternative.sellPrice, currency) : 'Not stocked here'}
          value={alternative.inRange ? `${formatQty(alternative.onHand)} on hand` : undefined}
          onPress={() => router.push(`/part/${alternative.partId}`)}
        />
      ))}
    </>
  );
}

