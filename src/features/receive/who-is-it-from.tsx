import { useState } from 'react';
import { View } from 'react-native';

import { clock } from '@/lib/format';
import { ActionBar } from '@/ui/action-bar';
import { KeyboardScreen } from '@/ui/keyboard-screen';
import { Scroll } from '@/ui/scroll';
import { Button } from '@/ui/button';
import { Choice } from '@/ui/choice';
import { Field } from '@/ui/field';
import { SearchInput } from '@/ui/search-input';
import { Segmented } from '@/ui/segmented';
import { StatusStrip } from '@/ui/status-strip';
import { Txt } from '@/ui/text';
import { PlaceholderRows } from '@/ui/placeholder';

import { cleanReference, REFERENCE_MAX, SENDER_KINDS, type Sender } from './sender';
import type { SenderOption } from './sender-options';
import { useSenders } from './use-senders';

type ListState = { options: SenderOption[]; loading: boolean; failed: boolean; savedAt: string | null; reload: () => void };

// The first step of Receive goods: who the delivery is from (required), and its delivery note if there
// is one. The button names the choice, so a wrong pick is obvious before the first scan.
export function WhoIsItFrom({ onStart }: { onStart: (sender: Sender, reference: string | null) => void }) {
  const [kind, setKind] = useState<Sender['kind']>('supplier');
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<Sender | null>(null);
  const [reference, setReference] = useState('');
  const senders = useSenders(kind, query);

  return (
    <WhoIsItFromView
      kind={kind}
      query={query}
      list={senders}
      chosen={chosen}
      reference={reference}
      onKind={(next) => {
        setKind(next);
        setQuery('');
      }}
      onQuery={setQuery}
      onChoose={setChosen}
      onReference={setReference}
      onStart={() => {
        if (!chosen) return;
        void senders.remember(chosen);
        onStart(chosen, cleanReference(reference));
      }}
    />
  );
}

export function WhoIsItFromView({
  kind,
  query,
  list,
  chosen,
  reference,
  onKind,
  onQuery,
  onChoose,
  onReference,
  onStart,
}: {
  kind: Sender['kind'];
  query: string;
  list: ListState;
  chosen: Sender | null;
  reference: string;
  onKind: (kind: Sender['kind']) => void;
  onQuery: (text: string) => void;
  onChoose: (sender: Sender) => void;
  onReference: (text: string) => void;
  onStart: () => void;
}) {
  const isChosen = (option: SenderOption) => chosen?.kind === option.kind && chosen.id === option.id;
  const noun = kind === 'supplier' ? 'suppliers' : 'manufacturers';

  return (
    <KeyboardScreen>
      <Scroll toEdge={false} contentContainerClassName="gap-3 px-4 pt-4">
        <Txt accessibilityRole="header" variant="headline" className="font-extrabold">
          Who’s it from?
        </Txt>
        <Segmented options={SENDER_KINDS.map((option) => ({ value: option.kind, label: option.label }))} value={kind} onChange={onKind} />
        <SearchInput placeholder={`Search ${noun}`} value={query} onChangeText={onQuery} autoCapitalize={kind === 'supplier' ? 'words' : 'characters'} />

        {list.savedAt ? <StatusStrip tone="warn" icon="offline" text={`No signal · list saved ${clock(list.savedAt)}`} /> : null}
        {list.failed && list.options.length === 0 ? (
          <>
            <StatusStrip tone="stop" icon="offline" text={kind === 'supplier' ? 'Suppliers didn’t load' : 'Search needs signal'} />
            <Button label="Try again" icon="retry" variant="tinted" onPress={list.reload} />
          </>
        ) : null}
        {list.loading && list.options.length === 0 ? <PlaceholderRows label="Loading" /> : null}
        {!list.loading && !list.failed && list.options.length === 0 ? (
          <Txt variant="caption" className="px-1">
            {query.trim() ? `No ${noun} match “${query.trim()}”` : `No ${noun} yet · the office adds them in PartsLogic`}
          </Txt>
        ) : null}

        <View className="gap-2" accessibilityRole="radiogroup">
          {list.options.slice(0, 40).map((option) => (
            <Choice key={`${option.kind}:${option.id}`} title={option.name} detail={option.detail} selected={isChosen(option)} onPress={() => onChoose(option)} />
          ))}
        </View>

        <Field
          label="Delivery note (optional)"
          value={reference}
          onChangeText={onReference}
          maxLength={REFERENCE_MAX}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="DN number on the paperwork"
          returnKeyType="done"
        />
      </Scroll>
      <ActionBar
        label={chosen ? `Start delivery · ${chosen.name}` : 'Choose who it’s from'}
        icon={chosen ? 'receive' : undefined}
        disabled={!chosen}
        onPress={onStart}
      />
    </KeyboardScreen>
  );
}
