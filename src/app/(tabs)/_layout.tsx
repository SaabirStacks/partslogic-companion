import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useOutbox } from '@/queue/outbox-provider';
import { useSession } from '@/session/session-provider';
import { TABS } from '@/session/tab-config';
import { visibleTabs, type TabName } from '@/session/tabs';
import { ICONS } from '@/ui/icons';
import { useColour } from '@/ui/theme';

export default function TabsLayout() {
  const { state } = useSession();
  const colourOf = useColour();
  const { waiting, needsAttention } = useOutbox();
  const unsent = waiting + needsAttention;
  const shown = visibleTabs(state.status === 'member' ? state.member.role : 'viewer');
  const hidden = (name: TabName) => !shown.includes(name);
  const icon = (name: TabName) => ICONS[TABS[name].icon];

  return (
    <NativeTabs
      iconColor={{ default: undefined, selected: colourOf('tint') }}
      labelStyle={{ selected: { color: colourOf('tint') } }}
      indicatorColor={colourOf('mist')}
      badgeBackgroundColor={colourOf(needsAttention > 0 ? 'out' : 'tint')}>
      <NativeTabs.Trigger name="lookup" hidden={hidden('lookup')}>
        <NativeTabs.Trigger.Label>{TABS.lookup.label}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={icon('lookup').ios} md={icon('lookup').android} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="receive" hidden={hidden('receive')}>
        <NativeTabs.Trigger.Label>{TABS.receive.label}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={icon('receive').ios} md={icon('receive').android} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="count" hidden={hidden('count')}>
        <NativeTabs.Trigger.Label>{TABS.count.label}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={icon('count').ios} md={icon('count').android} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="outbox" hidden={hidden('outbox')}>
        <NativeTabs.Trigger.Label>{TABS.outbox.label}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={icon('outbox').ios} md={icon('outbox').android} />
        {unsent > 0 ? <NativeTabs.Trigger.Badge>{String(unsent)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="account" hidden={hidden('account')}>
        <NativeTabs.Trigger.Label>{TABS.account.label}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={icon('account').ios} md={icon('account').android} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
