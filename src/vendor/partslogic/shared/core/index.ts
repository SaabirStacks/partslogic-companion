// Core: the typed client, database errors, JSON readers and paging shared by every domain.
// The public names; apps import them from '@partslogic/shared'.
export {
  classifyQueueError,
  DataError,
  type QueueErrorKind,
} from './errors';
export {
  type Page,
  type PageInfo,
} from './page';
export {
  isStatusState,
  STATUS_FAMILY,
  STATUS_STATES,
  STATUS_WORD_STATES,
  type BadgeTone,
  type StatusFamily,
  type StatusState,
  type StatusWord,
} from './status';
