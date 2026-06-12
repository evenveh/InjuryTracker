import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { getAllLogs, getLogWithDetails } from '../database/db';
import { SYMPTOM_LABELS } from '../components/SymptomPicker';
import { ACTIVITY_LABEL } from '../components/ActivityList';

const C = {
  bg: '#0f0f1a',
  card: '#1a1a2e',
  inner: '#13131f',
  accent: '#4cc9f0',
  text: '#e0e0e0',
  muted: '#777',
  border: '#2d2d4e',
};

function getPainColor(level) {
  const colors = [
    '#22c55e','#4ade80','#86efac','#fbbf24','#fb923c',
    '#f97316','#f87171','#ef4444','#dc2626','#b91c1c','#7f1d1d',
  ];
  return colors[Math.min(level, 10)];
}

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={d.header}>
        <TouchableOpacity onPress={onBack} style={d.backBtn}>
          <Text style={{ color: C.accent, fontSize: 16 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={d.headerDate}>{formatDate(date)}</Text>
      </View>

      <ScrollView contentContainerStyle={d.content}>
        {/* Pain */}
        <View style={d.section}>
          <Text style={d.sectionLabel}>Pain</Text>
          <View
            style={[
              d.painBadge,
              {
                backgroundColor: getPainColor(log.pain_level) + '22',
                borderColor: getPainColor(log.pain_level),
              },
            ]}
          >
            <Text style={[d.painValue, { color: getPainColor(log.pain_level) }]}>
              {log.pain_level} / 10
            </Text>
          </View>
        </View>

        {/* Symptoms */}
        {log.symptoms?.length > 0 && (
          <View style={d.section}>
            <Text style={d.sectionLabel}>Symptoms</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {log.symptoms.map((key) => (
                <View key={key} style={d.chip}>
                  <Text style={d.chipText}>{SYMPTOM_LABELS[key] || key}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Activities */}
        {log.activities?.length > 0 && (
          <View style={d.section}>
            <Text style={d.sectionLabel}>Activities</Text>
            {log.activities.map((act, i) => (
              <View key={i} style={d.actCard}>
                <Text style={d.actTitle}>
                  {ACTIVITY_LABEL[act.type] || act.type}
                  {act.duration_min ? `  ·  ${act.duration_min} min` : ''}
                </Text>

                {act.exercises?.map((ex, j) => (
                  <View key={j} style={d.exBlock}>
                    <Text style={d.exName}>{ex.name}</Text>
                    {ex.sets?.map((s, k) => (
                      <Text key={k} style={d.setLine}>
                        Set {s.set_number}:{' '}
                        {s.weight_kg !== null ? `${s.weight_kg} kg` : '–'} ×{' '}
                        {s.reps || '–'} reps
                      </Text>
                    ))}
                  </View>
                ))}

                {act.notes ? (
                  <Text style={d.actNotes}>{act.notes}</Text>
                ) : null}
              </View>
            ))}
          </View>
        )}

        {/* Notes */}
        {log.notes ? (
          <View style={d.section}>
            <Text style={d.sectionLabel}>Notes</Text>
            <Text style={d.notesText}>{log.notes}</Text>
          </View>
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
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <FlatList
        data={logs}
        keyExtractor={(item) => item.date}
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        renderItem={({ item }) => {
          const color = getPainColor(item.pain_level);
          return (
            <TouchableOpacity
              style={l.row}
              onPress={() => setSelected(item.date)}
              activeOpacity={0.7}
            >
              <View style={[l.badge, { backgroundColor: color }]}>
                <Text style={l.badgeText}>{item.pain_level}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={l.date}>{formatDate(item.date)}</Text>
                {item.notes ? (
                  <Text style={l.preview} numberOfLines={1}>
                    {item.notes}
                  </Text>
                ) : null}
              </View>
              <Text style={{ color: C.muted, fontSize: 22 }}>›</Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 80 }}>
            <Text style={{ color: C.muted, fontSize: 16, textAlign: 'center' }}>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
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
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: { marginBottom: 6 },
  headerDate: {
    color: C.text,
    fontSize: 18,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  content: { padding: 16, paddingBottom: 48 },
  section: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  sectionLabel: {
    color: C.muted,
    fontSize: 11,
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
  chip: {
    backgroundColor: C.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: { color: C.text, fontSize: 13 },
  actCard: {
    backgroundColor: C.inner,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  actTitle: { color: C.text, fontSize: 14, fontWeight: '700', marginBottom: 6 },
  exBlock: { marginLeft: 8, marginBottom: 6 },
  exName: { color: C.accent, fontSize: 13, fontWeight: '600', marginBottom: 3 },
  setLine: { color: C.muted, fontSize: 12, marginBottom: 1 },
  actNotes: { color: C.muted, fontSize: 12, fontStyle: 'italic', marginTop: 4 },
  notesText: { color: C.text, fontSize: 15, lineHeight: 22 },
});
