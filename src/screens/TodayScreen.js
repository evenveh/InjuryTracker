import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import {
  getOrCreateLog,
  updateLog,
  getSymptomsForLog,
  saveSymptomsForLog,
  getActivitiesForLog,
  getLogWithDetails,
} from '../database/db';
import PainSelector from '../components/PainSelector';
import SymptomPicker, { SYMPTOM_LABELS } from '../components/SymptomPicker';
import ActivityList, { ACTIVITY_LABEL } from '../components/ActivityList';

const C = {
  bg: '#0f0f1a',
  card: '#1a1a2e',
  accent: '#4cc9f0',
  text: '#e0e0e0',
  muted: '#777',
  border: '#2d2d4e',
};

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
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

function getPainColor(level) {
  const colors = [
    '#22c55e','#4ade80','#86efac','#fbbf24','#fb923c',
    '#f97316','#f87171','#ef4444','#dc2626','#b91c1c','#7f1d1d',
  ];
  return colors[Math.min(level, 10)];
}

export default function TodayScreen() {
  const today = todayStr();
  const yesterday = yesterdayStr();

  const [log, setLog] = useState(null);
  const [painLevel, setPainLevel] = useState(0);
  const [notes, setNotes] = useState('');
  const [symptoms, setSymptoms] = useState([]);
  const [activities, setActivities] = useState([]);
  const [yesterdayLog, setYesterdayLog] = useState(null);
  const [dirty, setDirty] = useState(false);

  const loadDay = useCallback(() => {
    const l = getOrCreateLog(today);
    setLog(l);
    setPainLevel(l.pain_level);
    setNotes(l.notes || '');
    setSymptoms(getSymptomsForLog(l.id));
    setActivities(getActivitiesForLog(l.id));
    setDirty(false);
    setYesterdayLog(getLogWithDetails(yesterday));
  }, [today, yesterday]);

  useFocusEffect(
    useCallback(() => { loadDay(); }, [loadDay])
  );

  const refreshActivities = () => {
    if (!log) return;
    setActivities(getActivitiesForLog(log.id));
    setDirty(true);
  };

  const handleSave = () => {
    if (!log) return;
    updateLog(log.id, { painLevel, notes });
    saveSymptomsForLog(log.id, symptoms);
    setDirty(false);
    Alert.alert('Saved ✓', 'Your log has been updated.');
  };

  const mark = (fn) => (...args) => { fn(...args); setDirty(true); };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={s.container}>
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={s.dateHeader}>{formatDate(today)}</Text>

          {/* Pain */}
          <View style={s.card}>
            <Text style={s.sectionLabel}>Pain today</Text>
            <PainSelector value={painLevel} onChange={mark(setPainLevel)} />
          </View>

          {/* Symptoms */}
          <View style={s.card}>
            <Text style={s.sectionLabel}>Symptoms</Text>
            <SymptomPicker selected={symptoms} onChange={mark(setSymptoms)} />
          </View>

          {/* Activities */}
          <View style={s.card}>
            <Text style={s.sectionLabel}>Activities</Text>
            {log && (
              <ActivityList
                activities={activities}
                logId={log.id}
                onChange={refreshActivities}
              />
            )}
          </View>

          {/* Notes */}
          <View style={s.card}>
            <Text style={s.sectionLabel}>Notes</Text>
            <TextInput
              style={s.notes}
              value={notes}
              onChangeText={mark(setNotes)}
              placeholder="Write notes here…"
              placeholderTextColor={C.muted}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Save */}
          <TouchableOpacity
            style={[s.saveBtn, dirty && s.saveBtnDirty]}
            onPress={handleSave}
            activeOpacity={0.8}
          >
            <Text style={[s.saveBtnText, dirty && { color: '#000' }]}>
              {dirty ? 'Save changes' : 'Saved'}
            </Text>
          </TouchableOpacity>

          {/* Yesterday context */}
          {yesterdayLog && (
            <View style={[s.card, s.yesterdayCard]}>
              <Text style={s.sectionLabel}>YESTERDAY — pain can show up the next day</Text>

              <View style={s.yesterdayRow}>
                <View
                  style={[
                    s.painDot,
                    { backgroundColor: getPainColor(yesterdayLog.pain_level) },
                  ]}
                >
                  <Text style={s.painDotText}>{yesterdayLog.pain_level}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  {yesterdayLog.activities?.length > 0 && (
                    <Text style={s.ydActivity}>
                      {yesterdayLog.activities
                        .map((a) => ACTIVITY_LABEL[a.type] || a.type)
                        .join(', ')}
                    </Text>
                  )}
                  {yesterdayLog.symptoms?.length > 0 && (
                    <Text style={s.ydSymptoms}>
                      {yesterdayLog.symptoms
                        .map((k) => SYMPTOM_LABELS[k] || k)
                        .join(', ')}
                    </Text>
                  )}
                  {yesterdayLog.notes ? (
                    <Text style={s.ydNotes} numberOfLines={2}>
                      {yesterdayLog.notes}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, paddingBottom: 48 },
  dateHeader: {
    color: C.accent,
    fontSize: 18,
    fontWeight: '700',
    textTransform: 'capitalize',
    marginBottom: 16,
  },
  card: {
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
    marginBottom: 14,
  },
  notes: {
    color: C.text,
    fontSize: 15,
    minHeight: 80,
    lineHeight: 22,
  },
  saveBtn: {
    backgroundColor: C.border,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  saveBtnDirty: { backgroundColor: C.accent },
  saveBtnText: { color: C.muted, fontSize: 16, fontWeight: '700' },
  yesterdayCard: { opacity: 0.8, borderColor: '#3a3a5c' },
  yesterdayRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  painDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  painDotText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  ydActivity: { color: C.text, fontSize: 13, fontWeight: '600', marginBottom: 2 },
  ydSymptoms: { color: C.muted, fontSize: 12, marginBottom: 2 },
  ydNotes: { color: C.muted, fontSize: 12, fontStyle: 'italic' },
});
