import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import Account from '@/app/account';
import LocationSheet from '@/app/location';
import NoAccess from '@/app/no-access';
import SignIn from '@/app/sign-in';
import Sync from '@/app/sync';
import { BoardView } from '@/features/board/board-view';
import { partAnswer } from '@/features/lookup/answer';
import { PartAnswerPlate } from '@/features/lookup/part-answer-plate';
import { PartRow } from '@/features/part/part-row';
import { PartView } from '@/features/part/part-view';
import { AddPartLink } from '@/features/quick-add/add-part-link';
import { AddForm } from '@/features/quick-add/add-part-screens';
import { countSummary } from '@/features/count/result-text';
import { statusText } from '@/features/receive/status-text';
import { NotSetUp } from '@/features/setup/not-set-up';
import { jobsFor } from '@/features/board/jobs';
import { syncState } from '@/features/board/sync-state';
import { ActionBar } from '@/ui/action-bar';
import { BinChip } from '@/ui/bin-chip';
import { Button } from '@/ui/button';
import { ConfirmSheet } from '@/ui/confirm-sheet';
import { Icon } from '@/ui/icon';
import { JobBanner } from '@/ui/job-banner';
import { JobScreen } from '@/ui/job-screen';
import { LineRow } from '@/ui/line-row';
import { Notice } from '@/ui/notice';
import { Quantity } from '@/ui/quantity';
import { themeVars, type Tone } from '@/ui/palette';
import { Plate, PressablePlate, TEXT_ON } from '@/ui/plate';
import { ScanResultCard } from '@/ui/scan-result-card';
import { SectionLabel } from '@/ui/section-label';
import { SignText } from '@/ui/sign-text';
import { Tally } from '@/ui/tally';
import { useScheme } from '@/ui/theme';

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
      <SignText size="title" weight="heavy" className="flex-1">
        {title}
      </SignText>
      {quickLookUp ? (
        <PressablePlate accessibilityLabel="Look up a part" onPress={noop} className="h-11 w-11 items-center justify-center">
          <Icon name="lookup" size={22} />
        </PressablePlate>
      ) : null}
    </View>
  );
}

function SampleJob({ confirming = false }: { confirming?: boolean }) {
  const lines = [
    { name: 'Bosch 0 986 494 119', code: '4047025186913', qty: 4, status: statusText('booked', null) },
    { name: '5010415305187', code: null, qty: 1, status: statusText('unknown', null), unknown: true },
    { name: 'Mann HU 816 x', code: '4011558726304', qty: 6, status: statusText('waiting', null) },
  ];
  return (
    <View className="flex-1">
      <StackHeader title="Receive" />
      <JobScreen
        placeholder="Barcode or part number"
        onScan={noop}
        banner={<JobBanner title="GR-0042" detail="Into Main Unbinned" />}
        result={
          <ScanResultCard
            tone="safe"
            status={{ icon: 'sent', label: 'Added' }}
            title="Bosch 0 986 494 119"
            detail="4047025186913"
            quantity={{ value: '+1', label: '4 in delivery' }}
          />
        }
        action={<ActionBar label="Finish · 24 units" icon="check" onPress={noop} secondary={{ label: 'Undo', icon: 'undo', onPress: noop }} />}>
        <Tally
          items={[
            { value: 24, label: 'Units' },
            { value: 7, label: 'Codes' },
            { value: 1, label: 'To check', tone: 'warning' },
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
  const tones: Tone[] = ['mandatory', 'safe', 'warning', 'stop', 'plain', 'surface'];
  return (
    <ScrollView className="flex-1 bg-ground" contentContainerClassName="gap-4 p-3">
      <View className="flex-row flex-wrap gap-2">
        {tones.map((tone) => (
          <Plate key={tone} tone={tone} className="px-3 py-2">
            <SignText size="label" weight="heavy" ink={TEXT_ON[tone]}>
              {tone}
            </SignText>
          </Plate>
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
      <ScanResultCard tone="surface" status={{ icon: 'check', label: 'In stock' }} title="Mann HU 816 x" detail="Oil filter" quantity={{ value: '12', label: 'On hand' }} onPress={noop}>
        <View className="flex-row flex-wrap gap-2">
          <BinChip code="A-01" qty={8} />
          <BinChip code="C-03" qty={4} />
        </View>
      </ScanResultCard>
      <ScanResultCard tone="warning" status={{ icon: 'warning', label: 'Unknown code' }} title="5010415305187" detail="Not in PartsLogic yet">
        <Button label="Add part" icon="add" compact onPress={noop} />
      </ScanResultCard>
      <ScanResultCard tone="stop" status={{ icon: 'stop', label: 'Out of stock' }} title="Febi 12345" quantity={{ value: '0', label: 'On hand' }} />
    </ScrollView>
  );
}

const SCREENS: Record<string, () => ReactNode> = {
  board: () => (
    <BoardView
      jobs={jobsFor('counter')}
      openWork={[{ kind: 'delivery', units: 12, startedAt }]}
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
      jobs={jobsFor('counter')}
      openWork={[
        { kind: 'delivery', units: 12, startedAt },
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
      jobs={jobsFor('viewer')}
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
  count: () => (
    <View className="flex-1">
      <StackHeader title="Put away & count" />
      <JobScreen
        placeholder="Barcode or part number"
        onScan={noop}
        banner={<JobBanner size="display" title="Bin A-01" detail="MAIN · Blind count" />}
        result={<ScanResultCard tone="safe" status={{ icon: 'sent', label: 'Counted' }} title="Mann HU 816 x" detail="4011558726304" quantity={{ value: '6', label: 'Counted' }} />}
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
        <StackHeader title="Put away & count" />
        <ScrollView contentContainerClassName="flex-grow justify-center gap-4 px-4 py-8">
          <Plate tone={summary.tone} heavy className="gap-2 p-4">
            <SignText size="label" ink={TEXT_ON[summary.tone]}>
              {summary.label}
            </SignText>
            <SignText size="hero" weight="heavy" ink={TEXT_ON[summary.tone]}>
              Bin A-01
            </SignText>
          </Plate>
          <Tally items={summary.items} />
          <Button label="Count next bin" icon="count" onPress={noop} />
          <Button label="Board" variant="secondary" onPress={noop} />
        </ScrollView>
      </View>
    );
  },
  move: () => (
    <View className="flex-1">
      <StackHeader title="Move stock" />
      <JobScreen
        placeholder="Part number, barcode or bin"
        onScan={noop}
        banner={<JobBanner title="Mann HU 816 x" detail="From A-01" />}
        result={<ScanResultCard tone="safe" status={{ icon: 'sent', label: 'Bin scanned' }} title="B-12" />}
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
        <Plate className="flex-row items-center justify-between gap-3 px-3 py-2">
          <Quantity total={4} name="Mann HU 816 x" onStep={noop} onSet={noop} />
          <Button label="All 8" variant="secondary" compact onPress={noop} />
        </Plate>
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
  'receive-done': () => (
    <View className="flex-1 bg-ground">
      <StackHeader title="Receive" />
      <Notice icon="sent" tone="safe" title="GR-0042" line="24 units into Main Unbinned">
        <Button label="Put away now" icon="count" onPress={noop} />
        <Button label="Next delivery" variant="secondary" onPress={noop} />
      </Notice>
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
        result={<PartAnswerPlate title="Mann HU 816 x" answer={partAnswer(OIL_FILTER, 'GBP')} savedAt={null} onOpen={noop} />}
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
          <ScanResultCard tone="warning" status={{ icon: 'warning', label: 'Unknown code' }} title="5010415305187">
            <Button label="Search instead" icon="lookup" variant="secondary" compact onPress={noop} />
          </ScanResultCard>
        }
        action={<ActionBar label="Add part" icon="add" tone="plain" onPress={noop} />}>
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
              <SignText size="title">{name}</SignText>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
