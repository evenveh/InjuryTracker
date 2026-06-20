import React, { useState, useEffect } from 'react';
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
  TouchableRipple,
} from 'react-native-paper';
import {
  createActivity,
  createExercise,
  createExerciseSet,
  removeActivity,
  updateActivity,
  deleteExercisesForActivity,
  getExerciseNames,
} from '../database/db';
import { C, RADIUS } from '../theme';

export const ACTIVITY_TYPES = [
  { key: 'styrke',   label: 'Strength',          icon: 'dumbbell' },
  { key: 'sykling',  label: 'Cycling',           icon: 'bike',  distance: true },
  { key: 'staking',  label: 'Ski erg / Poling',  icon: 'ski',   distance: true },
  { key: 'svomming', label: 'Swimming',          icon: 'swim',  distance: true },
  { key: 'tur',      label: 'Walk',              icon: 'walk',  distance: true },
  { key: 'standing', label: 'Standing',          icon: 'human' },
  { key: 'ellipse',  label: 'Elliptical',        icon: 'orbit', distance: true },
  { key: 'lopning',  label: 'Running',           icon: 'run',   distance: true },
  { key: 'annet',    label: 'Other',             icon: 'flash' },
];

// Activity-type keys that track a distance (km) — derived from the flag above,
// so adding/removing one is a one-line change in ACTIVITY_TYPES.
const DISTANCE_TYPES = new Set(
  ACTIVITY_TYPES.filter((t) => t.distance).map((t) => t.key)
);

// Parse a decimal the user typed, accepting BOTH comma and period as the
// decimal separator. JS parseFloat only understands "72.5"; a Norwegian
// decimal-pad keyboard emits a comma ("72,5"), which plain parseFloat would
// silently truncate to 72. Normalise comma → period first so both read alike.
// Returns null for blank/unparseable input.
const parseDecimal = (text) => {
  const n = parseFloat(String(text).replace(',', '.'));
  return Number.isNaN(n) ? null : n;
};

export const ACTIVITY_LABEL = Object.fromEntries(
  ACTIVITY_TYPES.map(({ key, label }) => [key, label])
);

export const ACTIVITY_ICON = Object.fromEntries(
  ACTIVITY_TYPES.map(({ key, icon }) => [key, icon])
);

// ─── Add-activity modal ────────────────────────────────────────────────────────

function AddModal({ visible, editActivity, onClose, onSaved }) {
  const [type, setType] = useState(null);
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  const [notes, setNotes] = useState('');
  // exercises: [{ name, sets: [{ weight, reps }] }]
  const [exercises, setExercises] = useState([]);

  // Known exercise names (for type-ahead) + which exercise row is focused.
  const [knownNames, setKnownNames] = useState([]);
  const [focusedEx, setFocusedEx] = useState(null);

  // When the sheet opens: load known names, and either prefill from the activity
  // being edited or start blank for a new one.
  useEffect(() => {
    if (!visible) return;
    setKnownNames(getExerciseNames());
    if (editActivity) {
      setType(editActivity.type);
      setDuration(editActivity.duration_min != null ? String(editActivity.duration_min) : '');
      setDistance(editActivity.distance_km != null ? String(editActivity.distance_km) : '');
      setNotes(editActivity.notes || '');
      setExercises(
        (editActivity.exercises || []).map((ex) => ({
          name: ex.name,
          sets: (ex.sets || []).map((st) => ({
            weight: st.weight_kg != null ? String(st.weight_kg) : '',
            reps: st.reps != null ? String(st.reps) : '',
          })),
        }))
      );
    } else {
      setType(null);
      setDuration('');
      setDistance('');
      setNotes('');
      setExercises([]);
    }
  }, [visible, editActivity]);

  // Up to 5 known names that contain the typed text (but aren't already an
  // exact match), so tapping one reuses the existing spelling.
  const suggestionsFor = (text) => {
    const t = text.trim().toLowerCase();
    if (!t) return [];
    return knownNames
      .filter((n) => n.toLowerCase().includes(t) && n.toLowerCase() !== t)
      .slice(0, 5);
  };

  const reset = () => {
    setType(null);
    setDuration('');
    setDistance('');
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
      distanceKm: DISTANCE_TYPES.has(type) && distance ? parseDecimal(distance) : null,
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
            <Text variant="titleLarge" style={m.title}>
              {editActivity ? 'Edit activity' : 'Add activity'}
            </Text>
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

            {/* Distance — only for distance-based activity types */}
            {type && DISTANCE_TYPES.has(type) && (
              <TextInput
                mode="outlined"
                label="Distance (km)"
                style={m.input}
                value={distance}
                onChangeText={setDistance}
                keyboardType="decimal-pad"
                placeholder="e.g. 5"
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
                          onFocus={() => setFocusedEx(exIdx)}
                          onBlur={() =>
                            // delay so a suggestion tap registers before we hide
                            setTimeout(
                              () => setFocusedEx((cur) => (cur === exIdx ? null : cur)),
                              150
                            )
                          }
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

                      {focusedEx === exIdx && suggestionsFor(ex.name).length > 0 && (
                        <View style={m.suggestions}>
                          {suggestionsFor(ex.name).map((name) => (
                            <TouchableRipple
                              key={name}
                              onPress={() => {
                                setExName(exIdx, name);
                                setFocusedEx(null);
                              }}
                            >
                              <Text style={m.suggestionItem}>{name}</Text>
                            </TouchableRipple>
                          ))}
                        </View>
                      )}

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
                {editActivity ? 'Save changes' : 'Save activity'}
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
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // activity being edited, or null

  const openCreate = () => { setEditTarget(null); setModalOpen(true); };
  const openEdit = (act) => { setEditTarget(act); setModalOpen(true); };

  // Insert the strength exercises/sets from the form under a given activity id.
  const insertExercises = (actId, exercises) => {
    exercises.forEach((ex, exIdx) => {
      if (!ex.name.trim()) return;
      const exId = createExercise(actId, ex.name.trim(), exIdx);
      ex.sets.forEach((s, si) => {
        // `|| null` keeps the old behaviour: an explicit 0 means "bodyweight",
        // stored as NULL (same as a blank weight), not 0 kg.
        const w = parseDecimal(s.weight) || null;
        const r = parseInt(s.reps, 10) || null;
        if (w !== null || r !== null) createExerciseSet(exId, si + 1, w, r);
      });
    });
  };

  const handleSaved = ({ type, durationMin, distanceKm, notes, exercises }) => {
    if (editTarget) {
      // Update the row, then replace its exercises/sets wholesale.
      updateActivity(editTarget.id, { type, durationMin, distanceKm, notes });
      deleteExercisesForActivity(editTarget.id);
      if (type === 'styrke') insertExercises(editTarget.id, exercises);
    } else {
      const actId = createActivity(logId, { type, durationMin, distanceKm, notes });
      if (type === 'styrke') insertExercises(actId, exercises);
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
        <Card key={act.id} mode="contained" style={s.row} onPress={() => openEdit(act)}>
          <Card.Title
            title={
              ACTIVITY_LABEL[act.type] +
              (act.duration_min ? `  ·  ${act.duration_min} min` : '') +
              (act.distance_km ? `  ·  ${act.distance_km} km` : '')
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
        onPress={openCreate}
        style={s.addBtn}
      >
        Add activity
      </Button>

      <AddModal
        visible={modalOpen}
        editActivity={editTarget}
        onClose={() => setModalOpen(false)}
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
  suggestions: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: RADIUS.sm,
    backgroundColor: C.card,
    marginBottom: 8,
    overflow: 'hidden',
  },
  suggestionItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: C.text,
    fontSize: 14,
  },
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
