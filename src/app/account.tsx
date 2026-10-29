
import { AccountSection } from '@/features/account/account-section';
import { Scroll } from '@/ui/scroll';

export default function Account() {
  return (
    <Scroll className="bg-ground">
      <AccountSection />
    </Scroll>
  );
}
