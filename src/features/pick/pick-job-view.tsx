import { useState } from 'react';

import { ActionBar } from '@/ui/action-bar';
import { Button } from '@/ui/button';
import { ConfirmSheet } from '@/ui/confirm-sheet';
import { JobBanner } from '@/ui/job-banner';
import { JobScreen } from '@/ui/job-screen';
import { StatusStrip } from '@/ui/status-strip';
import { Tally } from '@/ui/tally';
import type { CantScanReason, ShortPickReason } from '@/vendor/partslogic/shared/sales/picking';
import { quantityWords } from '@/vendor/partslogic/shared/sales/words';

import { bins, type JobRow, type JobTotals, type LocalPickJob } from './job';
import { PickCard } from './pick-card';
import { PickRowSheet } from './pick-row-sheet';
import { PickRows } from './pick-rows';
import type { PickReceipt } from './receipt';
import type { PickCard as Card } from './scan-card';
import { bannerDetail, bannerTitle, finishLabel, goBack, PICK_OFFLINE, refusedLine, STOP } from './words';

type SheetState = { key: string; start: 'menu' | 'short' } | null;

// A running pick job, as the picker sees it: the bin to go to (large) with what follows, the camera, the last scan's
// card, the totals, any pick PartsLogic refused, the rows by bin, and Finish in the thumb zone. Drawn from its props,
// so the review gallery shows it from fixtures (sheet and confirming open one of its sheets there).
export function PickJobView({
  job,
  totals,
  card,
  lastRow,
  refused,
  onScan,
  onDismissCard,
  onTap,
  onShort,
  onUndo,
  onEnd,
  sheet: initialSheet = null,
  confirming: initialConfirming = null,
}: {
  job: LocalPickJob;
  totals: JobTotals;
  card: { key: string; card: Card } | null;
  lastRow: JobRow | null;
  refused: PickReceipt['refused'];
  onScan: (code: string) => void;
  onDismissCard: () => void;
  onTap: (key: string, qty: number, reason: CantScanReason) => void;
  onShort: (key: string, found: number, reason: ShortPickReason) => void;
  onUndo: () => void;
  onEnd: (how: 'finished' | 'stopped') => void;
  sheet?: SheetState;
  confirming?: 'finish' | 'stop' | null;
}) {
  const [sheet, setSheet] = useState<SheetState>(initialSheet);
  const [confirming, setConfirming] = useState(initialConfirming);
  const { now, next } = bins(job);
  const end = (how: 'finished' | 'stopped') => {
    setConfirming(null);
    onEnd(how);
  };

  return (
    <>
      <JobScreen
        placeholder="Barcode or part number"
        onScan={onScan}
        offlineText={PICK_OFFLINE}
        // No scan counts while a sheet is open (DESIGN.md: a sheet pauses the camera).
        scanEnabled={!sheet && !confirming}
        banner={<JobBanner size={now ? 'display' : 'headline'} family="outbound" title={bannerTitle(now, totals)} detail={bannerDetail(next, now, totals)} />}
        result={card ? <PickCard key={card.key} card={card.card} onShortPick={(row) => setSheet({ key: row.key, start: 'short' })} onDismiss={onDismissCard} /> : null}
        action={
          <ActionBar
            label={finishLabel(totals.picked)}
            icon="check"
            // Everything picked or short finishes at once; units still to pick are said first.
            onPress={() => (totals.left > 0 ? setConfirming('finish') : end('finished'))}
            // Nothing picked or short yet: nothing to finish (Stop picking lets the orders go).
            disabled={totals.picked === 0 && totals.short === 0}
            secondary={lastRow && !lastRow.short && lastRow.scanned + lastRow.tapped > 0 ? { label: 'Undo the last scan', icon: 'undo', onPress: onUndo } : undefined}
          />
        }>
        <Tally
          items={[
            { value: quantityWords(totals.picked), label: `Units of ${quantityWords(totals.units)}` },
            { value: totals.orders, label: totals.orders === 1 ? 'Order' : 'Orders' },
            ...(totals.short > 0 ? [{ value: quantityWords(totals.short), label: 'Short', tone: 'warn' as const }] : []),
          ]}
        />
        {refused.map((refusal) => (
          <StatusStrip key={refusal.key} tone="stop" icon="stop" text={refusedLine(refusal.order, refusal.reason)} />
        ))}
        <PickRows rows={job.rows} onRow={(row) => setSheet({ key: row.key, start: 'menu' })} />
        <Button label={STOP.confirm} icon="close" variant="secondary" onPress={() => setConfirming('stop')} />
      </JobScreen>
      <PickRowSheet
        row={sheet ? (job.rows.find((row) => row.key === sheet.key) ?? null) : null}
        start={sheet?.start}
        onTap={onTap}
        onShort={onShort}
        onClose={() => setSheet(null)}
      />
      <ConfirmSheet
        visible={confirming === 'finish'}
        title="Finish picking?"
        facts={[
          { value: quantityWords(totals.picked), label: 'Picked' },
          { value: quantityWords(totals.left), label: 'Not picked', tone: 'warn' },
        ]}
        note={goBack(totals.left)}
        confirm={{ label: 'Finish', onPress: () => end('finished') }}
        cancelLabel="Keep picking"
        onCancel={() => setConfirming(null)}
      />
      <ConfirmSheet
        visible={confirming === 'stop'}
        title={STOP.title}
        facts={[
          { value: quantityWords(totals.picked), label: 'Picked' },
          { value: quantityWords(totals.left), label: 'Not picked', tone: 'warn' },
        ]}
        note={STOP.note}
        confirm={{ label: STOP.confirm, onPress: () => end('stopped') }}
        cancelLabel="Keep picking"
        onCancel={() => setConfirming(null)}
      />
    </>
  );
}
