import type { StatusState } from '../core/status';
import type { ImportBatch } from './batches';

// Where an upload is, in words and as a badge state (docs/design-checks/status-colours.md): receiving its rows, mapping,
// applying, undoing or delisting is our move with a spinner; a delisting check waits on a person, so it is our move
// without one; done is ready, failed or stopped stops work, an undone upload has ended.
export type UploadStage = { label: string; state: StatusState; spinning: boolean };

export function batchStage(batch: Pick<ImportBatch, 'status' | 'error'>): UploadStage {
  const running = (label: string): UploadStage => ({ label, state: 'active', spinning: true });
  switch (batch.status) {
    case 'completed':
      return { label: 'Done', state: 'ready', spinning: false };
    case 'undone':
      return { label: 'Undone', state: 'ended', spinning: false };
    case 'undoing':
      return running('Undoing');
    case 'checking':
      return { label: 'Delisting to check', state: 'active', spinning: false };
    case 'delisting':
      return running('Delisting');
    case 'failed':
      return { label: batch.error?.startsWith('Stopped') ? 'Stopped' : 'Failed', state: 'blocked', spinning: false };
    case 'uploaded':
    case 'parsing':
      return running('Receiving rows');
    case 'mapping':
    case 'resolving':
      return running('Mapping');
    default:
      return running('Applying');
  }
}
