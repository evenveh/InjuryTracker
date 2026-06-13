# Injury Tracker

A personal Android app for tracking a knee injury day by day — pain level (0–10),
symptoms, and activities (strength training with sets/reps, cardio with duration).
The goal is to spot **what provokes the injury and what doesn't**. All data is stored
locally on the phone and can be exported to CSV/JSON for a physiotherapist.

## Features

- **Per-day logging** — pain level, symptoms, activities, and free-text notes.
- **Back-fill past days** — `‹ / ›` date navigation on the Today screen to fill in a day
  you forgot. Browsing past empty days never leaves blank entries behind.
- **Activities with detail** — strength (exercises → sets → weight/reps), or cardio with a
  duration. Each activity type has its own icon.
- **History** — a scrollable list; tap a day to see the full detail, then ✏️ to edit it.
- **"Previous day" context** on Today — pain often shows up the day *after* an activity.
- **Export** — CSV (UTF-8 BOM, opens cleanly in Excel) and a full JSON backup, shared via
  the Android share sheet.
- **Offline & private** — everything lives in a local SQLite database; nothing leaves the
  phone. Data survives app updates (same `applicationId` + signing key).

## Tech stack

- **Expo SDK 56** / **React Native 0.85** — bare workflow (the `android/` project is
  committed, and the app is built with Gradle rather than `expo prebuild`).
- **expo-sqlite** — local storage.
- **@react-navigation/bottom-tabs** — three tabs: Today / History / Export.
- **react-native-paper** (Material Design 3, light theme) — UI components.
- **@expo/vector-icons** (`MaterialCommunityIcons`) — icons, loaded via `expo-font` (the
  `.ttf` bundles into the APK, so no native icon linking is needed).
- **expo-file-system** + **expo-sharing** — CSV/JSON export.
- JS engine: **Hermes**.

## Project layout

```
index.js                      registerRootComponent(App)
App.js                        PaperProvider + navigation + DB init
src/theme.js                  theme, design tokens, pain-colour util, icon adapter
src/database/db.js            all SQLite access
src/screens/
  TodayScreen.js              per-day logging + date navigation
  HistoryScreen.js            list + read-only detail (+ "Edit" → Today)
  ExportScreen.js             CSV + JSON export
src/components/
  PainSelector.js             0–10 colour scale
  SymptomPicker.js            symptom chips
  ActivityList.js             activities + the add-activity sheet
```

## How the styling ties together

Everything visual flows from a single file, **`src/theme.js`**, which exports:

- `theme` — the Material Design 3 object handed to `<PaperProvider theme={theme}>` in
  `App.js`.
- `C` — short colour aliases (`C.accent`, `C.muted`, …).
- `SPACING` / `RADIUS` — design tokens (a small, consistent spacing and corner scale used
  instead of scattered magic numbers).
- `paperSettings` — the icon adapter that lets Paper render `@expo/vector-icons`.

There are **two layers**:

1. **Paper components** (`Card`, `Button`, `Chip`, `TextInput`) read their colours
   *automatically* from `theme`. Changing `theme.colors` re-skins the whole app without
   touching individual components — which is why switching dark→light was almost a one-file
   change.
2. **Hand-written `StyleSheet` styles** (e.g. the pain swatches, badges) can't read the
   Paper theme automatically, so they `import { C, SPACING } from '../theme'`. That import
   is the bridge that keeps the custom bits in sync with the theme.

The pain scale is one function, `getPainColor(level)`, mapping `0–10` to green→red. It's
reused everywhere a pain value is shown (Today, History, the "previous day" card), so the
colour is always consistent with the number.

## Data model

SQLite (`kneetracker.db`), created in `db.js`:

```
logs          one row per date (date UNIQUE, pain_level, notes)
symptoms      log_id → trigger_key            (which symptoms that day)
activities    log_id → type, duration_min, notes
exercises     activity_id → name, order_idx   (strength only)
exercise_sets exercise_id → set_number, weight_kg, reps
```

DB rows use **language-independent keys** (`styrke`, `stairs_up`, `standing`…); only the
display labels are English. These keys must never change — existing data is keyed on them.

## Building & installing

The build is automated by the `/install-app` Claude Code skill. Manually:

```powershell
cd android
.\gradlew assembleRelease
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" -s <DEVICE_ID> `
  install -r app\build\outputs\apk\release\app-release.apk
```

- Build a **release** APK (`assembleRelease`) — it bundles the JS and runs standalone (a
  debug build needs Metro running on a connected PC).
- `install -r` updates over the existing app and **keeps all data** (same signing key).
- The APK targets **arm64-v8a only** (see gotchas) — ~32 MB.

See **[CLAUDE.md](CLAUDE.md)** for the full list of hard-won build gotchas (ASCII-only
path, pinned Gradle 8.13, the `expo-file-system/legacy` import, arm64-only ABI, etc.). Read
it before changing anything in `android/`.

## Privacy

All data stays on the device in SQLite. Nothing is sent anywhere. Use the JSON export on the
Export tab to take backups — uninstalling the app deletes the database.
