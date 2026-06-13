import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Chip } from 'react-native-paper';

export const SYMPTOM_OPTIONS = [
  { key: 'morning',         label: 'Morning stiffness' },
  { key: 'stairs_up',      label: 'Stairs up' },
  { key: 'stairs_down',    label: 'Stairs down' },
  { key: 'sitting',        label: 'Sitting' },
  { key: 'standing',       label: 'Standing' },
  { key: 'walking',        label: 'Walking' },
  { key: 'during_exercise', label: 'During exercise' },
  { key: 'after_exercise', label: 'After exercise' },
];

export const SYMPTOM_LABELS = Object.fromEntries(
  SYMPTOM_OPTIONS.map(({ key, label }) => [key, label])
);

export default function SymptomPicker({ selected, onChange }) {
  const toggle = (key) => {
    if (selected.includes(key)) {
      onChange(selected.filter((k) => k !== key));
    } else {
      onChange([...selected, key]);
    }
  };

  return (
    <View style={styles.wrap}>
      {SYMPTOM_OPTIONS.map(({ key, label }) => {
        const active = selected.includes(key);
        return (
          <Chip
            key={key}
            selected={active}
            showSelectedOverlay
            onPress={() => toggle(key)}
            style={styles.chip}
            compact
          >
            {label}
          </Chip>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    marginBottom: 2,
  },
});
