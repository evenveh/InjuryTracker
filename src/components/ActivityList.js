import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
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
  Snackbar,
} from 'react-native-paper';
import {
  createActivity,
  removeActivity,
  updateActivity,
  deleteExercisesForActivity,
  replaceActivityExercises,
  deleteActivityIfEmpty,
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

// ─── Caret-stable text input ────────────────────────────────────────────────────
//
// A drop-in wrapper around Paper's TextInput that stops the caret from jumping
// backwards while you edit existing text.
//
// Why it's needed: every field below is *controlled* — its `value` comes from
// React state that lives up in AddModal. On Android, RN only leaves the native
// caret alone when the `value` it re-applies is exactly what's already on screen.
// A keystroke re-renders the whole (heavy) form, and if the new `value` arrives a
// frame late, RN reprograms the native text and drops the caret at a default
// spot — i.e. it "jumps back". You only notice it when the caret was mid-text
// (e.g. capitalising the last word), which is why blank fields feel fine.
//
// The fix: each field owns its text *locally*, so the value handed to the native
// input is always exactly what was just typed (set synchronously in onChangeText).
// A heavy parent re-render can no longer feed back a stale value. We only adopt
// the parent's `value` when it changes for an outside reason — tapping a name
// suggestion, or loading a saved day to edit.
function StableTextInput({ value, onChangeText, ...props }) {
  const [text, setText] = useState(value ?? '');

  useEffect(() => {
    // After a keystroke, `value` has already caught up to `text`, so this is a
    // no-op and the caret stays put. It only fires on genuine outside changes.
    if ((value ?? '') !== text) setText(value ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <TextInput
      {...props}
      value={text}
      onChangeText={(t) => {
        setText(t);
        onChangeText?.(t);
      }}
    />
  );
}

// ─── Add-activity modal ────────────────────────────────────────────────────────

function AddModal({ visible, editActivity, onClose, onFlush }) {
  const [type, setType] = useState(null);
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  const [notes, setNotes] = useState('');
  // exercises: [{ name, sets: [{ weight, reps }] }]
  const [exercises, setExercises] = useState([]);

  // Known exercise names (for type-ahead) + which exercise row is focused.
  const [knownNames, setKnownNames] = useState([]);
  const [focusedEx, setFocusedEx] = useState(null);

  // Pending debounced-autosave timer, so we can cancel it when the sheet closes.
  const saveTimer = useRef(null);

  // The last exercise/set the user removed, kept so the "Undo" snackbar can put
  // it back at the exact spot. Cleared when the snackbar dismisses. Deleting is
  // now persisted by autosave within ~500 ms, so this undo is the safety net
  // against an accidental tap on the (small, finger-sized) delete buttons.
  const [undoItem, setUndoItem] = useState(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  // When the sheet opens: load known names, and either prefill from the activity
  // being edited or start blank for a new one. This is also our *only* place that
  // clears the form — we deliberately do NOT reset on close, because resetting
  // while the modal is still animating out makes its content visibly collapse
  // (everything is gated on `type`). useLayoutEffect runs before the first paint,
  // so opening shows the right content with no flash.
  useLayoutEffect(() => {
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

  // Snapshot of the current form, in the shape ActivityList.flush expects.
  // Exercises stay as raw form strings; flush() parses them.
  const buildPayload = () => ({
    type,
    durationMin: duration ? parseInt(duration, 10) : null,
    distanceKm: DISTANCE_TYPES.has(type) && distance ? parseDecimal(distance) : null,
    notes,
    exercises: type === 'styrke' ? exercises : [],
  });

  // Autosave: ~500 ms after the user stops changing the form, persist it. Each
  // change reschedules the timer (classic debounce), so we write once per pause
  // instead of on every keystroke. This is what makes the workout survive even
  // if the sheet is dismissed — there's a saved copy in the database within half
  // a second of any edit. flush() no-ops until a type is chosen.
  useEffect(() => {
    if (!visible) return;
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      onFlush(buildPayload());
    }, 500);
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, type, duration, distance, notes, exercises]);

  const close = () => {
    // Cancel any pending debounce and do one final synchronous flush, so closing
    // by any means (outside tap, back button, X) keeps the latest edits. We do
    // NOT clear the form here — that happens on the next open (see the layout
    // effect above) so the content doesn't collapse mid-close-animation.
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    // Hide the undo snackbar too — it lives in the same Portal and would
    // otherwise linger on screen after the sheet is gone (AddModal stays mounted).
    setSnackbarVisible(false);
    setUndoItem(null);
    onFlush(buildPayload());
    onClose();
  };

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

  const removeSet = (exIdx, setIdx) => {
    // Capture the set (and where it was) before removing, so Undo can restore it.
    setUndoItem({ kind: 'set', exIdx, setIdx, set: exercises[exIdx].sets[setIdx] });
    setSnackbarVisible(true);
    setExercises((prev) =>
      prev.map((ex, i) =>
        i === exIdx
          ? { ...ex, sets: ex.sets.filter((_, si) => si !== setIdx) }
          : ex
      )
    );
  };

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

  const removeExercise = (i) => {
    setUndoItem({ kind: 'exercise', index: i, exercise: exercises[i] });
    setSnackbarVisible(true);
    setExercises((prev) => prev.filter((_, idx) => idx !== i));
  };

  // Put the last-removed exercise/set back where it was. State changes again, so
  // autosave re-persists the restored workout automatically.
  const undoDelete = () => {
    if (!undoItem) return;
    if (undoItem.kind === 'exercise') {
      setExercises((prev) => {
        const next = [...prev];
        next.splice(undoItem.index, 0, undoItem.exercise);
        return next;
      });
    } else {
      setExercises((prev) =>
        prev.map((ex, i) => {
          if (i !== undoItem.exIdx) return ex;
          const sets = [...ex.sets];
          sets.splice(undoItem.setIdx, 0, undoItem.set);
          return { ...ex, sets };
        })
      );
    }
    setUndoItem(null);
    setSnackbarVisible(false);
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
              <StableTextInput
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
              <StableTextInput
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
                        <StableTextInput
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
                          <StableTextInput
                            mode="outlined"
                            style={[m.setInput, m.setCell]}
                            value={s.weight}
                            onChangeText={(v) => editSet(exIdx, si, 'weight', v)}
                            keyboardType="decimal-pad"
                            placeholder="0"
                            dense
                          />
                          <StableTextInput
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
              <StableTextInput
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
                onPress={close}
                style={m.saveBtn}
                contentStyle={{ paddingVertical: 6 }}
              >
                Done
              </Button>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Undo for the no-confirm exercise/set delete buttons. Rendered as a
          sibling of the Modal (later in the same Portal) so it floats above the
          sheet at the bottom of the screen. */}
      <Snackbar
        visible={snackbarVisible}
        // Keep `undoItem` set during the fade-out so the message doesn't flip;
        // it's harmless to leave until the next delete overwrites it.
        onDismiss={() => setSnackbarVisible(false)}
        duration={4000}
        action={{ label: 'Undo', onPress: undoDelete }}
      >
        {undoItem?.kind === 'exercise' ? 'Exercise removed' : 'Set removed'}
      </Snackbar>
    </Portal>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function ActivityList({ activities, logId, onChange }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // activity being edited, or null

  // The activity row the open sheet writes to. Created lazily on the first flush
  // of a *new* activity; for an edit it's the existing row's id. A ref (not
  // state) so autosave can read/write it without forcing re-renders.
  const currentActivityIdRef = useRef(null);

  const openCreate = () => {
    setEditTarget(null);
    currentActivityIdRef.current = null;
    setModalOpen(true);
  };
  const openEdit = (act) => {
    setEditTarget(act);
    currentActivityIdRef.current = null;
    setModalOpen(true);
  };

  // Parse the form's string weight/reps into numbers (0 → null = bodyweight),
  // matching the old insert behaviour. Shape: [{ name, sets: [{ weightKg, reps }] }].
  const parseExercises = (exercises) =>
    exercises.map((ex) => ({
      name: ex.name,
      sets: (ex.sets || []).map((s) => ({
        weightKg: parseDecimal(s.weight) || null,
        reps: parseInt(s.reps, 10) || null,
      })),
    }));

  // Autosave flush from the sheet: write the current form to the database. Runs
  // (debounced) on every change and once synchronously when the sheet closes, so
  // a workout can never be lost by dismissing the sheet. The activity row is
  // created on the first flush that has a type; later flushes update that row.
  const flush = (payload) => {
    if (!payload.type) return; // no type chosen yet → nothing meaningful to save
    let id = currentActivityIdRef.current;
    if (id == null) {
      if (editTarget) {
        id = editTarget.id;
        updateActivity(id, payload);
      } else {
        id = createActivity(logId, payload);
      }
      currentActivityIdRef.current = id;
    } else {
      updateActivity(id, payload);
    }
    if (payload.type === 'styrke') {
      replaceActivityExercises(id, parseExercises(payload.exercises));
    } else {
      // Type changed away from strength → drop any leftover exercises.
      deleteExercisesForActivity(id);
    }
  };

  // Sheet closed (any way): drop the row if the user left it empty, then refresh
  // the list so the day reflects whatever was autosaved.
  const handleClose = () => {
    deleteActivityIfEmpty(currentActivityIdRef.current);
    currentActivityIdRef.current = null;
    setModalOpen(false);
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
        onClose={handleClose}
        onFlush={flush}
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
