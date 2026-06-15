---
name: import-log
description: Convert a free-text day-by-day training/injury log (pain, symptoms, activities, strength sets — typically Norwegian) into a JSON backup the app can import, then load it onto the phone. Use whenever the user pastes a multi-day log and wants it added as history.
---

# Import a free-text training/injury log

Turn a pasted day-by-day log into a JSON backup in the app's export format, push it to the
phone, and let the user load it via **Export → Import JSON backup**. The in-app import
(`importBackup` in `src/database/db.js`) **overwrites each date in the file** and leaves
other dates untouched, so it's safe to re-run.

## 1. Ask the user first (these are judgement calls)

- **Anchor date.** Get one fixed mapping, e.g. *"Day 59 = Wednesday 3 June 2026"*, and
  compute the rest backwards. The weekdays written in the log are a free correctness check.
- **Pain scale.** Default is **mild 0–3** (below). Confirm or adjust.
- **Exercise names — MUST be English.** Confirm the mapping table, especially ambiguous
  ones (e.g. "strak mark" vs "RDL" — ask if they're the same exercise).
- **Symptom tagging from text?** Default yes.
- **Record exercises with no weight/reps?** Default yes (occurrence drives per-exercise
  analysis).

## 2. JSON format (must match the app's export)

An array of day objects — same shape as `getFullExportData()`:

```jsonc
[{
  "date": "YYYY-MM-DD",
  "pain_level": 0,            // 0–10 (we use 0–3)
  "notes": "original text kept verbatim",
  "symptoms": ["stairs_up", ...],     // language-independent KEYS (see below)
  "activities": [{
    "type": "styrke",                  // activity-type KEY (see below)
    "duration_min": null,              // number or null
    "distance_km": null,
    "notes": "",
    "exercises": [{
      "name": "Deadlift",              // ENGLISH, consistent spelling
      "order_idx": 0,
      "sets": [{ "set_number": 1, "weight_kg": 120, "reps": 5 }]
    }]
  }]
}]
```

## 3. Canonical keys (labels are derived — wrong keys import but show raw)

- **Activity types:** `styrke` `sykling` `staking` `svomming` `tur` `standing` `ellipse`
  `lopning` `annet`
- **Symptom keys:** `morning` `stairs_up` `stairs_down` `sitting` `sitting_down`
  `standing_up` `walking` `during_exercise` `after_exercise`

(Source of truth: `ACTIVITY_TYPES` in `src/components/ActivityList.js`, `SYMPTOM_OPTIONS`
in `src/components/SymptomPicker.js`. Check there before inventing a key.)

## 4. Norwegian → app mappings (reference)

**Activities:** sykling→`sykling` · staking/skiergo/ski erg→`staking` · svømming→`svomming` ·
tur/gåtur/skritt/steg→`tur` · ellipse→`ellipse` · løping→`lopning` · stå/ståing→`standing`.
Cardio gets `duration_min` when minutes are stated; strength gets `null` duration (the
exercises carry the detail).

**Exercises (write the English name):** Markløft→**Deadlift** · Knebøy→**Squat** · Knebøy
til boks→**Box squat** · RDL→**Romanian deadlift** · Strak mark→**Stiff-leg deadlift**
*(confirm — may be the same as RDL for this user)* · Leg curl→**Leg curl** · Hip
thrust→**Hip thrust** · Benkpress→**Bench press** · Bulgarsk utfall→**Bulgarian split
squat** · Utfall→**Lunge** · glutemaskin→**Glute machine**.

**Pain (mild 0–3):** Bra/Ok/Ingen/Greit/Smertefri = **0** · Småstikking/lett sårhet/litt
stikking/"ish" = **1** · Litt sår/mer sårt = **2** · Definitivt mer sår / sår ned trappene /
verst = **3**.

**Symptoms from wording:** trappa/opp trappene→`stairs_up` · ned trappene→`stairs_down` ·
morgenen/starten av dagen→`morning` · sitting→`sitting` · under økta→`during_exercise` ·
i etterkant/kvelden etter trening→`after_exercise` · mye gåing/steg/feltstevne→`walking`.

## 5. Generate the file

Adapt **`scripts/gen-import.js`** (kept as the template). It has helpers
(`ex` / `strength` / `cardio` / `walk`), a `D{}` day map, a date anchor (`DAY1`), and
expands day-ranges (e.g. `[12,13,14,15].forEach(...)`). Edit the day map for the new log,
then:

```bash
node scripts/gen-import.js     # writes injury_log_import.json + a sanity summary
```

Eyeball the summary: day count, first/last date, activities-by-type, pain distribution.
Sets: `[weight, reps]`; use `null` for unknowns (`[[null,5]]` = 5 reps no weight,
`[[140,null]]` = 140 kg reps unknown). Record a named exercise even with empty `sets`.

## 6. Load onto the phone

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb -s RFGL10GT15W push injury_log_import.json /sdcard/Download/injury_log_import.json
```

Then in the app: **Export → Import JSON backup → pick the file (Download) → confirm**. The
dialog states the day count. (adb id `RFGL10GT15W`; if it's `unauthorized`, wake+unlock the
phone — see the `/install-app` skill, gotcha #9.)

## Gotchas

- **Dates from LOCAL parts, never `toISOString()`** (UTC rolls the date back a day — see
  `dateForDay` in the generator and CLAUDE.md gotcha #14). Verify a couple of weekdays.
- **Exercise names must be consistent and English** — the per-exercise insight groups by
  exact `name`, so "Squat" and "squat" would split into two.
- **Import overwrites** a date's pain/notes/symptoms/activities; dates absent from the file
  are kept. Safe to re-run after fixing the generator.
- The JSON holds **personal health data** — offer to `.gitignore` it (and the generator is
  fine to keep as a template).
