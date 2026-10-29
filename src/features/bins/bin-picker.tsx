import { useState } from 'react';
import { ActivityIndicator, Modal, SectionList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { exactBin, type BinChoice } from '@/features/count/bin-choices';
import { clock, plural } from '@/lib/format';
import { Button } from '@/ui/button';
import { Icon } from '@/ui/icon';
import { KeyboardScreen } from '@/ui/keyboard-screen';
import { themeVars } from '@/ui/palette';
import { SearchInput } from '@/ui/search-input';
import { SectionLabel } from '@/ui/section-label';
import { StatusStrip } from '@/ui/status-strip';
import { PressableCard } from '@/ui/surface';
import { Txt } from '@/ui/text';
import { useColour, useScheme } from '@/ui/theme';

import { binSections } from './bin-sections';

type BinList = { choices: BinChoice[]; loading: boolean; failed: boolean; savedAt: string | null; reload: () => void };

// Every shelf bin in the working location to choose from, for a job that needs a bin and has no label to
// scan (or the name isn't known by heart): grouped by aisle while browsing, or search by name. Bins that
// already hold the part say how many. Full screen over the job; Close or Back keeps the job as it was.
export function BinPicker({
  visible,
  title,
  location,
  list,
  held,
  skip,
  onPick,
  onClose,
}: {
  visible: boolean;
  // "Move to which bin?"
  title: string;
  location: string;
  list: BinList;
  // How much of the part each bin already holds.
  held?: ReadonlyMap<number, number>;
  // Bins not to offer (the one the stock is leaving).
  skip?: ReadonlySet<number>;
  onPick: (bin: BinChoice) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const scheme = useScheme();
  const colourOf = useColour();
  const [query, setQuery] = useState('');
  const sections = binSections(list.choices, query, skip);
  const typed = query.trim().toUpperCase();
  const pick = (bin: BinChoice) => {
    setQuery('');
    onPick(bin);
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      {/* A modal draws outside the root view, so it sets the palette again for itself. */}
      <View style={[themeVars(scheme), { paddingTop: insets.top + 8 }]} className="flex-1 bg-ground">
        <KeyboardScreen topOffset={0}>
          <View className="gap-3 px-4 pb-3">
            <View className="flex-row items-center gap-3">
              <View className="flex-1 gap-0.5">
                <Txt accessibilityRole="header" variant="headline" className="font-extrabold">
                  {title}
                </Txt>
                <Txt variant="caption">{`${plural(list.choices.length, 'bin', 'bins')} in ${location}`}</Txt>
              </View>
              <PressableCard accessibilityLabel="Close" onPress={onClose} className="h-12 w-12 items-center justify-center rounded-[10px]">
                <Icon name="close" size={22} />
              </PressableCard>
            </View>
            <SearchInput
              placeholder="Bin name"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => {
                const bin = exactBin(list.choices, query);
                if (bin && !skip?.has(bin.binId)) pick(bin);
              }}
            />
            {list.savedAt ? <StatusStrip tone="warn" icon="offline" text={`No signal · bins saved ${clock(list.savedAt)}`} /> : null}
            {list.failed && list.choices.length === 0 ? (
              <>
                <StatusStrip tone="stop" icon="offline" text="Bins didn’t load" />
                <Button label="Try again" icon="retry" variant="secondary" onPress={list.reload} />
              </>
            ) : null}
          </View>

          <SectionList
            sections={sections}
            keyExtractor={(bin) => String(bin.binId)}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            stickySectionHeadersEnabled
            initialNumToRender={24}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24, gap: 8 }}
            renderSectionHeader={({ section }) =>
              section.title ? (
                <View className="bg-ground pb-1 pt-2">
                  <SectionLabel>{`${section.title} · ${plural(section.data.length, 'bin', 'bins')}`}</SectionLabel>
                </View>
              ) : null
            }
            renderItem={({ item: bin }) => {
              const here = held?.get(bin.binId) ?? 0;
              const detail = here > 0 ? `Has ${here} already` : bin.description;
              return (
                <PressableCard
                  accessibilityLabel={`Bin ${bin.code}${detail ? `, ${detail}` : ''}`}
                  onPress={() => pick(bin)}
                  className="min-h-14 flex-row items-center gap-3 px-4 py-2">
                  <View className="flex-1 gap-0.5">
                    <Txt variant="title" numberOfLines={1} className="font-extrabold">
                      {bin.code}
                    </Txt>
                    {detail ? (
                      <Txt variant="caption" numberOfLines={1} ink={here > 0 ? 'text-ok-ink' : 'text-quiet-ink'}>
                        {detail}
                      </Txt>
                    ) : null}
                  </View>
                  <Icon name="forward" size={16} colour="quiet-ink" />
                </PressableCard>
              );
            }}
            ListEmptyComponent={
              list.loading ? (
                <View className="py-6">
                  <ActivityIndicator color={colourOf('quiet-ink')} />
                </View>
              ) : typed ? (
                <Txt variant="caption" className="px-1">{`No bin called ${typed} here`}</Txt>
              ) : null
            }
          />
        </KeyboardScreen>
      </View>
    </Modal>
  );
}
