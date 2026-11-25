import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/ui/button';
import { Choice } from '@/ui/choice';
import { Quantity } from '@/ui/quantity';
import { SectionLabel } from '@/ui/section-label';
import { Sheet } from '@/ui/sheet';
import { StatusStrip } from '@/ui/status-strip';
import { Txt } from '@/ui/text';
import {
  binLabel,
  CANT_SCAN_REASON_LABELS,
  CANT_SCAN_REASONS,
  SHORT_PICK_REASON_LABELS,
  SHORT_PICK_REASONS,
  type CantScanReason,
  type ShortPickReason,
} from '@/vendor/partslogic/shared/sales/picking';
import { quantityWords } from '@/vendor/partslogic/shared/sales/words';

import { left, type JobRow } from './job';
import { partName } from './words';

type Step = 'menu' | 'cant' | 'short';

// A row's menu: Can't scan (units picked by a tap, with why) or Short pick (how many of the rest are here, and why
// the others aren't), as the web's Short pick asks. One sheet, one step at a time; one red line at a time, under
// what it's about (P12). Opened at a step from the scan card (Short pick there).
export function PickRowSheet({
  row,
  start = 'menu',
  onTap,
  onShort,
  onClose,
}: {
  row: JobRow | null;
  start?: Step;
  onTap: (key: string, qty: number, reason: CantScanReason) => void;
  onShort: (key: string, found: number, reason: ShortPickReason) => void;
  onClose: () => void;
}) {
  // Each opening starts afresh: keyed by the row and the step it opens at.
  return row ? <RowSheet key={`${row.key}:${start}`} row={row} start={start} onTap={onTap} onShort={onShort} onClose={onClose} /> : null;
}

function RowSheet({
  row,
  start,
  onTap,
  onShort,
  onClose,
}: {
  row: JobRow;
  start: Step;
  onTap: (key: string, qty: number, reason: CantScanReason) => void;
  onShort: (key: string, found: number, reason: ShortPickReason) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>(start);
  const [why, setWhy] = useState<CantScanReason | null>(null);
  const [reason, setReason] = useState<ShortPickReason | null>(null);
  const rest = left(row);
  // Can't scan starts at one unit, as a scan adds one; Short pick at none here (the deck's "How many are here? (0)").
  const [qty, setQty] = useState(start === 'short' ? 0 : 1);
  const [asked, setAsked] = useState(false);
  const clamp = (value: number, most: number) => Math.max(0, Math.min(most, Math.round(value)));
  const where = `${binLabel(row.bin)} · ${row.order} · ${quantityWords(rest)} to pick`;

  if (step === 'menu') {
    return (
      <Sheet visible title={partName(row)} onClose={onClose}>
        <Txt variant="caption" numbers>
          {where}
        </Txt>
        <View className="gap-2">
          <Button label="Can’t scan" icon="keyboard" variant="tinted" onPress={() => { setQty(1); setStep('cant'); }} />
          <Button label="Short pick" icon="warning" variant="tinted" onPress={() => { setQty(0); setStep('short'); }} />
          <Button label="Cancel" variant="secondary" onPress={onClose} />
        </View>
      </Sheet>
    );
  }

  if (step === 'cant') {
    // The reason first, under the reasons; then the units, under them.
    const missingWhy = asked && !why;
    const missingUnits = asked && !!why && qty < 1;
    return (
      <Sheet visible title="Can’t scan" onClose={onClose}>
        <Where row={row} where={where} />
        <View className="gap-2" accessibilityRole="radiogroup" accessibilityLabel="Why?">
          <SectionLabel>Why?</SectionLabel>
          {CANT_SCAN_REASONS.map((value) => (
            <Choice key={value} pick="reason" title={CANT_SCAN_REASON_LABELS[value]} selected={why === value} onPress={() => setWhy(value)} />
          ))}
          {missingWhy ? <StatusStrip tone="stop" icon="stop" text="Say why it can’t be scanned." /> : null}
        </View>
        <View className="flex-row items-center justify-between gap-3">
          <Txt variant="label" className="font-bold">
            Units
          </Txt>
          <Quantity total={qty} name={partName(row)} min={1} max={rest} onStep={(change) => setQty((now) => clamp(now + change, rest))} onSet={(target) => setQty(clamp(target, rest))} />
        </View>
        {missingUnits ? <StatusStrip tone="stop" icon="stop" text="Add at least 1." /> : null}
        <View className="gap-2">
          <Button
            label="Add"
            onPress={() => {
              if (!why || qty < 1) return setAsked(true);
              onTap(row.key, qty, why);
              onClose();
            }}
          />
          <Button label="Cancel" variant="secondary" onPress={onClose} />
        </View>
      </Sheet>
    );
  }

  const most = Math.max(0, rest - 1);
  return (
    <Sheet visible title="Short pick" onClose={onClose}>
      <Where row={row} where={where} />
      <View className="flex-row items-center justify-between gap-3">
        <Txt variant="label" className="flex-1 font-bold">
          How many are here?
        </Txt>
        <Quantity total={qty} name={partName(row)} max={most} onStep={(change) => setQty((now) => clamp(now + change, most))} onSet={(target) => setQty(clamp(target, most))} />
      </View>
      <View className="gap-2" accessibilityRole="radiogroup" accessibilityLabel="Why?">
        <SectionLabel>Why?</SectionLabel>
        {SHORT_PICK_REASONS.map((value) => (
          <Choice key={value} pick="reason" title={SHORT_PICK_REASON_LABELS[value]} selected={reason === value} onPress={() => setReason(value)} />
        ))}
        {asked && !reason ? <StatusStrip tone="stop" icon="stop" text="Say why the rest isn’t here." /> : null}
      </View>
      <View className="gap-2">
        <Button
          label="Save"
          onPress={() => {
            if (!reason) return setAsked(true);
            onShort(row.key, qty, reason);
            onClose();
          }}
        />
        <Button label="Cancel" variant="secondary" onPress={onClose} />
      </View>
    </Sheet>
  );
}

// The part the sheet is about, then where it is and what's left: "B-02 · SO-000019 · 1 to pick", each on a line that
// never breaks inside a number.
function Where({ row, where }: { row: JobRow; where: string }) {
  return (
    <View className="gap-0.5">
      <Txt variant="label" className="font-bold">
        {partName(row)}
      </Txt>
      <Txt variant="caption" numbers>
        {where}
      </Txt>
    </View>
  );
}
