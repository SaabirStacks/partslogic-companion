import { Txt } from './text';

// The small heading over a group of cards: Recent, 12 matches, Bins.
export function SectionLabel({ children }: { children: string }) {
  return (
    <Txt accessibilityRole="header" variant="section" className="mt-2 px-1">
      {children}
    </Txt>
  );
}
