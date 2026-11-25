import { View } from 'react-native';

import { Button } from './button';
import { Sheet } from './sheet';
import { Txt } from './text';
import { Tally, type TallyItem } from './tally';

// The check before a job is finished or thrown away: a sheet from the bottom with the totals in big
// numbers and two buttons, never a system alert full of sentences. Back, a tap outside and Cancel all keep
// the job open. alternative is a second way to end it, for a job that can end two ways (a shared stock
// take: finish it for everyone, or leave it to the others).
export function ConfirmSheet({
  visible,
  title,
  facts,
  note,
  confirm,
  alternative,
  cancelLabel = 'Cancel',
  onCancel,
}: {
  visible: boolean;
  title: string;
  facts?: TallyItem[];
  // At most one short line, for a state the numbers can't show ("1 unknown code stays for the office").
  note?: string | null;
  confirm: { label: string; onPress: () => void; destructive?: boolean };
  alternative?: { label: string; onPress: () => void } | null;
  cancelLabel?: string;
  onCancel: () => void;
}) {
  return (
    <Sheet visible={visible} title={title} closeLabel={cancelLabel} onClose={onCancel}>
      {facts && facts.length > 0 ? <Tally items={facts} /> : null}
      {note ? <Txt variant="caption" ink="text-ink">{note}</Txt> : null}
      <View className="gap-2">
        <Button label={confirm.label} variant={confirm.destructive ? 'destructive' : 'primary'} onPress={confirm.onPress} />
        {alternative ? <Button label={alternative.label} variant="secondary" onPress={alternative.onPress} /> : null}
        <Button label={cancelLabel} variant="secondary" onPress={onCancel} />
      </View>
    </Sheet>
  );
}
