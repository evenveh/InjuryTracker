import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TouchableRipple } from 'react-native-paper';
import { getPainColor, PAIN_LABELS, C } from '../theme';

export default function PainSelector({ value, onChange }) {
  return (
    <View>
      <View style={styles.row}>
        {PAIN_LABELS.map((_, i) => {
          const color = getPainColor(i);
          const selected = i === value;
          const filled = i <= value;
          return (
            <TouchableRipple
              key={i}
              onPress={() => onChange(i)}
              borderless
              style={[
                styles.btn,
                { backgroundColor: filled ? color : C.inner },
                selected && styles.btnSelected,
              ]}
            >
              <Text
                style={[
                  styles.btnText,
                  { color: filled ? '#fff' : C.muted },
                ]}
              >
                {i}
              </Text>
            </TouchableRipple>
          );
        })}
      </View>
      <Text style={[styles.label, { color: getPainColor(value) }]}>
        {PAIN_LABELS[value]}
      </Text>
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
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnSelected: {
    transform: [{ scale: 1.25 }],
    borderWidth: 2,
    borderColor: C.text,
  },
  btnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  label: {
    textAlign: 'center',
    marginTop: 12,
    fontSize: 14,
    fontWeight: '700',
  },
});
