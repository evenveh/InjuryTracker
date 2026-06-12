import React, { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Card, Button, TextInput } from 'react-native-paper';
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
import { C, getPainColor } from '../theme';

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

function SectionCard({ title, children, style }) {
  return (
    <Card mode="elevated" style={[s.card, style]} elevation={2}>
      <Card.Content>
        <Text variant="labelSmall" style={s.sectionLabel}>{title}</Text>
        {children}
      </Card.Content>
    </Card>
  );
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
      <SafeAreaView style={s.container} edges={['left', 'right']}>
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text variant="titleMedium" style={s.dateHeader}>{formatDate(today)}</Text>

          <SectionCard title="PAIN TODAY">
            <PainSelector value={painLevel} onChange={mark(setPainLevel)} />
          </SectionCard>

          <SectionCard title="SYMPTOMS">
            <SymptomPicker selected={symptoms} onChange={mark(setSymptoms)} />
          </SectionCard>

          <SectionCard title="ACTIVITIES">
            {log && (
              <ActivityList
                activities={activities}
                logId={log.id}
                onChange={refreshActivities}
              />
            )}
          </SectionCard>

          <SectionCard title="NOTES">
            <TextInput
              mode="outlined"
              style={s.notes}
              value={notes}
              onChangeText={mark(setNotes)}
              placeholder="Write notes here…"
              multiline
            />
          </SectionCard>

          <Button
            mode="contained"
            icon={dirty ? 'content-save' : 'check'}
            onPress={handleSave}
            disabled={!dirty}
            style={s.saveBtn}
            contentStyle={{ paddingVertical: 6 }}
          >
            {dirty ? 'Save changes' : 'Saved'}
          </Button>

          {yesterdayLog && (
            <Card mode="contained" style={s.yesterdayCard}>
              <Card.Content>
                <Text variant="labelSmall" style={s.sectionLabel}>
                  YESTERDAY — pain can show up the next day
                </Text>
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
              </Card.Content>
            </Card>
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
    fontWeight: '700',
    textTransform: 'capitalize',
    marginBottom: 16,
  },
  card: { marginBottom: 12 },
  sectionLabel: {
    color: C.muted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 14,
  },
  notes: { backgroundColor: C.inner, minHeight: 80 },
  saveBtn: { marginBottom: 16, borderRadius: 12 },
  yesterdayCard: { backgroundColor: C.inner, opacity: 0.92 },
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
