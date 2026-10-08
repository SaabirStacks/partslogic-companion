import { ScrollView } from 'react-native';

import { AccountSection } from '@/features/account/account-section';

export default function Account() {
  return (
    <ScrollView className="bg-ground">
      <AccountSection />
    </ScrollView>
  );
}
