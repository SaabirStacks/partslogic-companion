import { SignText } from './sign-text';

// The small sign over a group of plates: Recent, 12 matches, Bins.
export function SectionLabel({ children }: { children: string }) {
  return (
    <SignText accessibilityRole="header" size="tag" ink="text-quiet-ink" className="mt-2 px-1">
      {children}
    </SignText>
  );
}
