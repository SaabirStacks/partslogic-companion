import type { ReactNode } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Icon } from './icon';
import type { IconName } from './icons';
import { APPEAR, SETTLE } from './motion';
import type { Tone } from './palette';
import { Card, TONE_INK, TONE_TEXT } from './surface';
import { Txt } from './text';

export type LineStatus = { text: string; icon: IconName; tone: Tone };

// One scanned line of a job (a code in a delivery, a part in a bin): its name in bold, the code under it,
// where it stands, and its quantity control on the right. New lines fade in and the rest slide down.
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
  const neutral = !status || status.tone === 'neutral';
  return (
    <Animated.View entering={APPEAR} layout={SETTLE}>
      <Card className="gap-2 px-4 py-2.5">
        <View className="min-h-12 flex-row items-center gap-3">
          <View className="flex-1 gap-0.5">
            <Txt variant="label" numberOfLines={2} className="font-bold">
              {name}
            </Txt>
            {code ? (
              <Txt variant="caption" numbers numberOfLines={1}>
                {code}
              </Txt>
            ) : null}
            {status ? (
              <View className="flex-row items-center gap-1.5">
                <Icon name={status.icon} size={14} colour={neutral ? 'quiet-ink' : TONE_INK[status.tone]} />
                <Txt variant="caption" ink={neutral ? 'text-quiet-ink' : TONE_TEXT[status.tone]} numberOfLines={2} className="flex-1 font-semibold">
                  {status.text}
                </Txt>
              </View>
            ) : null}
          </View>
          {quantity}
        </View>
        {children}
      </Card>
    </Animated.View>
  );
}
