import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Icon } from './icon';
import type { IconName } from './icons';
import { RISE } from './motion';
import type { Tone } from './palette';
import { ON_TONE, plateClass, TEXT_ON } from './plate';
import { Detail, SignText } from './sign-text';

export type ResultStatus = { icon: IconName; label: string };

// The answer to a scan, as one plate in the outcome's colour: what was scanned in capitals, its quantity in
// big numbers, and the outcome as a word and a pictogram (never colour alone). Give it a new key for each
// scan so every scan rises, even when two in a row look the same.
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
  quantity?: { value: string; label: string };
  // Opens what was scanned in full (the part, with stock per bin).
  onPress?: () => void;
  children?: ReactNode;
}) {
  const on = TEXT_ON[tone];
  // Small print on a coloured plate takes the plate's own text colour, never grey.
  const quiet = tone === 'surface' ? 'text-quiet-ink' : on;
  const summary = [status.label, title, quantity ? `${quantity.value} ${quantity.label}` : null, detail]
    .filter(Boolean)
    .join(', ');

  const face = (
    <>
      <View className="flex-row items-center gap-2">
        <Icon name={status.icon} size={18} colour={ON_TONE[tone]} />
        <SignText size="tag" ink={on} numberOfLines={1} className="flex-1">
          {status.label}
        </SignText>
        {onPress ? <Icon name="forward" size={16} colour={ON_TONE[tone]} /> : null}
      </View>
      <View className="flex-row items-end gap-3">
        <View className="flex-1 gap-1">
          <SignText size="headline" weight="heavy" ink={on} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>
            {title}
          </SignText>
          {detail ? (
            <Detail ink={quiet} numberOfLines={1}>
              {detail}
            </Detail>
          ) : null}
        </View>
        {quantity ? (
          <View className="items-end">
            <SignText size="hero" weight="heavy" ink={on} numberOfLines={1}>
              {quantity.value}
            </SignText>
            <SignText size="tag" ink={quiet} numberOfLines={1}>
              {quantity.label}
            </SignText>
          </View>
        ) : null}
      </View>
    </>
  );

  return (
    <Animated.View entering={RISE} accessibilityLiveRegion="polite">
      <View className={plateClass({ tone, heavy: true, className: 'gap-3 p-4' })}>
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
