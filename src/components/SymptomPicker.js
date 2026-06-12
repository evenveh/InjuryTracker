import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export const SYMPTOM_OPTIONS = [
  { key: 'morning',         label: 'Morning stiffness' },
  { key: 'stairs_up',      label: 'Stairs up' },
  { key: 'stairs_down',    label: 'Stairs down' },
  { key: 'sitting',        label: 'Sitting' },
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
          <TouchableOpacity
            key={key}
            onPress={() => toggle(key)}
            style={[styles.chip, active && styles.chipActive]}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
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
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2d2d4e',
    backgroundColor: '#13131f',
  },
  chipActive: {
    backgroundColor: '#4cc9f0',
    borderColor: '#4cc9f0',
  },
  chipText: {
    color: '#777',
    fontSize: 13,
  },
  chipTextActive: {
    color: '#000',
    fontWeight: '700',
  },
});
