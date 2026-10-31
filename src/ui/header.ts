import { colour, type Scheme } from './palette';

// A screen's native header: its name in bold on the ground colour and the system back control. Jobs add
// Look up on the right (app/_layout.tsx).
export function headerOptions(scheme: Scheme, title: string) {
  return {
    headerShown: true,
    title,
    headerTitleStyle: { fontSize: 19, fontWeight: '700' as const, color: colour(scheme, 'ink') },
    headerStyle: { backgroundColor: colour(scheme, 'ground') },
    headerTintColor: colour(scheme, 'ink'),
    headerShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal' as const,
  };
}
