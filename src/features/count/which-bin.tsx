import { useState, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { clock, plural } from '@/lib/format';
import { Button } from '@/ui/button';
import { Field } from '@/ui/field';
import { Icon } from '@/ui/icon';
import { KeyboardScreen } from '@/ui/keyboard-screen';
import { Scroll } from '@/ui/scroll';
import { SearchInput } from '@/ui/search-input';
import { StatusChip } from '@/ui/status-chip';
import { StatusStrip } from '@/ui/status-strip';
import { Card, PressableCard } from '@/ui/surface';
import { Txt } from '@/ui/text';
import { useColour } from '@/ui/theme';

import { countedText, exactBin, filterBins, type BinChoice } from './bin-choices';

type BinList = { choices: BinChoice[]; loading: boolean; failed: boolean; savedAt: string | null; reload: () => void };

// What's waiting in the location's Unbinned bin, shown at the top of Put away.
export type Waiting = { units: number; location: string } | null;

// The first step of Put away and Stock count: which bin. Bins carry a name on the shelf, not a barcode,
// so it's picked from the list (search or tap) rather than scanned. Choosing one locks it in.
export function WhichBinView({
  list,
  waiting,
  online,
  onChoose,
  onCreate,
  onWaiting,
  notice,
  footer,
}: {
  list: BinList;
  waiting: Waiting;
  online: boolean;
  onChoose: (bin: BinChoice) => void;
  // Opens what's waiting in Unbinned, part by part.
  onWaiting?: () => void;
  // Makes a bin with this name in the location and starts counting it (needs signal).
  onCreate: (code: string) => void;
  // An answer to the last choice (checking, a bin that couldn't be made), under the search box.
  notice?: ReactNode;
  // What else belongs under the list: counts finished on this phone.
  footer?: ReactNode;
}) {
  const colourOf = useColour();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [newCode, setNewCode] = useState('');
  const shown = filterBins(list.choices, query);
  const typed = query.trim().toUpperCase();

  return (
    <KeyboardScreen>
      <Scroll contentContainerClassName="gap-3 px-4 pt-4">
        <Txt accessibilityRole="header" variant="headline" className="font-extrabold">
          Which bin?
        </Txt>
        <SearchInput
          placeholder="Bin name"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="characters"
          onSubmitEditing={() => {
            const bin = exactBin(list.choices, query);
            if (bin) onChoose(bin);
          }}
        />

        {notice}

        {waiting && waiting.units > 0 ? (
          <PressableCard
            accessibilityLabel={`${plural(waiting.units, 'unit', 'units')} waiting in ${waiting.location} Unbinned. See what's waiting`}
            onPress={onWaiting ?? (() => {})}
            disabled={!onWaiting}
            className="min-h-16 flex-row items-center gap-3 px-4 py-3">
            <View className="flex-1 gap-0.5">
              <Txt variant="label" numbers className="font-bold">
                {`${plural(waiting.units, 'unit', 'units')} waiting`}
              </Txt>
              <Txt variant="caption">{`In ${waiting.location} Unbinned`}</Txt>
            </View>
            <StatusChip tone="warn" icon="putAway" label="To put away" />
            {onWaiting ? <Icon name="forward" size={16} colour="quiet-ink" /> : null}
          </PressableCard>
        ) : null}

        {list.savedAt ? <StatusStrip tone="warn" icon="offline" text={`No signal · bins saved ${clock(list.savedAt)}`} /> : null}
        {list.failed && list.choices.length === 0 ? (
          <>
            <StatusStrip tone="stop" icon="offline" text="Bins didn’t load" />
            <Button label="Try again" icon="retry" variant="secondary" onPress={list.reload} />
          </>
        ) : null}
        {list.loading ? (
          <View className="py-4">
            <ActivityIndicator color={colourOf('quiet-ink')} />
          </View>
        ) : null}

        <View className="gap-2">
          {shown.slice(0, 60).map((bin) => (
            <PressableCard
              key={bin.binId}
              accessibilityLabel={`Bin ${bin.code}, ${countedText(bin.lastCounted)}`}
              onPress={() => onChoose(bin)}
              className="min-h-16 flex-row items-center gap-3 px-4 py-2.5">
              <View className="flex-1 gap-0.5">
                <Txt variant="title" numberOfLines={1} className="font-extrabold">
                  {bin.code}
                </Txt>
                <Txt variant="caption" numberOfLines={1}>
                  {[countedText(bin.lastCounted), bin.description].filter(Boolean).join(' · ')}
                </Txt>
              </View>
              <Icon name="forward" size={16} colour="quiet-ink" />
            </PressableCard>
          ))}
        </View>
        {!list.loading && typed !== '' && shown.length === 0 ? (
          <Txt variant="caption" className="px-1">{`No bin called ${typed} here`}</Txt>
        ) : null}

        {creating ? (
          <Card className="gap-3 p-4">
            <Field label="New bin name" value={newCode} onChangeText={setNewCode} autoFocus autoCapitalize="characters" autoCorrect={false} placeholder="As written on the shelf" />
            <Button
              label={newCode.trim() ? `Create bin ${newCode.trim().toUpperCase()}` : 'Type the bin name'}
              icon="plus"
              disabled={!online || newCode.trim() === ''}
              onPress={() => onCreate(newCode.trim().toUpperCase())}
            />
            {!online ? <StatusStrip tone="warn" icon="offline" text="Creating a bin needs signal" /> : null}
          </Card>
        ) : (
          <Button
            label={typed && shown.length === 0 ? `New bin ${typed}` : 'New bin'}
            icon="plus"
            variant="secondary"
            onPress={() => {
              setNewCode(shown.length === 0 ? typed : '');
              setCreating(true);
            }}
          />
        )}

        {footer}
      </Scroll>
    </KeyboardScreen>
  );
}
