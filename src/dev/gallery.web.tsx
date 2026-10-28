import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import Account from '@/app/account';
import LocationSheet from '@/app/location';
import NoAccess from '@/app/no-access';
import SignIn from '@/app/sign-in';
import Sync from '@/app/sync';
import { BoardView } from '@/features/board/board-view';
import { partAnswer } from '@/features/lookup/answer';
import { PartAnswerCard } from '@/features/lookup/part-answer-card';
import { PartRow } from '@/features/part/part-row';
import { PartView } from '@/features/part/part-view';
import { AddPartLink } from '@/features/quick-add/add-part-link';
import { AddForm } from '@/features/quick-add/add-part-screens';
import { CountReceipt } from '@/features/count/count-receipt';
import { WhichBinView } from '@/features/count/which-bin';
import { countSummary } from '@/features/count/result-text';
import { statusText } from '@/features/receive/status-text';
import { DeliveryReceipt } from '@/features/receive/delivery-receipt';
import type { Sender } from '@/features/receive/sender';
import type { SenderOption } from '@/features/receive/sender-options';
import { WhoIsItFromView } from '@/features/receive/who-is-it-from';
import { NotSetUp } from '@/features/setup/not-set-up';
import { syncState } from '@/features/board/sync-state';
import { ActionBar } from '@/ui/action-bar';
import { BinChip } from '@/ui/bin-chip';
import { Button } from '@/ui/button';
import { ConfirmScanCard } from '@/ui/confirm-scan-card';
import { ConfirmSheet } from '@/ui/confirm-sheet';
import { Icon } from '@/ui/icon';
import { JobBanner } from '@/ui/job-banner';
import { JobScreen } from '@/ui/job-screen';
import { LineRow } from '@/ui/line-row';
import { Quantity } from '@/ui/quantity';
import { themeVars, type Tone } from '@/ui/palette';
import { Card, PressableCard, TEXT_ON } from '@/ui/surface';
import { ScanResultCard } from '@/ui/scan-result-card';
import { SectionLabel } from '@/ui/section-label';
import { Txt } from '@/ui/text';
import { Tally } from '@/ui/tally';
import { useScheme } from '@/ui/theme';
import type { PendingScan } from '@/scan/pending-scan';
import type { ScanCheck } from '@/scan/resolve';
import { boardFor } from '@/workflows/catalogue';

import { Fixtures, OIL_FILTER, OUTBOX_ITEMS, RECENT } from './fixtures';

// Dev-only: every screen of the redesign drawn from fixture data, so it can be captured in a browser at
// phone size for review (?screen=board). Light or dark follows the browser's colour scheme. The native
// header is drawn by StackHeader below, a stand-in for the platform's own.

const noop = () => {};
const startedAt = new Date(new Date().setHours(9, 14, 0, 0)).toISOString();

function StackHeader({ title, quickLookUp = true }: { title: string; quickLookUp?: boolean }) {
  return (
    <View className="h-14 flex-row items-center gap-3 bg-ground px-3">
      <Icon name="back" size={24} />
      <Txt variant="title" className="flex-1">
        {title}
      </Txt>
      {quickLookUp ? (
        <PressableCard accessibilityLabel="Look up a part" onPress={noop} className="h-11 w-11 items-center justify-center">
          <Icon name="lookup" size={22} />
        </PressableCard>
      ) : null}
    </View>
  );
}

// A scan Receive is holding for a decision, as the gallery shows it.
const HELD_PART: PendingScan<ScanCheck> = {
  key: 'p',
  code: '4047025186913',
  qty: 1,
  hit: { type: 'part', partId: 1, brand: 'Bosch', number: '0 986 494 119', offline: false },
};
const HELD_UNKNOWN: PendingScan<ScanCheck> = { key: 'u', code: '5010415305187', qty: 2, hit: { type: 'unknown', code: '5010415305187', offline: false } };

function SampleJob({ confirming = false, held }: { confirming?: boolean; held?: PendingScan<ScanCheck> }) {
  const lines = [
    { name: 'Bosch 0 986 494 119', code: '4047025186913', qty: 4, status: statusText('booked', null) },
    { name: '5010415305187', code: null, qty: 1, status: statusText('unknown', null), unknown: true },
    { name: 'Mann HU 816 x', code: '4011558726304', qty: 6, status: statusText('waiting', null) },
  ];
  return (
    <View className="flex-1">
      <StackHeader title="Receive goods" />
      <JobScreen
        placeholder="Barcode or part number"
        onScan={noop}
        scanEnabled={!held}
        banner={<JobBanner size="headline" title="BGA" detail="GR-0042 · DN 448210 · into Main Unbinned" />}
        result={
          held ? (
            <ConfirmScanCard
              pending={held}
              verb="Add"
              onConfirm={noop}
              onSkip={noop}
              onStep={noop}
              onSet={noop}
              onRetry={noop}
              addPart={<AddPartLink code={held.code} />}
            />
          ) : (
            <ScanResultCard
              tone="ok"
              status={{ icon: 'sent', label: 'Added' }}
              title="Bosch 0 986 494 119"
              detail="4047025186913"
              quantity={{ value: '+1', label: '4 in delivery' }}
            />
          )
        }
        action={
          held ? null : <ActionBar label="Finish · 24 units" icon="check" onPress={noop} secondary={{ label: 'Undo', icon: 'undo', onPress: noop }} />
        }>
        <Tally
          items={[
            { value: 24, label: 'Units' },
            { value: 7, label: 'Codes' },
            { value: 1, label: 'To check', tone: 'warn' },
          ]}
        />
        {lines.map((line) => (
          <LineRow
            key={line.name}
            name={line.name}
            code={line.code}
            status={line.status}
            quantity={<Quantity total={line.qty} name={line.name} onStep={noop} onSet={noop} />}>
            {line.unknown ? <AddPartLink code={line.name} /> : null}
          </LineRow>
        ))}
      </JobScreen>
      <ConfirmSheet
        visible={confirming}
        title="Finish delivery?"
        facts={[
          { value: 24, label: 'Units' },
          { value: 7, label: 'Codes' },
        ]}
        note="1 unknown code stays for the office to match."
        confirm={{ label: 'Finish · 24 units', onPress: noop }}
        cancelLabel="Keep scanning"
        onCancel={noop}
      />
    </View>
  );
}

function Parts() {
  const tones: Tone[] = ['action', 'ok', 'warn', 'stop', 'neutral'];
  return (
    <ScrollView className="flex-1 bg-ground" contentContainerClassName="gap-4 p-3">
      <View className="flex-row flex-wrap gap-2">
        {tones.map((tone) => (
          <Card key={tone} tone={tone} className="px-3 py-2">
            <Txt variant="label" ink={TEXT_ON[tone]}>
              {tone}
            </Txt>
          </Card>
        ))}
      </View>
      <Button label="Start delivery" icon="receive" onPress={noop} />
      <Button label="Keep scanning" variant="secondary" onPress={noop} />
      <Button label="Discard count" variant="destructive" onPress={noop} />
      <Button label="Sending" busy onPress={noop} />
      <Button label="Not available" disabled onPress={noop} />
      <View className="flex-row flex-wrap gap-2">
        <BinChip code="A-01" qty={4} onPress={noop} />
        <BinChip code="B-12" qty={2} selected onPress={noop} />
        <BinChip code="Unbinned" qty={6} />
      </View>
      <ScanResultCard tone="neutral" status={{ icon: 'check', label: 'In stock' }} title="Mann HU 816 x" detail="Oil filter" quantity={{ value: '12', label: 'On hand' }} onPress={noop}>
        <View className="flex-row flex-wrap gap-2">
          <BinChip code="A-01" qty={8} />
          <BinChip code="C-03" qty={4} />
        </View>
      </ScanResultCard>
      <ScanResultCard tone="warn" status={{ icon: 'warning', label: 'Unknown code' }} title="5010415305187" detail="Not in PartsLogic yet">
        <Button label="Add part" icon="add" compact onPress={noop} />
      </ScanResultCard>
      <ScanResultCard tone="stop" status={{ icon: 'stop', label: 'Out of stock' }} title="Febi 12345" quantity={{ value: '0', label: 'On hand' }} />
    </ScrollView>
  );
}

const SUPPLIERS: SenderOption[] = ['APEC', 'BGA', 'Euro Car Parts', 'FPS'].map((name, index) => ({ kind: 'supplier', id: index + 1, name, detail: null }));
const MAKERS: SenderOption[] = [
  { kind: 'manufacturer', id: 11, name: 'BOSCH', detail: null },
  { kind: 'manufacturer', id: 12, name: 'MANN-FILTER', detail: 'Also MANN' },
  { kind: 'manufacturer', id: 13, name: 'NGK', detail: null },
];

function WhoScreen({ kind, chosen, reference, savedAt = null }: { kind: Sender['kind']; chosen: Sender | null; reference: string; savedAt?: string | null }) {
  return (
    <View className="flex-1">
      <StackHeader title="Receive goods" />
      <WhoIsItFromView
        kind={kind}
        query=""
        list={{ options: kind === 'supplier' ? SUPPLIERS : MAKERS, loading: false, failed: false, savedAt, reload: noop }}
        chosen={chosen}
        reference={reference}
        onKind={noop}
        onQuery={noop}
        onChoose={noop}
        onReference={noop}
        onStart={noop}
      />
    </View>
  );
}

// Bins for the Which bin? screens: two counted, two never.
const binList = (savedAt: string | null = null) => ({
  choices: [
    { binId: 1, code: 'A-01', description: null, units: 18, lastCounted: '2026-10-03T10:00:00Z' },
    { binId: 2, code: 'A-02', description: null, units: 9, lastCounted: null },
    { binId: 3, code: 'B-01', description: 'Top shelf', units: 31, lastCounted: '2026-10-09T10:00:00Z' },
    { binId: 4, code: 'B-02', description: null, units: 0, lastCounted: null },
  ],
  loading: false,
  failed: false,
  savedAt,
  reload: noop,
});

const SCREENS: Record<string, () => ReactNode> = {
  board: () => (
    <BoardView
      sections={boardFor('counter')}
      openWork={[{ kind: 'delivery', from: 'BGA', units: 12, startedAt }]}
      location="Main"
      sync={syncState({ waiting: 3, needsAttention: 0, online: true })}
      onJob={noop}
      onResume={noop}
      onLocation={noop}
      onSync={noop}
      onAccount={noop}
    />
  ),
  'board-problem': () => (
    <BoardView
      sections={boardFor('counter')}
      openWork={[
        { kind: 'delivery', from: 'BGA', units: 12, startedAt },
        { kind: 'count', bin: 'A-01', units: 7, startedAt },
      ]}
      location="Main"
      sync={syncState({ waiting: 2, needsAttention: 1, online: true })}
      onJob={noop}
      onResume={noop}
      onLocation={noop}
      onSync={noop}
      onAccount={noop}
    />
  ),
  'board-viewer': () => (
    <BoardView
      sections={boardFor('viewer')}
      openWork={[]}
      location="Main"
      sync={syncState({ waiting: 0, needsAttention: 0, online: true })}
      onJob={noop}
      onResume={noop}
      onLocation={noop}
      onSync={noop}
      onAccount={noop}
    />
  ),
  job: () => <SampleJob />,
  'receive-held': () => <SampleJob held={HELD_PART} />,
  'receive-held-unknown': () => <SampleJob held={HELD_UNKNOWN} />,
  'count-start': () => (
    <View className="flex-1">
      <StackHeader title="Put away" />
      <WhichBinView list={binList()} waiting={{ units: 24, location: 'Main' }} online onChoose={noop} onCreate={noop} />
    </View>
  ),
  'count-start-stock': () => (
    <View className="flex-1">
      <StackHeader title="Stock count" />
      <WhichBinView list={binList(startedAt)} waiting={null} online={false} onChoose={noop} onCreate={noop} />
    </View>
  ),
  count: () => (
    <View className="flex-1">
      <StackHeader title="Stock count" />
      <JobScreen
        placeholder="Barcode or part number"
        onScan={noop}
        banner={<JobBanner size="headline" title="Bin A-01" detail="MAIN · Blind count" />}
        result={<ScanResultCard tone="ok" status={{ icon: 'sent', label: 'Counted' }} title="Mann HU 816 x" detail="4011558726304" quantity={{ value: '6', label: 'Counted' }} />}
        action={<ActionBar label="Finish · 9 units" icon="check" onPress={noop} secondary={{ label: 'Discard', icon: 'close', onPress: noop }} />}>
        <Tally
          items={[
            { value: 9, label: 'Units' },
            { value: 2, label: 'Parts' },
          ]}
        />
        <LineRow name="Mann HU 816 x" code="4011558726304" quantity={<Quantity total={6} name="Mann HU 816 x" onStep={noop} onSet={noop} />} />
        <LineRow name="NGK BKR6E" code="087295104401" quantity={<Quantity total={3} name="NGK BKR6E" onStep={noop} onSet={noop} />} />
      </JobScreen>
    </View>
  ),
  'count-result': () => {
    const summary = countSummary({
      stage: 'done',
      result: { stocktakeId: 'S', status: 'posted', duplicate: false, partial: false, needsReview: false, putAway: 6, returned: 1, found: 2, unresolved: 0 },
    });
    return (
      <View className="flex-1 bg-ground">
        <StackHeader title="Put away" />
        <ScrollView contentContainerClassName="flex-grow justify-center gap-4 px-4 py-8">
          <CountReceipt binCode="A-01" summary={summary} units={9} />
          <Button label="Count next bin" icon="count" onPress={noop} />
          <Button label="Board" variant="secondary" onPress={noop} />
        </ScrollView>
      </View>
    );
  },
  move: () => (
    <View className="flex-1">
      <StackHeader title="Transfer stock" />
      <JobScreen
        placeholder="Part number, barcode or bin"
        onScan={noop}
        banner={<JobBanner title="Mann HU 816 x" detail="From A-01" />}
        result={<ScanResultCard tone="ok" status={{ icon: 'sent', label: 'Bin scanned' }} title="B-12" />}
        action={<ActionBar label="Move 4 · A-01 → B-12" icon="move" onPress={noop} />}>
        <SectionLabel>From</SectionLabel>
        <View className="flex-row flex-wrap gap-2">
          <BinChip code="A-01" qty={8} selected onPress={noop} />
          <BinChip code="C-03" qty={4} onPress={noop} />
        </View>
        <SectionLabel>To</SectionLabel>
        <View className="flex-row flex-wrap gap-2">
          <BinChip code="B-12" selected onPress={noop} />
        </View>
        <SectionLabel>How many</SectionLabel>
        <Card className="flex-row items-center justify-between gap-3 px-3 py-2">
          <Quantity total={4} name="Mann HU 816 x" onStep={noop} onSet={noop} />
          <Button label="All 8" variant="secondary" compact onPress={noop} />
        </Card>
      </JobScreen>
    </View>
  ),
  add: () => (
    <Fixtures>
      <View className="flex-1">
        <StackHeader title="Add part" quickLookUp={false} />
        <AddForm code="5010415305187" />
      </View>
    </Fixtures>
  ),
  'receive-who': () => <WhoScreen kind="supplier" chosen={SUPPLIERS[1]} reference="DN 448210" />,
  'receive-who-maker': () => <WhoScreen kind="manufacturer" chosen={null} reference="" />,
  'receive-who-offline': () => <WhoScreen kind="supplier" chosen={null} reference="" savedAt={startedAt} />,
  'receive-done': () => (
    <View className="flex-1 bg-ground">
      <StackHeader title="Receive goods" />
      <DeliveryReceipt
        delivery={{
          documentId: 'R1',
          userId: 'u',
          locationId: 1,
          locationName: 'Main',
          sender: SUPPLIERS[1],
          reference: 'DN 448210',
          startedAt,
          finishedAt: '2026-10-08T09:31:00.000Z',
        }}
        number="GR-0042"
        units={24}
        summary={{ state: 'booked', codes: 7, unknown: 1 }}
        onPutAway={noop}
        onNext={noop}
      />
    </View>
  ),
  confirm: () => <SampleJob confirming />,
  parts: () => <Parts />,
  lookup: () => (
    <View className="flex-1">
      <StackHeader title="Look up" quickLookUp={false} />
      <JobScreen
        placeholder="Part number or barcode"
        onScan={noop}
        scanEnabled={false}
        result={<PartAnswerCard title="Mann HU 816 x" answer={partAnswer(OIL_FILTER, 'GBP')} savedAt={null} onOpen={noop} />}
        onResume={noop}
        action={<ActionBar label="Open part" icon="forward" onPress={noop} />}>
        <SectionLabel>Recent</SectionLabel>
        {RECENT.map((part) => (
          <PartRow key={part.partId} {...part} onPress={noop} />
        ))}
      </JobScreen>
    </View>
  ),
  'lookup-unknown': () => (
    <View className="flex-1">
      <StackHeader title="Look up" quickLookUp={false} />
      <JobScreen
        placeholder="Part number or barcode"
        onScan={noop}
        result={
          <ScanResultCard tone="warn" status={{ icon: 'warning', label: 'Unknown code' }} title="5010415305187">
            <Button label="Search instead" icon="lookup" variant="secondary" compact onPress={noop} />
          </ScanResultCard>
        }
        scanEnabled={false}
        onResume={noop}
        action={<ActionBar label="Add part" icon="add" tone="neutral" onPress={noop} />}>
        <SectionLabel>Recent</SectionLabel>
        {RECENT.map((part) => (
          <PartRow key={part.partId} {...part} onPress={noop} />
        ))}
      </JobScreen>
    </View>
  ),
  part: () => (
    <Fixtures>
      <View className="flex-1">
        <StackHeader title="Part" />
        <PartView detail={OIL_FILTER} savedAt={null} />
      </View>
    </Fixtures>
  ),
  sync: () => (
    <Fixtures waiting={1} needsAttention={1} items={OUTBOX_ITEMS}>
      <View className="flex-1">
        <StackHeader title="Sync" quickLookUp={false} />
        <Sync />
      </View>
    </Fixtures>
  ),
  'sync-clear': () => (
    <Fixtures items={OUTBOX_ITEMS.filter((item) => item.status === 'done')}>
      <View className="flex-1">
        <StackHeader title="Sync" quickLookUp={false} />
        <Sync />
      </View>
    </Fixtures>
  ),
  'sign-in': () => (
    <Fixtures session={{ status: 'signed-out' }}>
      <SignIn />
    </Fixtures>
  ),
  'no-access': () => (
    <Fixtures session={{ status: 'not-member', email: 'new.starter@example.com' }}>
      <NoAccess />
    </Fixtures>
  ),
  'not-set-up': () => <NotSetUp problems={['EXPO_PUBLIC_SUPABASE_URL is not set']} />,
  location: () => (
    <Fixtures>
      <LocationSheet />
    </Fixtures>
  ),
  account: () => (
    <Fixtures waiting={2}>
      <Account />
    </Fixtures>
  ),
};

export function Gallery() {
  const scheme = useScheme();
  const [screen, setScreen] = useState(() => new URLSearchParams(window.location.search).get('screen'));
  const draw = screen ? SCREENS[screen] : undefined;

  return (
    <View style={themeVars(scheme)} className="flex-1 bg-ground">
      {draw ? (
        draw()
      ) : (
        <ScrollView contentContainerClassName="gap-2 p-4">
          {Object.keys(SCREENS).map((name) => (
            <Pressable key={name} onPress={() => setScreen(name)}>
              <Txt variant="title">{name}</Txt>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
