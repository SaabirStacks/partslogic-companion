import { Share, View } from 'react-native';

import { Button } from '@/ui/button';
import { Icon } from '@/ui/icon';
import { Card } from '@/ui/surface';
import { Txt } from '@/ui/text';
import { personLabel } from '@/vendor/partslogic/shared/people';

import { setupMessage } from './people-text';

// A set-up code, shown once: big enough to read out across the counter, with the email it goes with and
// what to do with it. Share sends it as a message; the code works until they choose their own password.
export function SetupCode({ person, code }: { person: { name: string | null; email: string }; code: string }) {
  return (
    <View className="gap-3">
      <Card className="items-center gap-3 px-4 py-6">
        <View className="h-14 w-14 items-center justify-center rounded-[16px] bg-ok-soft">
          <Icon name="key" size={28} colour="ok-ink" />
        </View>
        <Txt variant="caption" className="text-center">
          {`Set-up code for ${personLabel(person)}`}
        </Txt>
        <Txt
          selectable
          accessibilityLabel={`Set-up code ${code.split('').join(' ')}`}
          variant="title"
          numbers
          numberOfLines={1}
          adjustsFontSizeToFit
          // A size of its own, set directly: two text sizes in classes don't resolve reliably.
          style={CODE_TYPE}
          className="text-center font-extrabold">
          {code}
        </Txt>
        <Txt variant="label" numberOfLines={1} className="text-center">
          {person.email}
        </Txt>
      </Card>
      <Card className="gap-2 px-4 py-3">
        {[
          'Open PartsLogic on their phone.',
          'Sign in with this email, and the code as the password.',
          'They choose their own password straight away.',
        ].map((step, index) => (
          <View key={step} className="flex-row gap-3">
            <Txt variant="label" numbers className="w-5 font-bold">
              {index + 1}
            </Txt>
            <Txt variant="body" className="flex-1">
              {step}
            </Txt>
          </View>
        ))}
      </Card>
      <Txt variant="caption" className="px-1">
        This is the only time the code is shown. If it gets lost, give them a new one from their page in People.
      </Txt>
      <Button label="Share code" icon="share" variant="tinted" onPress={() => void Share.share({ message: setupMessage(person, code) })} />
    </View>
  );
}

const CODE_TYPE = { fontSize: 27, lineHeight: 34, letterSpacing: 1 } as const;
