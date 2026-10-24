import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { PendingScan } from '@/scan/pending-scan';
import { partLabel, type ScanCheck } from '@/scan/resolve';

import { Button } from './button';
import { Quantity } from './quantity';
import { ScanResultCard } from './scan-result-card';

// The scan a job is holding, with the camera paused behind it: what it is, how many (− / + or tap to
// type), and the one button that records it. Skip lets it go. Nothing is recorded until the person
// confirms, so a stray read never lands. addPart is offered for a code PartsLogic doesn't know.
export function ConfirmScanCard({
  pending,
  verb,
  onConfirm,
  onSkip,
  onStep,
  onSet,
  onRetry,
  addPart,
}: {
  pending: PendingScan<ScanCheck>;
  // The job's word for recording it: Add, Count.
  verb: string;
  onConfirm: () => void;
  onSkip: () => void;
  onStep: (change: 1 | -1) => void;
  onSet: (qty: number) => void;
  onRetry: () => void;
  addPart?: ReactNode;
}) {
  const { hit, code, qty } = pending;

  if (!hit) {
    return (
      <ScanResultCard key={pending.key} tone="surface" status={{ icon: 'waiting', label: 'Checking' }} title={code}>
        <Button label="Skip" icon="close" variant="secondary" compact onPress={onSkip} />
      </ScanResultCard>
    );
  }

  if (hit.type === 'error') {
    return (
      <ScanResultCard key={pending.key} tone="stop" status={{ icon: 'stop', label: 'Didn’t work' }} title={code} detail={hit.message}>
        <View className="flex-row flex-wrap gap-2">
          <Button label="Try again" icon="retry" variant="secondary" compact onPress={onRetry} />
          <Button label="Skip" icon="close" variant="secondary" compact onPress={onSkip} />
        </View>
      </ScanResultCard>
    );
  }

  if (hit.type === 'bin') {
    return (
      <ScanResultCard key={pending.key} tone="warning" status={{ icon: 'bin', label: 'That’s a bin' }} title={hit.bin} detail={hit.location}>
        <Button label="OK" variant="secondary" compact onPress={onSkip} />
      </ScanResultCard>
    );
  }

  const known = hit.type === 'part';
  const title = known ? partLabel(hit) : code;
  const status =
    hit.type === 'part'
      ? { icon: 'barcode' as const, label: 'Scanned' }
      : hit.type === 'offline'
        ? { icon: 'offline' as const, label: 'No signal · not checked' }
        : { icon: 'warning' as const, label: 'Unknown code' };

  return (
    <ScanResultCard key={pending.key} tone={known ? 'surface' : 'warning'} status={status} title={title} detail={known ? code : null}>
      <View className="flex-row items-center gap-3">
        <Quantity total={qty} name={title} onStep={onStep} onSet={onSet} />
        <View className="flex-1">
          <Button label={`${verb} ${qty}`} icon="check" onPress={onConfirm} />
        </View>
      </View>
      <View className="flex-row flex-wrap gap-2">
        {known ? null : addPart}
        <Button label="Skip" icon="close" variant="secondary" compact onPress={onSkip} />
      </View>
    </ScanResultCard>
  );
}
