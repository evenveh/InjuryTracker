import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Text,
  Button,
  IconButton,
  TextInput,
  Chip,
  Card,
  Portal,
  Modal,
  Divider,
} from 'react-native-paper';
import {
  createActivity,
  createExercise,
  createExerciseSet,
  removeActivity,
} from '../database/db';
import { C } from '../theme';

export const ACTIVITY_TYPES = [
  { key: 'styrke',   label: 'Strength',          icon: 'dumbbell' },
  { key: 'sykling',  label: 'Cycling',           icon: 'bike' },
  { key: 'staking',  label: 'Ski erg / Poling',  icon: 'ski' },
  { key: 'svomming', label: 'Swimming',          icon: 'swim' },
  { key: 'tur',      label: 'Walk',              icon: 'walk' },
  { key: 'standing', label: 'Standing',          icon: 'human' },
  { key: 'ellipse',  label: 'Elliptical',        icon: 'orbit' },
  { key: 'lopning',  label: 'Running',           icon: 'run' },
  { key: 'annet',    label: 'Other',             icon: 'flash' },
];

export const ACTIVITY_LABEL = Object.fromEntries(
  ACTIVITY_TYPES.map(({ key, label }) => [key, label])
);

export const ACTIVITY_ICON = Object.fromEntries(
  ACTIVITY_TYPES.map(({ key, icon }) => [key, icon])
);

// ─── Add-activity modal ────────────────────────────────────────────────────────

function AddModal({ visible, onClose, onSaved }) {
  const [type, setType] = useState(null);
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  // exercises: [{ name, sets: [{ weight, reps }] }]
  const [exercises, setExercises] = useState([]);

  const reset = () => {
    setType(null);
    setDuration('');
    setNotes('');
    setExercises([]);
  };

  const close = () => { reset(); onClose(); };

  const addExercise = () =>
    setExercises((prev) => [...prev, { name: '', sets: [{ weight: '', reps: '' }] }]);

  const setExName = (i, name) =>
    setExercises((prev) => prev.map((ex, idx) => (idx === i ? { ...ex, name } : ex)));

  const addSet = (exIdx) =>
    setExercises((prev) =>
      prev.map((ex, i) =>
        i === exIdx ? { ...ex, sets: [...ex.sets, { weight: '', reps: '' }] } : ex
      )
    );

  const removeSet = (exIdx, setIdx) =>
    setExercises((prev) =>
      prev.map((ex, i) =>
        i === exIdx
          ? { ...ex, sets: ex.sets.filter((_, si) => si !== setIdx) }
          : ex
      )
    );

  const editSet = (exIdx, setIdx, field, val) =>
    setExercises((prev) =>
      prev.map((ex, i) =>
        i === exIdx
          ? {
              ...ex,
              sets: ex.sets.map((s, si) =>
                si === setIdx ? { ...s, [field]: val } : s
              ),
            }
          : ex
      )
    );

  const removeExercise = (i) =>
    setExercises((prev) => prev.filter((_, idx) => idx !== i));

  const handleSave = () => {
    if (!type) { Alert.alert('Select an activity type'); return; }
    onSaved({
      type,
      durationMin: duration ? parseInt(duration, 10) : null,
      notes,
      exercises: type === 'styrke' ? exercises : [],
    });
    close();
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={close}
        contentContainerStyle={m.sheet}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={m.header}>
            <Text variant="titleLarge" style={m.title}>Add activity</Text>
            <IconButton icon="close" size={22} onPress={close} />
          </View>
          <Divider />

          <ScrollView
            style={m.body}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            {/* Type */}
            <Text variant="labelLarge" style={m.label}>Type</Text>
            <View style={m.typeGrid}>
              {ACTIVITY_TYPES.map(({ key, label, icon }) => (
                <Chip
                  key={key}
                  icon={icon}
                  selected={type === key}
                  showSelectedOverlay
                  onPress={() => setType(key)}
                >
                  {label}
                </Chip>
              ))}
            </View>

            {/* Duration */}
            {type && (
              <TextInput
                mode="outlined"
                label="Duration (min)"
                style={m.input}
                value={duration}
                onChangeText={setDuration}
                keyboardType="numeric"
                placeholder="e.g. 60"
                dense
              />
            )}

            {/* Exercises (styrke only) */}
            {type === 'styrke' && (
              <>
                <Text variant="labelLarge" style={m.label}>Exercises</Text>
                {exercises.map((ex, exIdx) => (
                  <Card key={exIdx} mode="contained" style={m.exCard}>
                    <Card.Content>
                      <View style={m.exNameRow}>
                        <TextInput
                          mode="outlined"
                          label="Exercise"
                          style={{ flex: 1 }}
                          value={ex.name}
                          onChangeText={(v) => setExName(exIdx, v)}
                          placeholder="e.g. Deadlift"
                          dense
                        />
                        <IconButton
                          icon="delete-outline"
                          iconColor={C.danger}
                          size={22}
                          onPress={() => removeExercise(exIdx)}
                        />
                      </View>

                      {/* Sets header */}
                      <View style={m.setsRow}>
                        <Text style={[m.setCell, m.setHeader]}>Set</Text>
                        <Text style={[m.setCell, m.setHeader]}>Kg</Text>
                        <Text style={[m.setCell, m.setHeader]}>Reps</Text>
                        <View style={{ width: 40 }} />
                      </View>

                      {ex.sets.map((s, si) => (
                        <View key={si} style={m.setsRow}>
                          <Text style={[m.setCell, { color: C.muted }]}>{si + 1}</Text>
                          <TextInput
                            mode="outlined"
                            style={[m.setInput, m.setCell]}
                            value={s.weight}
                            onChangeText={(v) => editSet(exIdx, si, 'weight', v)}
                            keyboardType="decimal-pad"
                            placeholder="0"
                            dense
                          />
                          <TextInput
                            mode="outlined"
                            style={[m.setInput, m.setCell]}
                            value={s.reps}
                            onChangeText={(v) => editSet(exIdx, si, 'reps', v)}
                            keyboardType="numeric"
                            placeholder="0"
                            dense
                          />
                          <IconButton
                            icon="minus"
                            size={18}
                            iconColor={C.danger}
                            onPress={() => removeSet(exIdx, si)}
                            style={{ width: 40, margin: 0 }}
                          />
                        </View>
                      ))}

                      <Button
                        compact
                        icon="plus"
                        onPress={() => addSet(exIdx)}
                        style={m.addSetBtn}
                      >
                        Add set
                      </Button>
                    </Card.Content>
                  </Card>
                ))}

                <Button
                  mode="outlined"
                  icon="plus"
                  onPress={addExercise}
                  style={m.addExBtn}
                >
                  Add exercise
                </Button>
              </>
            )}

            {/* Notes */}
            {type && (
              <TextInput
                mode="outlined"
                label="Notes"
                style={m.input}
                value={notes}
                onChangeText={setNotes}
                placeholder="Comments..."
                multiline
              />
            )}

            {type && (
              <Button
                mode="contained"
                icon="check"
                onPress={handleSave}
                style={m.saveBtn}
                contentStyle={{ paddingVertical: 6 }}
              >
                Save activity
              </Button>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </Portal>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function ActivityList({ activities, logId, onChange }) {
  const [showModal, setShowModal] = useState(false);

  const handleSaved = ({ type, durationMin, notes, exercises }) => {
    const actId = createActivity(logId, { type, durationMin, notes });

    if (type === 'styrke') {
      exercises.forEach((ex, exIdx) => {
        if (!ex.name.trim()) return;
        const exId = createExercise(actId, ex.name.trim(), exIdx);
        ex.sets.forEach((s, si) => {
          const w = parseFloat(s.weight) || null;
          const r = parseInt(s.reps, 10) || null;
          if (w !== null || r !== null) {
            createExerciseSet(exId, si + 1, w, r);
          }
        });
      });
    }

    onChange();
  };

  const confirmDelete = (actId) => {
    Alert.alert('Delete activity', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => { removeActivity(actId); onChange(); },
      },
    ]);
  };

  const exerciseSummary = (act) => {
    if (!act.exercises?.length) return null;
    return act.exercises
      .filter((ex) => ex.name)
      .map((ex) => {
        const setsStr = (ex.sets || [])
          .map((s) => {
            if (s.weight_kg && s.reps) return `${s.weight_kg}×${s.reps}`;
            if (s.weight_kg) return `${s.weight_kg}kg`;
            if (s.reps) return `${s.reps}r`;
            return null;
          })
          .filter(Boolean)
          .join(', ');
        return setsStr ? `${ex.name}: ${setsStr}` : ex.name;
      })
      .join('\n');
  };

  return (
    <View>
      {activities.map((act) => (
        <Card key={act.id} mode="contained" style={s.row}>
          <Card.Title
            title={
              ACTIVITY_LABEL[act.type] +
              (act.duration_min ? `  ·  ${act.duration_min} min` : '')
            }
            titleVariant="titleSmall"
            left={(props) => (
              <IconButton {...props} icon={ACTIVITY_ICON[act.type] || 'flash'} size={22} />
            )}
            right={(props) => (
              <IconButton
                {...props}
                icon="delete-outline"
                iconColor={C.danger}
                onPress={() => confirmDelete(act.id)}
              />
            )}
          />
          {(exerciseSummary(act) || act.notes) ? (
            <Card.Content style={s.rowBody}>
              {act.type === 'styrke' && exerciseSummary(act) ? (
                <Text style={s.exSummary}>{exerciseSummary(act)}</Text>
              ) : null}
              {act.notes ? <Text style={s.actNotes}>{act.notes}</Text> : null}
            </Card.Content>
          ) : null}
        </Card>
      ))}

      <Button
        mode="outlined"
        icon="plus"
        onPress={() => setShowModal(true)}
        style={s.addBtn}
      >
        Add activity
      </Button>

      <AddModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSaved={handleSaved}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  row: {
    marginBottom: 8,
    backgroundColor: C.inner,
  },
  rowBody: { paddingTop: 0, paddingBottom: 12, marginTop: -8 },
  exSummary: { color: C.muted, fontSize: 12, lineHeight: 18 },
  actNotes: { color: C.muted, fontSize: 12, marginTop: 2, fontStyle: 'italic' },
  addBtn: { marginTop: 4 },
});

const m = StyleSheet.create({
  sheet: {
    backgroundColor: C.card,
    marginHorizontal: 12,
    borderRadius: 20,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 8,
    paddingVertical: 8,
  },
  title: { fontWeight: '700' },
  body: { paddingHorizontal: 16, paddingTop: 8 },
  label: {
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 10,
    marginTop: 16,
  },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { marginTop: 16, backgroundColor: C.inner },
  exCard: { marginBottom: 10, backgroundColor: C.bg },
  exNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  setsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  setCell: { flex: 1, textAlign: 'center', color: C.text, fontSize: 13 },
  setHeader: { color: C.muted, fontSize: 11, fontWeight: '700' },
  setInput: {
    marginHorizontal: 4,
    backgroundColor: C.card,
    textAlign: 'center',
  },
  addSetBtn: { alignSelf: 'flex-start', marginTop: 4 },
  addExBtn: { marginBottom: 8 },
  saveBtn: { marginTop: 20, borderRadius: 12 },
});
