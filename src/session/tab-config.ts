import type { IconName } from '@/ui/icons';

import type { TabName } from './tabs';

// Label and icon for each tab, read by the tab bar.
export const TABS: Record<TabName, { label: string; icon: IconName }> = {
  lookup: { label: 'Look up', icon: 'lookup' },
  receive: { label: 'Receive', icon: 'receive' },
  count: { label: 'Count', icon: 'count' },
  outbox: { label: 'Outbox', icon: 'outbox' },
  account: { label: 'Account', icon: 'account' },
};
