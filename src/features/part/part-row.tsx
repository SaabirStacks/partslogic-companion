import { ListRow } from '@/ui/list';

// One part in a list: brand and number, with the description underneath.
export function PartRow({
  brand,
  number,
  description,
  value,
  onPress,
  last,
}: {
  brand: string;
  number: string;
  description: string | null;
  value?: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <ListRow label={`${brand} ${number}`} detail={description} value={value} tabular onPress={onPress} last={last} />
  );
}
