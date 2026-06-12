import React, { useState, useCallback, useEffect } from 'react';
import { View, FlatList, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Text,
  Card,
  Chip,
  Appbar,
  TouchableRipple,
  Icon,
} from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';

import { getAllLogs, getLogWithDetails } from '../database/db';
import { SYMPTOM_LABELS } from '../components/SymptomPicker';
import { ACTIVITY_LABEL, ACTIVITY_ICON } from '../components/ActivityList';
import { C, getPainColor } from '../theme';

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ─── Detail view ──────────────────────────────────────────────────────────────

function DetailView({ date, onBack }) {
  const [log, setLog] = useState(null);

  useEffect(() => {
    setLog(getLogWithDetails(date));
  }, [date]);

  if (!log) return null;

  const painColor = getPainColor(log.pain_level);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['left', 'right']}>
      <Appbar.Header style={{ backgroundColor: C.card }}>
        <Appbar.BackAction onPress={onBack} color={C.accent} />
        <Appbar.Content
          title={formatDate(date)}
          titleStyle={{ fontSize: 17, fontWeight: '700', textTransform: 'capitalize' }}
        />
      </Appbar.Header>

      <ScrollView contentContainerStyle={d.content}>
        {/* Pain */}
        <Card mode="elevated" elevation={2} style={d.section}>
          <Card.Content>
            <Text variant="labelSmall" style={d.sectionLabel}>PAIN</Text>
            <View
              style={[
                d.painBadge,
                { backgroundColor: painColor + '22', borderColor: painColor },
              ]}
            >
              <Text style={[d.painValue, { color: painColor }]}>
                {log.pain_level} / 10
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Symptoms */}
        {log.symptoms?.length > 0 && (
          <Card mode="elevated" elevation={2} style={d.section}>
            <Card.Content>
              <Text variant="labelSmall" style={d.sectionLabel}>SYMPTOMS</Text>
              <View style={d.chipWrap}>
                {log.symptoms.map((key) => (
                  <Chip key={key} compact style={d.chip}>
                    {SYMPTOM_LABELS[key] || key}
                  </Chip>
                ))}
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Activities */}
        {log.activities?.length > 0 && (
          <Card mode="elevated" elevation={2} style={d.section}>
            <Card.Content>
              <Text variant="labelSmall" style={d.sectionLabel}>ACTIVITIES</Text>
              {log.activities.map((act, i) => (
                <Card key={i} mode="contained" style={d.actCard}>
                  <Card.Content>
                    <View style={d.actTitleRow}>
                      <Icon source={ACTIVITY_ICON[act.type] || 'flash'} size={18} color={C.accent} />
                      <Text style={d.actTitle}>
                        {ACTIVITY_LABEL[act.type] || act.type}
                        {act.duration_min ? `  ·  ${act.duration_min} min` : ''}
                      </Text>
                    </View>

                    {act.exercises?.map((ex, j) => (
                      <View key={j} style={d.exBlock}>
                        <Text style={d.exName}>{ex.name}</Text>
                        {ex.sets?.map((sset, k) => (
                          <Text key={k} style={d.setLine}>
                            Set {sset.set_number}:{' '}
                            {sset.weight_kg !== null ? `${sset.weight_kg} kg` : '–'} ×{' '}
                            {sset.reps || '–'} reps
                          </Text>
                        ))}
                      </View>
                    ))}

                    {act.notes ? <Text style={d.actNotes}>{act.notes}</Text> : null}
                  </Card.Content>
                </Card>
              ))}
            </Card.Content>
          </Card>
        )}

        {/* Notes */}
        {log.notes ? (
          <Card mode="elevated" elevation={2} style={d.section}>
            <Card.Content>
              <Text variant="labelSmall" style={d.sectionLabel}>NOTES</Text>
              <Text style={d.notesText}>{log.notes}</Text>
            </Card.Content>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── List view ────────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const [logs, setLogs] = useState([]);
  const [selected, setSelected] = useState(null);

  useFocusEffect(
    useCallback(() => {
      setLogs(getAllLogs());
    }, [])
  );

  if (selected) {
    return <DetailView date={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['left', 'right']}>
      <FlatList
        data={logs}
        keyExtractor={(item) => item.date}
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        renderItem={({ item }) => {
          const color = getPainColor(item.pain_level);
          return (
            <Card mode="elevated" elevation={2} style={l.card}>
              <TouchableRipple
                borderless
                onPress={() => setSelected(item.date)}
                style={l.ripple}
              >
                <View style={l.row}>
                  <View style={[l.badge, { backgroundColor: color }]}>
                    <Text style={l.badgeText}>{item.pain_level}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={l.date}>{formatDate(item.date)}</Text>
                    {item.notes ? (
                      <Text style={l.preview} numberOfLines={1}>{item.notes}</Text>
                    ) : null}
                  </View>
                  <Icon source="chevron-right" size={24} color={C.muted} />
                </View>
              </TouchableRipple>
            </Card>
          );
        }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 80 }}>
            <Icon source="notebook-outline" size={48} color={C.muted} />
            <Text style={{ color: C.muted, fontSize: 16, textAlign: 'center', marginTop: 12 }}>
              No entries yet.{'\n'}Start logging today!
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const l = StyleSheet.create({
  card: { marginBottom: 8 },
  ripple: { borderRadius: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  badge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  date: { color: C.text, fontSize: 14, fontWeight: '600', textTransform: 'capitalize' },
  preview: { color: C.muted, fontSize: 12, marginTop: 2 },
});

const d = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48 },
  section: { marginBottom: 12 },
  sectionLabel: {
    color: C.muted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  painBadge: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    borderWidth: 2,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  painValue: { fontSize: 26, fontWeight: '800' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: C.inner },
  actCard: { backgroundColor: C.inner, marginBottom: 8 },
  actTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  actTitle: { color: C.text, fontSize: 14, fontWeight: '700' },
  exBlock: { marginLeft: 8, marginBottom: 6 },
  exName: { color: C.accent, fontSize: 13, fontWeight: '600', marginBottom: 3 },
  setLine: { color: C.muted, fontSize: 12, marginBottom: 1 },
  actNotes: { color: C.muted, fontSize: 12, fontStyle: 'italic', marginTop: 4 },
  notesText: { color: C.text, fontSize: 15, lineHeight: 22 },
});
