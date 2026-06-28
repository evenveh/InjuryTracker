import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Card, Button, TextInput, IconButton, Icon } from 'react-native-paper';
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
import {
  todayStr,
  addDays,
  formatFullDate,
  formatWeekdayDate,
} from '../utils/date';

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

  // Everything autosaves, so navigating is just a switch (switchTo cleans up the
  // day we leave if it ended up empty).
  const goToDate = (date) => switchTo(date);

  const refreshActivities = () => {
    if (!log) return;
    setActivities(getActivitiesForLog(log.id));
  };

  // Autosave: write each change to SQLite immediately, so nothing depends on
  // remembering to press a button. Pain and symptoms are discrete taps; notes
  // write per keystroke (cheap for local SQLite, and the value stays controlled
  // so the caret doesn't jump). Each handler reads the other fields from the
  // current render's state, so the row written always has the latest values.
  const changePain = (val) => {
    setPainLevel(val);
    if (log) updateLog(log.id, { painLevel: val, notes });
  };
  const changeNotes = (text) => {
    setNotes(text);
    if (log) updateLog(log.id, { painLevel, notes: text });
  };
  const changeSymptoms = (next) => {
    setSymptoms(next);
    if (log) saveSymptomsForLog(log.id, next);
  };

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
                {formatFullDate(viewDate)}
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
            <PainSelector value={painLevel} onChange={changePain} />
          </SectionCard>

          <SectionCard title="SYMPTOMS">
            <SymptomPicker selected={symptoms} onChange={changeSymptoms} />
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
              onChangeText={changeNotes}
              placeholder="Write notes here…"
              multiline
            />
          </SectionCard>

          <View style={s.savedRow}>
            <Icon source="check-circle" size={16} color={C.accent} />
            <Text style={s.savedText}>Saved automatically</Text>
          </View>

          {/* Previous-day context */}
          {prevLog && (
            <Card mode="contained" style={s.yesterdayCard}>
              <Card.Content>
                <Text variant="labelSmall" style={s.sectionLabel}>
                  PREVIOUS DAY · {formatWeekdayDate(prevDate).toUpperCase()}
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
  savedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16 },
  savedText: { color: C.muted, fontSize: 13 },
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
