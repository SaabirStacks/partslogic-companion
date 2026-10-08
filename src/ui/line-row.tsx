import type { ReactNode } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Icon } from './icon';
import type { IconName } from './icons';
import { APPEAR, SETTLE } from './motion';
import type { Tone } from './palette';
import { Plate, TEXT_INK, TONE_INK } from './plate';
import { Detail, SignText } from './sign-text';

export type LineStatus = { text: string; icon: IconName; tone: Tone };

// One scanned line of a job (a code in a delivery, a part in a bin): its name as a sign, the code under
// it, where it stands, and its quantity control on the right. New lines fade in and the rest slide down.
export function LineRow({
  name,
  code,
  status,
  quantity,
  children,
}: {
  name: string;
  code?: string | null;
  status?: LineStatus | null;
  quantity: ReactNode;
  // Anything the line needs acted on, such as Add part for an unknown code.
  children?: ReactNode;
}) {
  return (
    <Animated.View entering={APPEAR} layout={SETTLE}>
      <Plate className="gap-2 px-3 py-2">
        <View className="min-h-12 flex-row items-center gap-3">
          <View className="flex-1 gap-0.5">
            <SignText size="label" weight="heavy" numberOfLines={1}>
              {name}
            </SignText>
            {code ? <Detail numberOfLines={1}>{code}</Detail> : null}
            {status ? (
              <View className="flex-row items-center gap-1.5">
                <Icon name={status.icon} size={14} colour={status.tone === 'surface' ? 'quiet-ink' : TONE_INK[status.tone]} />
                <Detail ink={status.tone === 'surface' ? 'text-quiet-ink' : TEXT_INK[status.tone]} numberOfLines={2} className="flex-1 font-semibold">
                  {status.text}
                </Detail>
              </View>
            ) : null}
          </View>
          {quantity}
        </View>
        {children}
      </Plate>
    </Animated.View>
  );
}
