import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';
import { useColorScheme } from 'react-native';

import { colour, type ColourName, type Scheme } from './palette';

export function useScheme(): Scheme {
  return useColorScheme() === 'dark' ? 'dark' : 'light';
}

// Colour values for native props, in the current light or dark scheme.
export function useColour(): (name: ColourName) => string {
  const scheme = useScheme();
  return (name) => colour(scheme, name);
}

// Native headers, sheets and the tab bar pick these up from the navigation theme.
export function navigationTheme(scheme: Scheme): Theme {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colour(scheme, 'tint'),
      background: colour(scheme, 'canvas'),
      card: colour(scheme, 'paper'),
      text: colour(scheme, 'ink'),
      border: colour(scheme, 'hairline'),
      notification: colour(scheme, 'out'),
    },
  };
}
