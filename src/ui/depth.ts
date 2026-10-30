import type { ViewStyle } from 'react-native';

import type { Scheme } from './palette';

// Three levels on the counter: the grey ground, cards that sit on it with a soft lift, and what floats over
// the rest (the scan result, the part's photo, sheets) with a deeper shadow. After dark a shadow can't be
// seen, so depth comes from the lighter surfaces alone and these give nothing.
const LIFT: ViewStyle = {
  shadowColor: '#101828',
  shadowOpacity: 0.06,
  shadowRadius: 4,
  shadowOffset: { width: 0, height: 1 },
  elevation: 1,
};

const RAISE: ViewStyle = {
  shadowColor: '#101828',
  shadowOpacity: 0.14,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 6,
};

export type Depth = 'flat' | 'lift' | 'raise';

export function depthStyle(depth: Depth, scheme: Scheme): ViewStyle | undefined {
  if (depth === 'flat') return undefined;
  if (depth === 'raise') return scheme === 'dark' ? { elevation: 6 } : RAISE;
  return scheme === 'dark' ? undefined : LIFT;
}
