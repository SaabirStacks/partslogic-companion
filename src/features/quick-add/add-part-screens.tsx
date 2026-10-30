import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useDebounced } from '@/lib/use-debounced';
import { supabase } from '@/lib/supabase';
import { useRemote } from '@/lib/use-remote';
import { scanFeedback } from '@/scan/feedback';
import { resolveCode } from '@/scan/resolve';
import { useWorkingLocation } from '@/session/location-provider';
import { ActionBar } from '@/ui/action-bar';
import { KeyboardScreen } from '@/ui/keyboard-screen';
import { Scroll } from '@/ui/scroll';
import { Button } from '@/ui/button';
import { Field } from '@/ui/field';
import { Icon } from '@/ui/icon';
import { JobBanner } from '@/ui/job-banner';
import { JobScreen } from '@/ui/job-screen';
import { Notice } from '@/ui/notice';
import { Choice } from '@/ui/choice';
import { Card, PressableCard } from '@/ui/surface';
import { ScanResultCard } from '@/ui/scan-result-card';
import { SectionLabel } from '@/ui/section-label';
import { Txt } from '@/ui/text';
import { StatusStrip } from '@/ui/status-strip';
import { brandOptions } from '@/vendor/partslogic/shared/add-part';
import { barcodeProblem, looksLikeBarcode } from '@/vendor/partslogic/shared/gtin';

import { useQuickAdd, type BrandChoice } from './use-quick-add';

// Add part's two steps: scanning the barcode (from the board) and the form for the new part.

type Found = { kind: 'part'; partId: number; name: string } | { kind: 'other'; title: string; detail: string };

// Step one from the board: scan the box. A code that's already a part says so, with the way to it.
export function ScanCode({ onCode }: { onCode: (code: string) => void }) {
  const { location } = useWorkingLocation();
  const [found, setFound] = useState<Found | null>(null);

  async function check(code: string) {
    setFound(null);
    try {
      const hit = await resolveCode(code, location);
      if (hit.type === 'part') {
        scanFeedback.unknown();
        setFound({ kind: 'part', partId: hit.partId, name: `${hit.brand} ${hit.number}` });
      } else if (hit.type === 'bin') {
        scanFeedback.unknown();
        setFound({ kind: 'other', title: hit.bin, detail: 'That’s a bin label' });
      } else {
        scanFeedback.found();
        onCode(code);
      }
    } catch (error) {
      scanFeedback.failed();
      setFound({ kind: 'other', title: code, detail: (error as Error).message });
    }
  }

  return (
    <JobScreen
      placeholder="Barcode on the box"
      onScan={(code) => void check(code)}
      banner={<JobBanner family="parts" title="Scan the barcode" />}
      result={
        found?.kind === 'part' ? (
          <ScanResultCard key={found.partId} tone="warn" status={{ icon: 'warning', label: 'Already a part' }} title={found.name}>
            <Button label="Open the part" icon="forward" variant="tinted" compact onPress={() => router.push(`/part/${found.partId}`)} />
          </ScanResultCard>
        ) : found ? (
          <ScanResultCard key={found.title} tone="warn" status={{ icon: 'warning', label: 'Not added' }} title={found.title} detail={found.detail} />
        ) : null
      }
    />
  );
}

export function AddForm({ code }: { code: string }) {
  const adding = useQuickAdd(code);
  const [brandText, setBrandText] = useState('');
  const [brand, setBrand] = useState<BrandChoice | null>(null);
  const [number, setNumber] = useState('');

  const query = useDebounced(brandText.trim(), 250);
  const brands = useRemote(adding.online && !brand ? `brands:${query}` : null, () => brandOptions(supabase, query || null, 8));
  const exact = brands.data?.some((option) => option.name.toLowerCase() === query.toLowerCase()) ?? false;
  const problem = looksLikeBarcode(code) ? barcodeProblem(code) : null;
  const outcome = adding.outcome;

  const choose = (choice: BrandChoice) => {
    setBrand(choice);
    setBrandText(choice.name);
    adding.reset();
  };

  if (outcome && (outcome.kind === 'added' || outcome.kind === 'queued' || outcome.kind === 'conflict')) {
    const holder = outcome.kind === 'added' ? outcome.partId : outcome.kind === 'conflict' ? outcome.holderId : null;
    return (
      <Scroll className="bg-ground" contentContainerClassName="flex-grow">
        <Notice
          icon={outcome.kind === 'conflict' ? 'stop' : outcome.kind === 'queued' ? 'waiting' : 'sent'}
          tone={outcome.kind === 'conflict' ? 'stop' : outcome.kind === 'queued' ? 'warn' : 'ok'}
          title={outcome.kind === 'conflict' ? 'Not added' : outcome.kind === 'queued' ? 'Saved' : 'Part added'}
          line={outcome.message}>
          {holder !== null ? (
            <Button label="Open the part" icon="forward" onPress={() => router.replace(`/part/${holder}`)} />
          ) : null}
          <Button label="Done" variant="secondary" onPress={() => router.back()} />
        </Notice>
      </Scroll>
    );
  }

  const chosenBrand = brand ?? (brandText.trim() ? { brandId: null, name: brandText.trim().toUpperCase() } : null);

  return (
    <KeyboardScreen>
      <Scroll toEdge={false} contentContainerClassName="gap-3 px-4 pt-3">
        <Card className="gap-0.5 px-3 py-2">
          <Txt variant="caption" ink="text-quiet-ink">
            Barcode
          </Txt>
          <Txt selectable variant="headline">
            {code}
          </Txt>
        </Card>
        {problem ? <StatusStrip tone="warn" icon="warning" text={problem} /> : null}
        {!adding.online ? <StatusStrip tone="warn" icon="offline" text="Offline · the brand is checked when it sends" /> : null}

        {brand ? (
          <>
            <SectionLabel>Brand</SectionLabel>
            <Choice
              selected
              title={brand.brandId == null ? `${brand.name} · new` : brand.name}
              detail="Tap to change"
              accessibilityLabel={`Brand ${brand.name}. Change`}
              onPress={() => {
                setBrand(null);
                setBrandText('');
              }}
            />
          </>
        ) : (
          <>
            <Field
              label="Brand"
              value={brandText}
              onChangeText={setBrandText}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder={adding.online ? 'Search brands' : 'Brand name'}
            />
            {adding.online
              ? (brands.data ?? []).slice(0, 6).map((option) => (
                  <Choice
                    key={option.brandId}
                    title={option.name}
                    detail={[option.alias ? `Also ${option.alias}` : null, `${option.parts} parts`].filter(Boolean).join(' · ')}
                    accessibilityLabel={`${option.name}${option.alias ? `, also called ${option.alias}` : ''}`}
                    onPress={() => choose({ brandId: option.brandId, name: option.name })}
                  />
                ))
              : null}
            {adding.online && query && !exact ? (
              <PressableCard
                accessibilityLabel={`Use ${query.toUpperCase()} as a new brand`}
                onPress={() => choose({ brandId: null, name: query.toUpperCase() })}
                className="min-h-14 flex-row items-center gap-3 px-4">
                <Icon name="plus" size={18} colour="action-ink" />
                <Txt variant="label" className="font-bold">{`New brand · ${query.toUpperCase()}`}</Txt>
              </PressableCard>
            ) : null}
          </>
        )}

        <Field label="Part number" value={number} onChangeText={setNumber} autoCapitalize="characters" autoCorrect={false} placeholder="As printed on the box" />

        {outcome?.kind === 'confirm-brand' ? (
          <View className="gap-3 rounded-card bg-warn-soft p-3">
            <Txt variant="caption" ink="text-warn-ink" className="font-semibold">{outcome.message}</Txt>
            <Button
              label={`Yes, ${brandText.trim().toUpperCase()} is new`}
              busy={adding.busy}
              compact
              onPress={() => void adding.submit({ brandId: null, name: brandText.trim().toUpperCase() }, number, true)}
            />
          </View>
        ) : null}
        {outcome?.kind === 'error' ? <StatusStrip tone="stop" icon="stop" text={outcome.message} /> : null}
      </Scroll>
      <ActionBar
        label={adding.online ? 'Add part' : 'Save to add later'}
        icon="add"
        tone="neutral"
        busy={adding.busy}
        disabled={!chosenBrand || !number.trim()}
        onPress={() => chosenBrand && void adding.submit(chosenBrand, number)}
      />
    </KeyboardScreen>
  );
}
