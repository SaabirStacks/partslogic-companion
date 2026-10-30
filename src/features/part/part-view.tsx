import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useBinName } from '@/features/bins/use-bin-name';
import { partAnswer } from '@/features/lookup/answer';
import { supabase } from '@/lib/supabase';
import { useRemote } from '@/lib/use-remote';
import { useSession } from '@/session/session-provider';
import { Button } from '@/ui/button';
import { Fact, Facts } from '@/ui/facts';
import { SectionLabel } from '@/ui/section-label';
import { Txt } from '@/ui/text';
import { StatusStrip } from '@/ui/status-strip';
import { useColour } from '@/ui/theme';
import { Scroll } from '@/ui/scroll';
import { getPartAlternatives, type PartDetail } from '@/vendor/partslogic/shared/catalogue';
import { roleAtLeast } from '@/vendor/partslogic/shared/members';

import { PartPhotos, photoList } from './part-photos';
import { PartRow } from './part-row';
import { StockCard } from './stock-card';
import { formatPrice, formatQty } from './stock';

// The whole part, photo first: the picture big enough to recognise the part, then who makes it and its
// number, then stock as a short stock sheet (on hand, then every bin with Move), prices, codes and
// alternatives. Nothing about stock is hidden. savedAt is set when this is the copy saved on the phone (no
// signal).
const savedTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// "Oil filter" and "Oil filters" say the same thing; a category is only shown when it adds something.
const sameWords = (a: string, b: string) => {
  const plain = (text: string) => text.trim().toLowerCase().replace(/s$/, '');
  return plain(a) === plain(b);
};

export function PartView({ detail, savedAt, onRefresh, refreshing = false }: { detail: PartDetail; savedAt: string | null; onRefresh?: () => void; refreshing?: boolean }) {
  const { state } = useSession();
  const nameOf = useBinName();
  const currency = state.status === 'member' ? state.member.currency : 'GBP';
  const seesCost = state.status === 'member' && roleAtLeast(state.member.role, 'editor');
  // Moving needs signal and the counter role; a copy saved for offline use can't start one.
  const canMove = state.status === 'member' && roleAtLeast(state.member.role, 'counter') && !savedAt;
  const { part, item } = detail;
  const answer = partAnswer(detail, currency);
  const photos = photoList(detail.images);
  const category = detail.categoryTrail[detail.categoryTrail.length - 1] ?? null;
  const showCategory = category && !(answer.name && sameWords(answer.name, category));
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
    <Scroll className="bg-ground" contentContainerClassName="gap-3 px-4 pt-3" onRefresh={onRefresh} refreshing={refreshing}>
      {savedAt ? <StatusStrip tone="warn" icon="offline" text={`Saved copy · ${savedTime(savedAt)}`} /> : null}

      <PartPhotos photos={photos} label={`${part.brand} ${part.number}`} />

      <View accessible className="gap-0.5 px-1 pt-1">
        <Txt variant="caption" ink="text-parts" className="font-bold uppercase tracking-[0.5px]">
          {part.brand}
        </Txt>
        <Txt selectable variant="display" numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>
          {part.number}
        </Txt>
        {answer.name || showCategory ? (
          <Txt variant="body" numberOfLines={2}>
            {answer.name ?? category}
            {answer.name && showCategory ? <Txt variant="body" ink="text-quiet-ink">{` · ${category}`}</Txt> : null}
          </Txt>
        ) : null}
      </View>

      <StockCard
        answer={answer}
        lines={item ? item.stock : null}
        nameOf={nameOf}
        canMove={canMove}
        onMove={(line) => router.push({ pathname: '/move', params: { partId: String(part.id), fromBinId: String(line.binId) } })}
      />

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

  if (!open) return <Button label="Alternatives" icon="lookup" variant="tinted" onPress={() => setOpen(true)} />;
  if (loading && !data) return <ActivityIndicator accessibilityLabel="Loading alternatives" color={colourOf('quiet-ink')} className="py-4" />;
  if (error && !data) return <Button label="Alternatives didn’t load · try again" icon="retry" variant="tinted" onPress={reload} />;
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
