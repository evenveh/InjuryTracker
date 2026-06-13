import * as SQLite from 'expo-sqlite';

let _db = null;

function getDb() {
  if (!_db) {
    _db = SQLite.openDatabaseSync('kneetracker.db');
  }
  return _db;
}

export function initDatabase() {
  const db = getDb();
  db.execSync('PRAGMA journal_mode=WAL');
  db.execSync('PRAGMA foreign_keys=ON');

  db.execSync(
    'CREATE TABLE IF NOT EXISTS db_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)'
  );
  db.execSync(`
    CREATE TABLE IF NOT EXISTS logs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      date       TEXT UNIQUE NOT NULL,
      pain_level INTEGER DEFAULT 0,
      notes      TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  db.execSync(`
    CREATE TABLE IF NOT EXISTS symptoms (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      log_id      INTEGER NOT NULL,
      trigger_key TEXT NOT NULL,
      FOREIGN KEY (log_id) REFERENCES logs(id) ON DELETE CASCADE
    )
  `);
  db.execSync(`
    CREATE TABLE IF NOT EXISTS activities (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      log_id       INTEGER NOT NULL,
      type         TEXT NOT NULL,
      duration_min INTEGER,
      notes        TEXT DEFAULT '',
      FOREIGN KEY (log_id) REFERENCES logs(id) ON DELETE CASCADE
    )
  `);
  db.execSync(`
    CREATE TABLE IF NOT EXISTS exercises (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_id INTEGER NOT NULL,
      name        TEXT NOT NULL,
      order_idx   INTEGER DEFAULT 0,
      FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
    )
  `);
  db.execSync(`
    CREATE TABLE IF NOT EXISTS exercise_sets (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise_id INTEGER NOT NULL,
      set_number  INTEGER NOT NULL,
      weight_kg   REAL,
      reps        INTEGER,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
    )
  `);
}

// ─── Logs ────────────────────────────────────────────────────────────────────

export function getOrCreateLog(date) {
  const db = getDb();
  const now = new Date().toISOString();
  let log = db.getFirstSync('SELECT * FROM logs WHERE date = ?', [date]);
  if (!log) {
    db.runSync(
      'INSERT INTO logs (date, pain_level, notes, created_at, updated_at) VALUES (?, 0, ?, ?, ?)',
      [date, '', now, now]
    );
    log = db.getFirstSync('SELECT * FROM logs WHERE date = ?', [date]);
  }
  return log;
}

export function updateLog(logId, { painLevel, notes }) {
  const db = getDb();
  db.runSync(
    'UPDATE logs SET pain_level = ?, notes = ?, updated_at = ? WHERE id = ?',
    [painLevel, notes, new Date().toISOString(), logId]
  );
}

export function getAllLogs() {
  return getDb().getAllSync('SELECT * FROM logs ORDER BY date DESC');
}

// Removes a day's row only if nothing was actually entered (pain 0, no notes,
// no symptoms, no activities). Used when browsing back through past days so
// merely *viewing* a day doesn't leave an empty entry in the history.
export function deleteLogIfEmpty(date) {
  const db = getDb();
  const log = db.getFirstSync('SELECT * FROM logs WHERE date = ?', [date]);
  if (!log) return;
  if (log.pain_level !== 0 || (log.notes && log.notes.trim() !== '')) return;
  if (db.getFirstSync('SELECT 1 FROM symptoms WHERE log_id = ? LIMIT 1', [log.id])) return;
  if (db.getFirstSync('SELECT 1 FROM activities WHERE log_id = ? LIMIT 1', [log.id])) return;
  db.runSync('DELETE FROM logs WHERE id = ?', [log.id]);
}

// ─── Meta (small key/value settings) ─────────────────────────────────────────
// Reuses the db_meta table. Used to remember the export folder the user picked
// via the Storage Access Framework so we don't prompt on every save.

export function getMeta(key) {
  const row = getDb().getFirstSync('SELECT value FROM db_meta WHERE key = ?', [key]);
  return row ? row.value : null;
}

export function setMeta(key, value) {
  getDb().runSync(
    'INSERT INTO db_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  );
}

export function getLogWithDetails(date) {
  const db = getDb();
  const log = db.getFirstSync('SELECT * FROM logs WHERE date = ?', [date]);
  if (!log) return null;

  log.symptoms = db
    .getAllSync('SELECT trigger_key FROM symptoms WHERE log_id = ?', [log.id])
    .map((r) => r.trigger_key);

  log.activities = db.getAllSync(
    'SELECT * FROM activities WHERE log_id = ? ORDER BY id',
    [log.id]
  );

  for (const act of log.activities) {
    if (act.type === 'styrke') {
      act.exercises = _loadExercises(db, act.id);
    }
  }

  return log;
}

// ─── Symptoms ─────────────────────────────────────────────────────────────────

export function getSymptomsForLog(logId) {
  return getDb()
    .getAllSync('SELECT trigger_key FROM symptoms WHERE log_id = ?', [logId])
    .map((r) => r.trigger_key);
}

export function saveSymptomsForLog(logId, triggerKeys) {
  const db = getDb();
  db.runSync('DELETE FROM symptoms WHERE log_id = ?', [logId]);
  for (const key of triggerKeys) {
    db.runSync(
      'INSERT INTO symptoms (log_id, trigger_key) VALUES (?, ?)',
      [logId, key]
    );
  }
}

// ─── Activities ───────────────────────────────────────────────────────────────

export function getActivitiesForLog(logId) {
  const db = getDb();
  const activities = db.getAllSync(
    'SELECT * FROM activities WHERE log_id = ? ORDER BY id',
    [logId]
  );
  for (const act of activities) {
    if (act.type === 'styrke') {
      act.exercises = _loadExercises(db, act.id);
    }
  }
  return activities;
}

export function createActivity(logId, { type, durationMin, notes }) {
  const db = getDb();
  const result = db.runSync(
    'INSERT INTO activities (log_id, type, duration_min, notes) VALUES (?, ?, ?, ?)',
    [logId, type, durationMin ?? null, notes ?? '']
  );
  return result.lastInsertRowId;
}

export function removeActivity(activityId) {
  getDb().runSync('DELETE FROM activities WHERE id = ?', [activityId]);
}

// ─── Exercises ────────────────────────────────────────────────────────────────

export function createExercise(activityId, name, orderIdx) {
  const db = getDb();
  const result = db.runSync(
    'INSERT INTO exercises (activity_id, name, order_idx) VALUES (?, ?, ?)',
    [activityId, name, orderIdx ?? 0]
  );
  return result.lastInsertRowId;
}

export function createExerciseSet(exerciseId, setNumber, weightKg, reps) {
  const db = getDb();
  const result = db.runSync(
    'INSERT INTO exercise_sets (exercise_id, set_number, weight_kg, reps) VALUES (?, ?, ?, ?)',
    [exerciseId, setNumber, weightKg ?? null, reps ?? null]
  );
  return result.lastInsertRowId;
}

function _loadExercises(db, activityId) {
  const exercises = db.getAllSync(
    'SELECT * FROM exercises WHERE activity_id = ? ORDER BY order_idx',
    [activityId]
  );
  for (const ex of exercises) {
    ex.sets = db.getAllSync(
      'SELECT * FROM exercise_sets WHERE exercise_id = ? ORDER BY set_number',
      [ex.id]
    );
  }
  return exercises;
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function getFullExportData() {
  const db = getDb();
  const logs = db.getAllSync('SELECT * FROM logs ORDER BY date');

  for (const log of logs) {
    log.symptoms = db
      .getAllSync('SELECT trigger_key FROM symptoms WHERE log_id = ?', [log.id])
      .map((r) => r.trigger_key);

    log.activities = db.getAllSync(
      'SELECT * FROM activities WHERE log_id = ? ORDER BY id',
      [log.id]
    );

    for (const act of log.activities) {
      if (act.type === 'styrke') {
        act.exercises = _loadExercises(db, act.id);
      }
    }
  }

  return logs;
}
