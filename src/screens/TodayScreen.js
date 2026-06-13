import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Card, Button, TextInput, IconButton } from 'react-native-paper';
import { useFocusEffect, useRoute, useNavigation } from '@react-navigation/native';

import {
  getOrCreateLog,
  updateLog,
  getSymptomsForLog,
  saveSymptomsForLog,
  getActivitiesForLog,
  getLogWithDetails,
  deleteLogIfEmpty,
} from '../database/db';
import PainSelector from '../components/PainSelector';
import SymptomPicker, { SYMPTOM_LABELS } from '../components/SymptomPicker';
import ActivityList, { ACTIVITY_LABEL } from '../components/ActivityList';
import { C, getPainColor } from '../theme';

// Local-date key "YYYY-MM-DD". Never use toISOString() for these: it converts
// to UTC, which in a positive-offset timezone (e.g. CEST = UTC+2) rolls the date
// back a day — that made "+1 day" cancel out (forward nav did nothing) and
// "-1 day" jump two days back.
function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayStr() {
  return toDateStr(new Date());
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return toDateStr(d);
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

function formatShort(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
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
  const route = useRoute();
  const navigation = useNavigation();

  const [viewDate, setViewDate] = useState(todayStr());
  const viewDateRef = useRef(viewDate);
  viewDateRef.current = viewDate;

  const [log, setLog] = useState(null);
  const [painLevel, setPainLevel] = useState(0);
  const [notes, setNotes] = useState('');
  const [symptoms, setSymptoms] = useState([]);
  const [activities, setActivities] = useState([]);
  const [prevLog, setPrevLog] = useState(null);
  const [dirty, setDirty] = useState(false);

  const today = todayStr();
  const isToday = viewDate === today;
  const prevDate = addDays(viewDate, -1);
  const nextDate = addDays(viewDate, 1);

  const loadDay = useCallback((date) => {
    const l = getOrCreateLog(date);
    setLog(l);
    setPainLevel(l.pain_level);
    setNotes(l.notes || '');
    setSymptoms(getSymptomsForLog(l.id));
    setActivities(getActivitiesForLog(l.id));
    setDirty(false);
    setPrevLog(getLogWithDetails(addDays(date, -1)));
  }, []);

  // Reload whenever the screen regains focus (e.g. coming back from History).
  // On blur, drop the viewed day if it's an untouched past day, so merely
  // browsing back doesn't leave empty entries in the history.
  useFocusEffect(
    useCallback(() => {
      // Opened from History's "Edit" button → jump to that date.
      const paramDate = route.params?.date;
      if (paramDate) {
        navigation.setParams({ date: undefined });
        if (viewDateRef.current !== todayStr() && viewDateRef.current !== paramDate) {
          deleteLogIfEmpty(viewDateRef.current);
        }
        viewDateRef.current = paramDate;
        setViewDate(paramDate);
        loadDay(paramDate);
      } else {
        loadDay(viewDateRef.current);
      }
      return () => {
        if (viewDateRef.current !== todayStr()) {
          deleteLogIfEmpty(viewDateRef.current);
        }
      };
    }, [loadDay, route.params?.date, navigation])
  );

  const switchTo = (date) => {
    if (date > today) return; // can't log the future
    // Clean up the day we're leaving if it's an untouched past day.
    if (viewDate !== today) deleteLogIfEmpty(viewDate);
    setViewDate(date);
    loadDay(date);
  };

  const goToDate = (date) => {
    if (dirty) {
      Alert.alert(
        'Unsaved changes',
        'Leave this day without saving?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Leave', style: 'destructive', onPress: () => switchTo(date) },
        ]
      );
      return;
    }
    switchTo(date);
  };

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
    Alert.alert('Saved ✓', isToday ? 'Your log has been updated.' : `Log for ${formatShort(viewDate)} saved.`);
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
          {/* Date navigation */}
          <View style={s.dateNav}>
            <IconButton
              icon="chevron-left"
              size={28}
              onPress={() => goToDate(prevDate)}
              iconColor={C.accent}
            />
            <View style={s.dateCenter}>
              <Text
                variant="titleMedium"
                style={[s.dateHeader, !isToday && { color: C.warn }]}
              >
                {formatDate(viewDate)}
              </Text>
              {!isToday && (
                <Button
                  compact
                  icon="calendar-today"
                  onPress={() => goToDate(today)}
                  textColor={C.muted}
                >
                  Back to today
                </Button>
              )}
            </View>
            <IconButton
              icon="chevron-right"
              size={28}
              onPress={() => goToDate(nextDate)}
              disabled={isToday}
              iconColor={C.accent}
            />
          </View>

          <SectionCard title="PAIN">
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

          {/* Previous-day context */}
          {prevLog && (
            <Card mode="contained" style={s.yesterdayCard}>
              <Card.Content>
                <Text variant="labelSmall" style={s.sectionLabel}>
                  PREVIOUS DAY · {formatShort(prevDate).toUpperCase()}
                </Text>
                <View style={s.yesterdayRow}>
                  <View
                    style={[
                      s.painDot,
                      { backgroundColor: getPainColor(prevLog.pain_level) },
                    ]}
                  >
                    <Text style={s.painDotText}>{prevLog.pain_level}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    {prevLog.activities?.length > 0 && (
                      <Text style={s.ydActivity}>
                        {prevLog.activities
                          .map((a) => ACTIVITY_LABEL[a.type] || a.type)
                          .join(', ')}
                      </Text>
                    )}
                    {prevLog.symptoms?.length > 0 && (
                      <Text style={s.ydSymptoms}>
                        {prevLog.symptoms
                          .map((k) => SYMPTOM_LABELS[k] || k)
                          .join(', ')}
                      </Text>
                    )}
                    {prevLog.notes ? (
                      <Text style={s.ydNotes} numberOfLines={2}>
                        {prevLog.notes}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <Text style={s.ydHint}>Pain can show up the next day</Text>
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
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateCenter: { flex: 1, alignItems: 'center' },
  dateHeader: {
    color: C.accent,
    fontWeight: '700',
    textTransform: 'capitalize',
    textAlign: 'center',
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
  ydHint: { color: C.muted, fontSize: 11, fontStyle: 'italic', marginTop: 10 },
});
