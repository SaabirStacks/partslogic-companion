import { ScrollView } from 'react-native';

import { AccountSection } from '@/features/account/account-section';

export default function Account() {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic">
      <AccountSection />
    </ScrollView>
  );
}
