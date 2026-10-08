import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { useDebounced } from '@/lib/use-debounced';
import { supabase } from '@/lib/supabase';
import { useRemote } from '@/lib/use-remote';
import { scanFeedback } from '@/scan/feedback';
import { resolveCode } from '@/scan/resolve';
import { useWorkingLocation } from '@/session/location-provider';
import { ActionBar } from '@/ui/action-bar';
import { Button } from '@/ui/button';
import { Field } from '@/ui/field';
import { Icon } from '@/ui/icon';
import { JobBanner } from '@/ui/job-banner';
import { JobScreen } from '@/ui/job-screen';
import { Notice } from '@/ui/notice';
import { Plate, PressablePlate, TEXT_ON } from '@/ui/plate';
import { ScanResultCard } from '@/ui/scan-result-card';
import { SectionLabel } from '@/ui/section-label';
import { Detail, SignText } from '@/ui/sign-text';
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
      banner={<JobBanner title="Scan the barcode" />}
      result={
        found?.kind === 'part' ? (
          <ScanResultCard key={found.partId} tone="warning" status={{ icon: 'warning', label: 'Already a part' }} title={found.name}>
            <Button label="Open the part" icon="forward" variant="secondary" compact onPress={() => router.push(`/part/${found.partId}`)} />
          </ScanResultCard>
        ) : found ? (
          <ScanResultCard key={found.title} tone="warning" status={{ icon: 'warning', label: 'Not added' }} title={found.title} detail={found.detail} />
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
      <ScrollView className="bg-ground" contentContainerClassName="flex-grow">
        <Notice
          icon={outcome.kind === 'conflict' ? 'stop' : outcome.kind === 'queued' ? 'waiting' : 'sent'}
          tone={outcome.kind === 'conflict' ? 'stop' : outcome.kind === 'queued' ? 'warning' : 'safe'}
          title={outcome.kind === 'conflict' ? 'Not added' : outcome.kind === 'queued' ? 'Saved' : 'Part added'}
          line={outcome.message}>
          {holder !== null ? (
            <Button label="Open the part" icon="forward" onPress={() => router.replace(`/part/${holder}`)} />
          ) : null}
          <Button label="Done" variant="secondary" onPress={() => router.back()} />
        </Notice>
      </ScrollView>
    );
  }

  const chosenBrand = brand ?? (brandText.trim() ? { brandId: null, name: brandText.trim().toUpperCase() } : null);

  return (
    <KeyboardAvoidingView className="flex-1 bg-ground" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-3 px-3 pb-6 pt-3">
        <Plate className="gap-0.5 px-3 py-2">
          <SignText size="tag" ink="text-quiet-ink">
            Barcode
          </SignText>
          <SignText selectable size="headline" weight="heavy">
            {code}
          </SignText>
        </Plate>
        {problem ? <StatusStrip tone="warning" icon="warning" text={problem} /> : null}
        {!adding.online ? <StatusStrip tone="warning" icon="offline" text="Offline · the brand is checked when it sends" /> : null}

        {brand ? (
          <>
            <SectionLabel>Brand</SectionLabel>
            <PressablePlate
              tone="mandatory"
              accessibilityLabel={`Brand ${brand.name}. Change`}
              onPress={() => {
                setBrand(null);
                setBrandText('');
              }}
              className="min-h-14 flex-row items-center gap-3 px-3">
              <Icon name="check" size={20} colour="on-mandatory" />
              <SignText size="title" weight="heavy" ink={TEXT_ON.mandatory} className="flex-1">
                {brand.brandId == null ? `${brand.name} · new` : brand.name}
              </SignText>
              <SignText size="tag" ink={TEXT_ON.mandatory}>
                Change
              </SignText>
            </PressablePlate>
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
                  <PressablePlate
                    key={option.brandId}
                    accessibilityLabel={`${option.name}${option.alias ? `, also called ${option.alias}` : ''}`}
                    onPress={() => choose({ brandId: option.brandId, name: option.name })}
                    className="min-h-14 flex-row items-center gap-3 px-3 py-2">
                    <View className="flex-1">
                      <SignText size="label" weight="heavy">
                        {option.name}
                      </SignText>
                      {option.alias ? <Detail>{`Also ${option.alias}`}</Detail> : null}
                    </View>
                    <Detail>{`${option.parts} parts`}</Detail>
                  </PressablePlate>
                ))
              : null}
            {adding.online && query && !exact ? (
              <PressablePlate
                tone="plain"
                accessibilityLabel={`Use ${query.toUpperCase()} as a new brand`}
                onPress={() => choose({ brandId: null, name: query.toUpperCase() })}
                className="min-h-14 flex-row items-center gap-3 px-3">
                <Icon name="plus" size={20} colour="on-plain" />
                <SignText size="label" ink={TEXT_ON.plain}>{`New brand · ${query.toUpperCase()}`}</SignText>
              </PressablePlate>
            ) : null}
          </>
        )}

        <Field label="Part number" value={number} onChangeText={setNumber} autoCapitalize="characters" autoCorrect={false} placeholder="As printed on the box" />

        {outcome?.kind === 'confirm-brand' ? (
          <Plate tone="warning" className="gap-3 p-3">
            <Detail ink={TEXT_ON.warning}>{outcome.message}</Detail>
            <Button
              label={`Yes, ${brandText.trim().toUpperCase()} is new`}
              busy={adding.busy}
              compact
              onPress={() => void adding.submit({ brandId: null, name: brandText.trim().toUpperCase() }, number, true)}
            />
          </Plate>
        ) : null}
        {outcome?.kind === 'error' ? <StatusStrip tone="stop" icon="stop" text={outcome.message} /> : null}
      </ScrollView>
      <ActionBar
        label={adding.online ? 'Add part' : 'Save to add later'}
        icon="add"
        tone="plain"
        busy={adding.busy}
        disabled={!chosenBrand || !number.trim()}
        onPress={() => chosenBrand && void adding.submit(chosenBrand, number)}
      />
    </KeyboardAvoidingView>
  );
}
