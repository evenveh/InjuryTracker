import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const COLORS = [
  '#22c55e', // 0
  '#4ade80', // 1
  '#86efac', // 2
  '#fbbf24', // 3
  '#fb923c', // 4
  '#f97316', // 5
  '#f87171', // 6
  '#ef4444', // 7
  '#dc2626', // 8
  '#b91c1c', // 9
  '#7f1d1d', // 10
];

const LABELS = [
  'None',
  'Minimal',
  'Very mild',
  'Mild',
  'Moderate',
  'Noticeable',
  'Uncomfortable',
  'Strong',
  'Intense',
  'Very strong',
  'Worst imaginable',
];

export default function PainSelector({ value, onChange }) {
  return (
    <View>
      <View style={styles.row}>
        {COLORS.map((color, i) => {
          const selected = i === value;
          const filled = i <= value;
          return (
            <TouchableOpacity
              key={i}
              onPress={() => onChange(i)}
              style={[
                styles.btn,
                { backgroundColor: filled ? color : '#1e1e35' },
                selected && styles.btnSelected,
              ]}
              activeOpacity={0.7}
            >
              <Text style={[styles.btnText, selected && styles.btnTextSelected]}>
                {i}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[styles.label, { color: COLORS[value] }]}>{LABELS[value]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  btn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnSelected: {
    transform: [{ scale: 1.25 }],
    borderWidth: 2,
    borderColor: '#fff',
  },
  btnText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '600',
  },
  btnTextSelected: {
    color: '#fff',
  },
  label: {
    textAlign: 'center',
    marginTop: 10,
    fontSize: 13,
    fontWeight: '600',
  },
});
