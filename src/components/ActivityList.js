import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  createActivity,
  createExercise,
  createExerciseSet,
  removeActivity,
  getActivitiesForLog,
} from '../database/db';

const C = {
  bg: '#0f0f1a',
  card: '#1a1a2e',
  inner: '#13131f',
  accent: '#4cc9f0',
  text: '#e0e0e0',
  muted: '#777',
  border: '#2d2d4e',
  danger: '#ef4444',
};

export const ACTIVITY_TYPES = [
  { key: 'styrke',   label: '🏋️  Strength' },
  { key: 'sykling',  label: '🚴  Cycling' },
  { key: 'staking',  label: '⛷️  Ski erg / Poling' },
  { key: 'svomming', label: '🏊  Swimming' },
  { key: 'tur',      label: '🚶  Walk' },
  { key: 'ellipse',  label: '🔄  Elliptical' },
  { key: 'lopning',  label: '🏃  Running' },
  { key: 'annet',    label: '⚡  Other' },
];

export const ACTIVITY_LABEL = Object.fromEntries(
  ACTIVITY_TYPES.map(({ key, label }) => [key, label])
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
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={m.overlay}>
          <View style={m.sheet}>
            {/* Header */}
            <View style={m.header}>
              <Text style={m.title}>Add activity</Text>
              <TouchableOpacity onPress={close} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={{ color: C.muted, fontSize: 22 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={m.body}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 32 }}
            >
              {/* Type */}
              <Text style={m.label}>Type</Text>
              <View style={m.typeGrid}>
                {ACTIVITY_TYPES.map(({ key, label }) => (
                  <TouchableOpacity
                    key={key}
                    style={[m.typeChip, type === key && m.typeChipActive]}
                    onPress={() => setType(key)}
                    activeOpacity={0.7}
                  >
                    <Text style={[m.typeChipText, type === key && m.typeChipTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Duration */}
              {type && (
                <>
                  <Text style={m.label}>Duration (min)</Text>
                  <TextInput
                    style={m.input}
                    value={duration}
                    onChangeText={setDuration}
                    keyboardType="numeric"
                    placeholder="e.g. 60"
                    placeholderTextColor={C.muted}
                  />
                </>
              )}

              {/* Exercises (styrke only) */}
              {type === 'styrke' && (
                <>
                  <Text style={m.label}>Exercises</Text>
                  {exercises.map((ex, exIdx) => (
                    <View key={exIdx} style={m.exCard}>
                      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                        <TextInput
                          style={[m.input, { flex: 1, marginBottom: 0 }]}
                          value={ex.name}
                          onChangeText={(v) => setExName(exIdx, v)}
                          placeholder="Exercise (e.g. Deadlift)"
                          placeholderTextColor={C.muted}
                        />
                        <TouchableOpacity
                          onPress={() => removeExercise(exIdx)}
                          style={m.iconBtn}
                        >
                          <Text style={{ color: C.danger, fontSize: 18 }}>✕</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Sets header */}
                      <View style={m.setsRow}>
                        <Text style={[m.setCell, m.setHeader]}>Set</Text>
                        <Text style={[m.setCell, m.setHeader]}>Kg</Text>
                        <Text style={[m.setCell, m.setHeader]}>Reps</Text>
                        <View style={{ width: 28 }} />
                      </View>

                      {ex.sets.map((s, si) => (
                        <View key={si} style={m.setsRow}>
                          <Text style={[m.setCell, { color: C.muted }]}>{si + 1}</Text>
                          <TextInput
                            style={[m.setInput, m.setCell]}
                            value={s.weight}
                            onChangeText={(v) => editSet(exIdx, si, 'weight', v)}
                            keyboardType="decimal-pad"
                            placeholder="0"
                            placeholderTextColor={C.muted}
                          />
                          <TextInput
                            style={[m.setInput, m.setCell]}
                            value={s.reps}
                            onChangeText={(v) => editSet(exIdx, si, 'reps', v)}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor={C.muted}
                          />
                          <TouchableOpacity onPress={() => removeSet(exIdx, si)}>
                            <Text style={{ color: C.danger, width: 28, textAlign: 'center' }}>−</Text>
                          </TouchableOpacity>
                        </View>
                      ))}

                      <TouchableOpacity
                        style={m.addSetBtn}
                        onPress={() => addSet(exIdx)}
                      >
                        <Text style={{ color: C.accent, fontSize: 13 }}>+ Add set</Text>
                      </TouchableOpacity>
                    </View>
                  ))}

                  <TouchableOpacity style={m.addExBtn} onPress={addExercise}>
                    <Text style={{ color: C.accent, fontWeight: '700' }}>+ Add exercise</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Notes */}
              {type && (
                <>
                  <Text style={m.label}>Notes</Text>
                  <TextInput
                    style={[m.input, { minHeight: 56, textAlignVertical: 'top' }]}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Comments..."
                    placeholderTextColor={C.muted}
                    multiline
                  />
                </>
              )}

              {type && (
                <TouchableOpacity style={m.saveBtn} onPress={handleSave}>
                  <Text style={m.saveBtnText}>Save activity</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
        <View key={act.id} style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.actType}>
              {ACTIVITY_LABEL[act.type] || act.type}
              {act.duration_min ? `  ·  ${act.duration_min} min` : ''}
            </Text>
            {act.type === 'styrke' && exerciseSummary(act) ? (
              <Text style={s.exSummary}>{exerciseSummary(act)}</Text>
            ) : null}
            {act.notes ? <Text style={s.actNotes}>{act.notes}</Text> : null}
          </View>
          <TouchableOpacity onPress={() => confirmDelete(act.id)} style={s.deleteBtn}>
            <Text style={{ color: C.danger, fontSize: 16 }}>🗑</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity style={s.addBtn} onPress={() => setShowModal(true)}>
        <Text style={s.addBtnText}>+ Add activity</Text>
      </TouchableOpacity>

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
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: C.inner,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  actType: { color: C.text, fontSize: 14, fontWeight: '700' },
  exSummary: { color: C.muted, fontSize: 12, marginTop: 4, lineHeight: 18 },
  actNotes: { color: C.muted, fontSize: 12, marginTop: 2, fontStyle: 'italic' },
  deleteBtn: { padding: 4, marginLeft: 8 },
  addBtn: {
    borderWidth: 1,
    borderColor: C.accent,
    borderRadius: 8,
    borderStyle: 'dashed',
    padding: 12,
    alignItems: 'center',
  },
  addBtnText: { color: C.accent, fontSize: 14, fontWeight: '700' },
});

const m = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  title: { color: C.text, fontSize: 18, fontWeight: '700' },
  body: { padding: 16 },
  label: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
    marginTop: 16,
  },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.inner,
  },
  typeChipActive: { backgroundColor: C.accent, borderColor: C.accent },
  typeChipText: { color: C.muted, fontSize: 13 },
  typeChipTextActive: { color: '#000', fontWeight: '700' },
  input: {
    backgroundColor: C.inner,
    borderRadius: 8,
    padding: 12,
    color: C.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 8,
  },
  exCard: {
    backgroundColor: C.bg,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  iconBtn: { padding: 10, justifyContent: 'center' },
  setsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  setCell: { flex: 1, textAlign: 'center', color: C.text, fontSize: 13 },
  setHeader: { color: C.muted, fontSize: 11, fontWeight: '700' },
  setInput: {
    backgroundColor: C.card,
    borderRadius: 6,
    padding: 8,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: C.border,
    marginHorizontal: 2,
  },
  addSetBtn: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 4,
  },
  addExBtn: {
    borderWidth: 1,
    borderColor: C.accent,
    borderRadius: 8,
    borderStyle: 'dashed',
    padding: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  saveBtn: {
    backgroundColor: C.accent,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  saveBtnText: { color: '#000', fontSize: 16, fontWeight: '700' },
});
