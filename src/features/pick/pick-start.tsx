import { Button } from '@/ui/button';
import { Notice } from '@/ui/notice';
import { StatusStrip } from '@/ui/status-strip';
import type { PickJobStatus } from '@/vendor/partslogic/shared/sales/pick-jobs';

import { NO_SIGNAL_TO_START, NOTHING_TO_PICK, readyToPick, yourJob } from './words';

// Before a job: what the branch has to pick, with Start picking; the picker's own job (from another phone) to carry
// on; nothing to pick; or no signal, since starting claims the orders.
export function PickStart({
  status,
  online,
  loading,
  busy,
  problem,
  onStart,
  onPack,
}: {
  status: PickJobStatus | undefined;
  online: boolean;
  loading: boolean;
  busy: boolean;
  problem: string | null;
  onStart: () => void;
  onPack: () => void;
}) {
  if (!online) return <Notice icon="offline" tone="warn" title={NO_SIGNAL_TO_START.title} line={NO_SIGNAL_TO_START.line} />;
  if (!status) return <Notice icon="pick" tone="neutral" title={loading ? 'Checking what to pick' : 'Not checked'} line={problem} />;
  const failed = problem ? <StatusStrip tone="stop" icon="stop" text={problem} /> : null;
  if (status.job) {
    return (
      <Notice icon="pick" title="Your pick job" line={yourJob(status.job.picked, status.job.picked + status.job.toPick)}>
        {failed}
        <Button label="Carry on" icon="forward" busy={busy} onPress={onStart} />
      </Notice>
    );
  }
  if (status.freeOrders <= 0) {
    return (
      <Notice icon="sent" tone="neutral" title={NOTHING_TO_PICK.title} line={NOTHING_TO_PICK.line}>
        {status.toPack > 0 ? <Button label="Pack" icon="pack" variant="tinted" onPress={onPack} /> : null}
      </Notice>
    );
  }
  return (
    <Notice icon="pick" title={readyToPick(status.toPick, status.orders, status.location)}>
      {failed}
      <Button label="Start picking" icon="pick" busy={busy} onPress={onStart} />
    </Notice>
  );
}
