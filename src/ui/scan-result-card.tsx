import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { depthStyle } from './depth';
import { Icon } from './icon';
import type { IconName } from './icons';
import { RISE } from './motion';
import type { Tone } from './palette';
import { StatusChip } from './status-chip';
import { surfaceClass, TONE_TEXT } from './surface';
import { Txt } from './text';
import { useScheme } from './theme';

export type ResultStatus = { icon: IconName; label: string };

// The answer to a scan, on a white card: the outcome as a chip in its colour (a word and a symbol, never
// colour alone), what was scanned in bold, its quantity in big numbers, and the actions under it. Give it
// a new key for each scan so every scan rises, even when two in a row look the same.
export function ScanResultCard({
  tone,
  status,
  title,
  detail,
  quantity,
  onPress,
  children,
}: {
  tone: Tone;
  status: ResultStatus;
  title: string;
  detail?: string | null;
  // tone colours the number by its state (on hand in stock, at reorder, out); blind counts leave it black.
  quantity?: { value: string; label: string; tone?: Tone };
  // Opens what was scanned in full (the part, with stock per bin).
  onPress?: () => void;
  children?: ReactNode;
}) {
  const scheme = useScheme();
  const summary = [status.label, title, quantity ? `${quantity.value} ${quantity.label}` : null, detail]
    .filter(Boolean)
    .join(', ');

  const face = (
    <>
      <View className="flex-row items-center gap-2">
        <View className="flex-1">
          <StatusChip tone={tone} icon={status.icon} label={status.label} />
        </View>
        {onPress ? <Icon name="forward" size={16} colour="quiet-ink" /> : null}
      </View>
      <View className="flex-row items-end gap-3">
        <View className="flex-1 gap-0.5">
          <Txt variant="title" numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75} className="font-extrabold">
            {title}
          </Txt>
          {detail ? (
            <Txt variant="caption" numberOfLines={2} numbers>
              {detail}
            </Txt>
          ) : null}
        </View>
        {quantity ? (
          <View className="items-end">
            <Txt variant="headline" numbers numberOfLines={1} ink={TONE_TEXT[quantity.tone ?? 'neutral']} className="font-extrabold">
              {quantity.value}
            </Txt>
            <Txt variant="caption" numberOfLines={1}>
              {quantity.label}
            </Txt>
          </View>
        ) : null}
      </View>
    </>
  );

  return (
    <Animated.View entering={RISE} accessibilityLiveRegion="polite">
      <View style={depthStyle('raise', scheme)} className={surfaceClass({ className: 'gap-3 p-4' })}>
        {onPress ? (
          <Pressable accessibilityRole="button" accessibilityLabel={summary} onPress={onPress} className="gap-3 active:opacity-75">
            {face}
          </Pressable>
        ) : (
          <View accessible accessibilityLabel={summary} className="gap-3">
            {face}
          </View>
        )}
        {children ? <View className="gap-2">{children}</View> : null}
      </View>
    </Animated.View>
  );
}

