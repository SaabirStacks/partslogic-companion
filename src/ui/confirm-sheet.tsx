import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from './button';
import { themeVars } from './palette';
import { Txt } from './text';
import { Tally, type TallyItem } from './tally';
import { useScheme } from './theme';

// The check before a job is finished or thrown away: a sheet from the bottom with the totals in big
// numbers and two buttons, never a system alert full of sentences. Back, a tap outside and Cancel all keep
// the job open.
export function ConfirmSheet({
  visible,
  title,
  facts,
  note,
  confirm,
  cancelLabel = 'Cancel',
  onCancel,
}: {
  visible: boolean;
  title: string;
  facts?: TallyItem[];
  // At most one short line, for a state the numbers can't show ("1 unknown code stays for the office").
  note?: string | null;
  confirm: { label: string; onPress: () => void; destructive?: boolean };
  cancelLabel?: string;
  onCancel: () => void;
}) {
  const insets = useSafeAreaInsets();
  const scheme = useScheme();
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onCancel}>
      {/* A modal can draw outside the root view, so it sets the palette again for itself. */}
      <View style={themeVars(scheme)} className="flex-1 justify-end">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
          onPress={onCancel}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
        />
        <View
          accessibilityViewIsModal
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          className="gap-4 rounded-t-[20px] border-t border-edge bg-ground px-4 pt-5">
          <Txt accessibilityRole="header" variant="headline" className="font-extrabold">
            {title}
          </Txt>
          {facts && facts.length > 0 ? <Tally items={facts} /> : null}
          {note ? <Txt variant="caption" ink="text-ink">{note}</Txt> : null}
          <View className="gap-2">
            <Button
              label={confirm.label}
              variant={confirm.destructive ? 'destructive' : 'primary'}
              onPress={confirm.onPress}
            />
            <Button label={cancelLabel} variant="secondary" onPress={onCancel} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
