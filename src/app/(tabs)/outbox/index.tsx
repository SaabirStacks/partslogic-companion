import { ScrollView, Text, View } from 'react-native';

import { AccountSection } from '@/features/account/account-section';
import { Icon } from '@/ui/icon';

export default function Outbox() {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic">
      <View accessible className="items-center gap-2 px-8 py-10">
        <Icon name="sent" size={36} colour="quiet-ink" />
        <Text accessibilityRole="header" className="text-center text-xl font-semibold text-ink">
          All sent
        </Text>
        <Text className="text-center text-base leading-6 text-quiet-ink">
          Nothing is waiting to send. Work done with no signal will wait here until it reaches PartsLogic.
        </Text>
      </View>
      <AccountSection />
    </ScrollView>
  );
}
