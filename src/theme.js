import React from 'react';
import { MD3LightTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Light palette. The accent is a deep teal (darker than the old cyan) so buttons,
// links and the active tab stay readable on white. Mapped onto Material Design 3
// roles so Paper components inherit the app's identity.
const BRAND = {
  bg: '#f4f5fa',        // app background (near-white)
  surface: '#ffffff',   // cards / headers
  surfaceAlt: '#eef0f6', // inner surfaces (rows, inputs)
  accent: '#0e7f9e',    // deep teal accent
  text: '#1a1a2e',      // near-black text
  muted: '#5b5b73',     // secondary text
  border: '#d6d9e6',    // hairline borders
  danger: '#c62828',
  warn: '#b45309',      // "editing a past day" indicator (dark amber on light)
};

export const theme = {
  ...MD3LightTheme,
  roundness: 3,
  colors: {
    ...MD3LightTheme.colors,
    primary: BRAND.accent,
    onPrimary: '#ffffff',
    primaryContainer: '#bfe6f1',
    onPrimaryContainer: '#06323f',
    secondary: BRAND.accent,
    onSecondary: '#ffffff',
    background: BRAND.bg,
    onBackground: BRAND.text,
    surface: BRAND.surface,
    onSurface: BRAND.text,
    surfaceVariant: BRAND.surfaceAlt,
    onSurfaceVariant: BRAND.muted,
    surfaceDisabled: BRAND.surfaceAlt,
    outline: BRAND.border,
    outlineVariant: BRAND.border,
    error: BRAND.danger,
    onError: '#ffffff',
    elevation: {
      level0: 'transparent',
      level1: '#ffffff',
      level2: '#f6f7fc',
      level3: '#f1f3f9',
      level4: '#eceff7',
      level5: '#e7ebf4',
    },
  },
};

// Convenience aliases used directly in screen styles.
export const C = {
  bg: BRAND.bg,
  card: BRAND.surface,
  inner: BRAND.surfaceAlt,
  accent: BRAND.accent,
  text: BRAND.text,
  muted: BRAND.muted,
  border: BRAND.border,
  danger: BRAND.danger,
  warn: BRAND.warn,
  onAccent: '#ffffff',
};

// Status bar: dark icons read on the light header background.
export const statusBarStyle = 'dark';

// Pain scale colours (0 = green … 10 = deep red). Shared by every screen.
const PAIN_COLORS = [
  '#22c55e', '#4ade80', '#86efac', '#fbbf24', '#fb923c',
  '#f97316', '#f87171', '#ef4444', '#dc2626', '#b91c1c', '#7f1d1d',
];

export function getPainColor(level) {
  return PAIN_COLORS[Math.min(Math.max(level, 0), 10)];
}

export const PAIN_LABELS = [
  'None', 'Minimal', 'Very mild', 'Mild', 'Moderate', 'Noticeable',
  'Uncomfortable', 'Strong', 'Intense', 'Very strong', 'Worst imaginable',
];

// Icon adapter so Paper renders icons via @expo/vector-icons (fonts loaded by
// expo-font — avoids native react-native-vector-icons linking).
export const paperSettings = {
  icon: (props) => <MaterialCommunityIcons {...props} />,
};
