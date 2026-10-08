import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { partAnswer } from '@/features/lookup/answer';
import { supabase } from '@/lib/supabase';
import { useRemote } from '@/lib/use-remote';
import { useSession } from '@/session/session-provider';
import { Button } from '@/ui/button';
import { Fact, Facts } from '@/ui/facts';
import { Icon } from '@/ui/icon';
import { ON_TONE, Plate, PressablePlate, TEXT_ON } from '@/ui/plate';
import { SectionLabel } from '@/ui/section-label';
import { Detail, SignText } from '@/ui/sign-text';
import { StatusStrip } from '@/ui/status-strip';
import { useColour } from '@/ui/theme';
import { getPartAlternatives, type PartDetail } from '@/vendor/partslogic/shared/catalogue';
import { roleAtLeast } from '@/vendor/partslogic/shared/members';

import { PartRow } from './part-row';
import { formatPrice, formatQty } from './stock';

// The whole part, stock first: how many on hand as the stock sign, then every bin (with Move), prices,
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
    <ScrollView className="bg-ground" contentContainerClassName="gap-3 px-3 pb-10 pt-3">
      {savedAt ? <StatusStrip tone="warning" icon="offline" text={`Saved copy · ${savedTime(savedAt)}`} /> : null}

      <Plate className="flex-row gap-3 p-3">
        {image ? (
          <Image
            source={{ uri: image.url }}
            contentFit="contain"
            accessibilityLabel={`Photo of ${part.brand} ${part.number}`}
            style={{ width: 80, height: 80, borderRadius: 6, backgroundColor: 'white' }}
          />
        ) : null}
        <View className="flex-1 gap-0.5">
          <SignText size="tag" ink="text-quiet-ink">
            {part.brand}
          </SignText>
          <SignText selectable size="headline" weight="heavy">
            {part.number}
          </SignText>
          {answer.name ? <Detail ink="text-ink">{answer.name}</Detail> : null}
          {detail.categoryTrail.length > 0 ? <Detail>{detail.categoryTrail[detail.categoryTrail.length - 1]}</Detail> : null}
        </View>
      </Plate>

      <Plate tone={answer.tone} heavy accessible accessibilityLabel={`${answer.status.label}${answer.onHand !== null ? `, ${answer.onHand} on hand` : ''}`} className="flex-row items-end gap-3 p-4">
        <View className="flex-1 flex-row items-center gap-2 self-start">
          <Icon name={answer.status.icon} size={20} colour={ON_TONE[answer.tone]} />
          <SignText size="label" weight="heavy" ink={TEXT_ON[answer.tone]}>
            {answer.status.label}
          </SignText>
        </View>
        {answer.onHand !== null ? (
          <View className="items-end">
            <SignText size="hero" weight="heavy" ink={TEXT_ON[answer.tone]}>
              {answer.onHand}
            </SignText>
            <SignText size="tag" ink={TEXT_ON[answer.tone]}>
              On hand
            </SignText>
          </View>
        ) : null}
      </Plate>

      {item ? (
        <>
          <SectionLabel>Bins</SectionLabel>
          {item.stock.length === 0 ? <Detail className="px-1">Not in any bin</Detail> : null}
          {item.stock.map((line) => (
            <Plate key={line.binId} className="min-h-16 flex-row items-center gap-3 py-2 pl-3 pr-2">
              <SignText size="title" weight="heavy" numberOfLines={1} className="flex-1">
                {line.place}
              </SignText>
              <SignText size="display" weight="heavy">
                {formatQty(line.qty)}
              </SignText>
              {canMove && line.qty > 0 ? (
                <PressablePlate
                  tone="mandatory"
                  accessibilityLabel={`Move stock from ${line.place}`}
                  onPress={() => router.push({ pathname: '/move', params: { partId: String(part.id), fromBinId: String(line.binId) } })}
                  className="h-12 flex-row items-center gap-1.5 px-3">
                  <Icon name="move" size={18} colour="on-mandatory" />
                  <SignText size="label" ink="text-on-mandatory">
                    Move
                  </SignText>
                </PressablePlate>
              ) : null}
            </Plate>
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
    </ScrollView>
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
  if (!data || data.length === 0) return <StatusStrip tone="surface" icon="lookup" text="No alternatives on record" />;
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

