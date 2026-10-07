import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { useQuickAdd, type BrandChoice } from '@/features/quick-add/use-quick-add';
import { useDebounced } from '@/lib/use-debounced';
import { useRemote } from '@/lib/use-remote';
import { supabase } from '@/lib/supabase';
import { Button } from '@/ui/button';
import { cx } from '@/ui/cx';
import { Icon } from '@/ui/icon';
import { Panel } from '@/ui/panel';
import { useColour } from '@/ui/theme';
import { brandOptions } from '@/vendor/partslogic/shared/add-part';
import { barcodeProblem, looksLikeBarcode } from '@/vendor/partslogic/shared/gtin';

const FIELD = 'h-12 rounded-xl border border-hairline bg-paper px-4 text-base text-ink focus:border-focus';

// Sheet for adding the part behind an unknown code: brand and part number, and the code is kept on it.
export default function QuickAdd() {
  const { code: rawCode } = useLocalSearchParams<{ code: string }>();
  const code = (rawCode ?? '').trim();
  const colourOf = useColour();
  const adding = useQuickAdd(code);

  const [brandText, setBrandText] = useState('');
  const [brand, setBrand] = useState<BrandChoice | null>(null);
  const [number, setNumber] = useState('');

  const query = useDebounced(brandText.trim(), 250);
  const brands = useRemote(adding.online && !brand ? `brands:${query}` : null, () =>
    brandOptions(supabase, query || null, 8),
  );
  const exact = brands.data?.some((option) => option.name.toLowerCase() === query.toLowerCase()) ?? false;
  const problem = looksLikeBarcode(code) ? barcodeProblem(code) : null;
  const outcome = adding.outcome;

  const choose = (choice: BrandChoice) => {
    setBrand(choice);
    setBrandText(choice.name);
    adding.reset();
  };

  if (outcome && (outcome.kind === 'added' || outcome.kind === 'queued' || outcome.kind === 'conflict')) {
    return (
      <ScrollView contentContainerClassName="gap-4 px-4 pb-10 pt-6">
        <Panel
          icon={outcome.kind === 'conflict' ? 'warning' : 'sent'}
          iconColour={outcome.kind === 'conflict' ? 'out' : 'tint'}
          title={outcome.kind === 'conflict' ? 'Not added' : outcome.kind === 'queued' ? 'Saved on this phone' : 'Part added'}
          body={outcome.message}>
          {outcome.kind === 'added' || (outcome.kind === 'conflict' && outcome.holderId) ? (
            <Button
              label="Open the part"
              onPress={() => {
                const id = outcome.kind === 'added' ? outcome.partId : outcome.holderId;
                router.back();
                router.navigate(`/lookup/part/${id}`);
              }}
            />
          ) : null}
          <Button label="Done" variant="secondary" onPress={() => router.back()} />
        </Panel>
      </ScrollView>
    );
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-5 px-4 pb-10 pt-6">
      <View className="gap-1 px-1">
        <Text accessibilityRole="header" className="text-xl font-semibold text-ink">
          Add a part
        </Text>
        <Text className="text-base leading-6 text-quiet-ink">
          For <Text className="font-semibold tabular-nums text-ink">{code}</Text>. The code is kept on the part so it
          scans next time, and scans waiting on it are booked.
        </Text>
        {problem ? <Text className="text-sm text-out">{problem}</Text> : null}
      </View>

      <View className="gap-1.5">
        <Text nativeID="brand-label" className="px-1 text-sm font-semibold text-ink">
          Brand
        </Text>
        <TextInput
          accessibilityLabelledBy="brand-label"
          accessibilityLabel="Brand"
          value={brandText}
          onChangeText={(text) => {
            setBrandText(text);
            setBrand(null);
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder={adding.online ? 'Search brands' : 'Brand name'}
          placeholderTextColor={colourOf('quiet-ink')}
          className={FIELD}
        />
        {brand ? (
          <View className="flex-row items-center gap-2 px-1">
            <Icon name="check" size={14} colour="tint" />
            <Text className="text-sm text-ink">
              {brand.brandId == null ? `New brand: ${brand.name}` : brand.name}
            </Text>
          </View>
        ) : null}
        {!adding.online ? (
          <Text className="px-1 text-sm text-quiet-ink">
            The brand list needs signal. A typed brand is checked when the part is sent.
          </Text>
        ) : null}
        {!brand && adding.online && (brands.data?.length || query) ? (
          <View className="overflow-hidden rounded-xl bg-paper">
            {(brands.data ?? []).slice(0, 6).map((option, index, shown) => (
              <Pressable
                key={option.brandId}
                accessibilityRole="button"
                accessibilityLabel={`${option.name}${option.alias ? `, also called ${option.alias}` : ''}`}
                onPress={() => choose({ brandId: option.brandId, name: option.name })}
                className={cx(
                  'min-h-12 flex-row items-center justify-between gap-3 px-4 py-2.5 active:bg-canvas',
                  (index < shown.length - 1 || (query && !exact)) && 'border-b border-hairline',
                )}>
                <View className="shrink">
                  <Text className="text-base text-ink">{option.name}</Text>
                  {option.alias ? <Text className="text-sm text-quiet-ink">Also called {option.alias}</Text> : null}
                </View>
                <Text className="text-sm tabular-nums text-quiet-ink">{option.parts} parts</Text>
              </Pressable>
            ))}
            {query && !exact ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => choose({ brandId: null, name: query.toUpperCase() })}
                className="min-h-12 justify-center px-4 py-2.5 active:bg-canvas">
                <Text className="text-base text-tint">Use “{query.toUpperCase()}” as a new brand</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      <View className="gap-1.5">
        <Text nativeID="number-label" className="px-1 text-sm font-semibold text-ink">
          Part number
        </Text>
        <TextInput
          accessibilityLabelledBy="number-label"
          accessibilityLabel="Part number"
          value={number}
          onChangeText={setNumber}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="As printed on the box"
          placeholderTextColor={colourOf('quiet-ink')}
          className={FIELD}
        />
      </View>

      {outcome?.kind === 'confirm-brand' ? (
        <Panel icon="warning" title="Check the brand" body={outcome.message}>
          <Button
            label={`Yes, ${brandText.trim().toUpperCase()} is a new brand`}
            busy={adding.busy}
            onPress={() => void adding.submit({ brandId: null, name: brandText.trim().toUpperCase() }, number, true)}
          />
        </Panel>
      ) : null}
      {outcome?.kind === 'error' ? <Text accessibilityRole="alert" className="px-1 text-base text-out">{outcome.message}</Text> : null}

      <Button
        label={adding.online ? 'Add part' : 'Save to add later'}
        busy={adding.busy}
        disabled={!code || !(brand ?? brandText.trim()) || !number.trim()}
        onPress={() => void adding.submit(brand ?? { brandId: null, name: brandText.trim().toUpperCase() }, number)}
      />
    </ScrollView>
  );
}
