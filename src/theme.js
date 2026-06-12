import React from 'react';
import { MD3DarkTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Brand palette (kept from the original hand-rolled dark theme) mapped onto
// Material Design 3 roles so Paper components inherit the app's identity.
const BRAND = {
  bg: '#0f0f1a',       // app background
  surface: '#1a1a2e',  // cards / headers
  surfaceAlt: '#13131f', // inner surfaces (rows, inputs)
  accent: '#4cc9f0',   // cyan accent
  text: '#e0e0e0',
  muted: '#8a8aa0',
  border: '#2d2d4e',
  danger: '#ef4444',
};

export const theme = {
  ...MD3DarkTheme,
  roundness: 3,
  colors: {
    ...MD3DarkTheme.colors,
    primary: BRAND.accent,
    onPrimary: '#001620',
    primaryContainer: '#13414f',
    onPrimaryContainer: '#bfeaf7',
    secondary: BRAND.accent,
    onSecondary: '#001620',
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
      level1: BRAND.surface,
      level2: '#20203a',
      level3: '#262645',
      level4: '#2a2a4c',
      level5: '#2e2e52',
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
  onAccent: '#001620',
};

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
