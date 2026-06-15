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

  // ── Migrations ──────────────────────────────────────────────────────────────
  // `CREATE TABLE IF NOT EXISTS` never alters a table that already exists, so a
  // new column must be added with ALTER TABLE on existing installs. The guard
  // makes it idempotent (runs once, then the column is already there). Old rows
  // get NULL for the new column, which is exactly "distance unknown".
  if (!_columnExists(db, 'activities', 'distance_km')) {
    db.execSync('ALTER TABLE activities ADD COLUMN distance_km REAL');
  }
}

function _columnExists(db, table, column) {
  return db
    .getAllSync(`PRAGMA table_info(${table})`)
    .some((c) => c.name === column);
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

export function createActivity(logId, { type, durationMin, distanceKm, notes }) {
  const db = getDb();
  const result = db.runSync(
    'INSERT INTO activities (log_id, type, duration_min, distance_km, notes) VALUES (?, ?, ?, ?, ?)',
    [logId, type, durationMin ?? null, distanceKm ?? null, notes ?? '']
  );
  return result.lastInsertRowId;
}

export function removeActivity(activityId) {
  getDb().runSync('DELETE FROM activities WHERE id = ?', [activityId]);
}

export function updateActivity(activityId, { type, durationMin, distanceKm, notes }) {
  getDb().runSync(
    'UPDATE activities SET type = ?, duration_min = ?, distance_km = ?, notes = ? WHERE id = ?',
    [type, durationMin ?? null, distanceKm ?? null, notes ?? '', activityId]
  );
}

// Removes an activity's exercises; their sets cascade-delete (FK ON DELETE
// CASCADE). Used when re-saving an edited strength activity: we wipe the old
// exercises/sets and re-insert from the edited form.
export function deleteExercisesForActivity(activityId) {
  getDb().runSync('DELETE FROM exercises WHERE activity_id = ?', [activityId]);
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

// Distinct exercise names already logged, most-used first. Drives the
// type-ahead suggestions so the same exercise is named consistently and can be
// grouped for analysis later.
export function getExerciseNames() {
  return getDb()
    .getAllSync(
      `SELECT name FROM exercises
       WHERE TRIM(name) <> ''
       GROUP BY name
       ORDER BY COUNT(*) DESC, name COLLATE NOCASE`
    )
    .map((r) => r.name);
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

// Import a JSON backup (same shape as getFullExportData). Each day in the file
// OVERWRITES that date: pain/notes set, symptoms replaced, activities replaced.
// Dates not in the file are left untouched. Wrapped in a transaction so a bad
// file can't leave a half-imported state. Returns { days, activities }.
export function importBackup(logs) {
  const db = getDb();
  if (!Array.isArray(logs)) throw new Error('Backup must be a list of day entries.');

  let days = 0;
  let activities = 0;
  db.execSync('BEGIN');
  try {
    for (const log of logs) {
      if (!log || typeof log.date !== 'string') continue;
      const row = getOrCreateLog(log.date);
      updateLog(row.id, { painLevel: log.pain_level ?? 0, notes: log.notes ?? '' });
      saveSymptomsForLog(row.id, Array.isArray(log.symptoms) ? log.symptoms : []);

      // Replace the day's activities (cascade clears exercises/sets).
      db.runSync('DELETE FROM activities WHERE log_id = ?', [row.id]);
      for (const act of log.activities || []) {
        const actId = createActivity(row.id, {
          type: act.type,
          durationMin: act.duration_min ?? null,
          distanceKm: act.distance_km ?? null,
          notes: act.notes ?? '',
        });
        activities++;
        for (const ex of act.exercises || []) {
          const exId = createExercise(actId, (ex.name || '').trim(), ex.order_idx ?? 0);
          (ex.sets || []).forEach((st, i) =>
            createExerciseSet(exId, st.set_number ?? i + 1, st.weight_kg ?? null, st.reps ?? null)
          );
        }
      }
      days++;
    }
    db.execSync('COMMIT');
  } catch (e) {
    db.execSync('ROLLBACK');
    throw e;
  }
  return { days, activities };
}

// ─── Insights / analytics ─────────────────────────────────────────────────────

// Next calendar day for a YYYY-MM-DD key, built from local date parts (never via
// toISOString — that would shift across the UTC boundary, see TodayScreen).
function nextDateStr(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + 1);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

// Pain per logged day, oldest first — for the pain-over-time chart.
export function getPainSeries() {
  return getDb().getAllSync('SELECT date, pain_level FROM logs ORDER BY date ASC');
}

// For each activity type: average pain on the same day and the NEXT day, vs the
// overall baseline. Next-day matters because pain often shows up a day later.
// `n` = number of distinct days the activity was done. Sorted most-provoking
// (highest next-day average) first.
export function getActivityImpact() {
  const db = getDb();
  const logs = db.getAllSync('SELECT date, pain_level FROM logs');
  if (logs.length === 0) return { baseline: null, items: [] };

  const painByDate = {};
  let sum = 0;
  for (const l of logs) {
    painByDate[l.date] = l.pain_level;
    sum += l.pain_level;
  }
  const baseline = sum / logs.length;

  // One row per (type, day) the activity happened.
  const rows = db.getAllSync(
    `SELECT DISTINCT a.type AS type, l.date AS date
     FROM activities a JOIN logs l ON a.log_id = l.id`
  );

  const datesByType = {};
  for (const r of rows) {
    if (!datesByType[r.type]) datesByType[r.type] = [];
    datesByType[r.type].push(r.date);
  }

  const items = Object.keys(datesByType).map((type) => {
    const dates = datesByType[type];
    let sameSum = 0, sameN = 0, nextSum = 0, nextN = 0;
    for (const d of dates) {
      if (painByDate[d] != null) { sameSum += painByDate[d]; sameN++; }
      const nd = nextDateStr(d);
      if (painByDate[nd] != null) { nextSum += painByDate[nd]; nextN++; }
    }
    return {
      type,
      n: dates.length,
      sameDayAvg: sameN ? sameSum / sameN : null,
      nextDayAvg: nextN ? nextSum / nextN : null,
      nextDayN: nextN,
    };
  });

  // Most-provoking first; types without any next-day data fall to the bottom.
  items.sort((a, b) => {
    const av = a.nextDayAvg == null ? -Infinity : a.nextDayAvg;
    const bv = b.nextDayAvg == null ? -Infinity : b.nextDayAvg;
    return bv - av;
  });

  return { baseline, items };
}

// Same as getActivityImpact, but at the EXERCISE level (squats/deadlifts load the
// knee very differently than bench/biceps, so a single "Strength" average can
// hide the real signal). Links exercise → activity → log → date, then next-day
// pain. Relies on consistent exercise names (the type-ahead in the add sheet).
export function getExerciseImpact() {
  const db = getDb();
  const logs = db.getAllSync('SELECT date, pain_level FROM logs');
  if (logs.length === 0) return { baseline: null, items: [] };

  const painByDate = {};
  let sum = 0;
  for (const l of logs) { painByDate[l.date] = l.pain_level; sum += l.pain_level; }
  const baseline = sum / logs.length;

  const rows = db.getAllSync(
    `SELECT DISTINCT e.name AS name, l.date AS date
     FROM exercises e
     JOIN activities a ON e.activity_id = a.id
     JOIN logs l ON a.log_id = l.id
     WHERE TRIM(e.name) <> ''`
  );

  const datesByName = {};
  for (const r of rows) {
    if (!datesByName[r.name]) datesByName[r.name] = [];
    datesByName[r.name].push(r.date);
  }

  const items = Object.keys(datesByName).map((name) => {
    const dates = datesByName[name];
    let sameSum = 0, sameN = 0, nextSum = 0, nextN = 0;
    for (const d of dates) {
      if (painByDate[d] != null) { sameSum += painByDate[d]; sameN++; }
      const nd = nextDateStr(d);
      if (painByDate[nd] != null) { nextSum += painByDate[nd]; nextN++; }
    }
    return {
      name,
      n: dates.length,
      sameDayAvg: sameN ? sameSum / sameN : null,
      nextDayAvg: nextN ? nextSum / nextN : null,
    };
  });

  items.sort((a, b) => {
    const av = a.nextDayAvg == null ? -Infinity : a.nextDayAvg;
    const bv = b.nextDayAvg == null ? -Infinity : b.nextDayAvg;
    return bv - av;
  });

  return { baseline, items };
}

// Daily training "load" = total activity minutes that day. We bucket each day
// and show the average NEXT-day pain per bucket — does a harder day cost more
// the day after?
const LOAD_BINS = [
  { label: 'Rest day', test: (v) => v === 0 },
  { label: 'Light (≤45 min)', test: (v) => v > 0 && v <= 45 },
  { label: 'Hard (>45 min)', test: (v) => v > 45 },
];

export function getLoadVsPain() {
  const db = getDb();
  const logs = db.getAllSync('SELECT date, pain_level FROM logs');
  if (logs.length === 0) return { bins: [], baseline: null };

  const painByDate = {};
  let sum = 0;
  for (const l of logs) { painByDate[l.date] = l.pain_level; sum += l.pain_level; }
  const baseline = sum / logs.length;

  // Total minutes per logged day (0 on days with no activities).
  const loadRows = db.getAllSync(
    `SELECT l.date AS date, COALESCE(SUM(a.duration_min), 0) AS load
     FROM logs l LEFT JOIN activities a ON a.log_id = l.id
     GROUP BY l.date`
  );

  const acc = LOAD_BINS.map(() => ({ sum: 0, n: 0 }));
  for (const r of loadRows) {
    const nd = nextDateStr(r.date);
    if (painByDate[nd] == null) continue; // need a next-day pain to attribute
    const idx = LOAD_BINS.findIndex((b) => b.test(r.load));
    if (idx < 0) continue;
    acc[idx].sum += painByDate[nd];
    acc[idx].n += 1;
  }

  const bins = LOAD_BINS.map((b, i) => ({
    label: b.label,
    n: acc[i].n,
    avgNextPain: acc[i].n ? acc[i].sum / acc[i].n : null,
  }));
  return { bins, baseline };
}

// How often each symptom occurs and the average pain on those days,
// most-frequent first.
export function getSymptomStats() {
  return getDb().getAllSync(
    `SELECT s.trigger_key AS key, COUNT(*) AS n, AVG(l.pain_level) AS avgPain
     FROM symptoms s JOIN logs l ON s.log_id = l.id
     GROUP BY s.trigger_key
     ORDER BY n DESC, avgPain DESC`
  );
}
