# Injury Tracker

A personal Android app for tracking a knee injury day by day: pain level (0–10),
symptoms, and activities (strength training with sets/reps, cardio with duration).
Built so the user can spot what provokes the injury and what doesn't. Data is stored
locally and can be exported to CSV/JSON for a therapist.

The app UI is in **English**. The end user is Norwegian and communicates in Norwegian —
respond to them in Norwegian, but keep all code, UI strings, and identifiers English.

One goal of this development from the user side is learning. Make sure you teach the user the changes you do and explain why and how elements are tied together.

**Never take a screenshot of the phone unless the user explicitly asks for one.** When
installing/verifying a build, confirm success via `pidof` + the crash log only — do not
`screencap`/pull the screen on your own initiative.

## Tech stack

- **Expo SDK 56** / **React Native 0.85** (bare workflow — `android/` is committed)
- **expo-sqlite** for local storage (survives app updates)
- **@react-navigation/bottom-tabs** — four tabs: Today / History / Insights / Export
- **react-native-paper** (Material Design 3 light theme) for the UI;
  **@expo/vector-icons** (`MaterialCommunityIcons`) for all icons. Paper renders icons
  through an adapter in `src/theme.js`, so icon fonts load via **expo-font** — no native
  `react-native-vector-icons` linking, no Gradle changes (the `.ttf` bundles into the APK).
- **expo-file-system** + **expo-sharing** for CSV/JSON export.
  ⚠️ Import the file APIs from **`expo-file-system/legacy`** (see gotchas).
- JS engine: Hermes. `toLocaleDateString('en-GB', …)` works fine here.

## Architecture

```
index.js                      ← registerRootComponent(App)  ← DO NOT DELETE (see gotchas)
App.js                        ← PaperProvider + navigation (4 tabs) + initDatabase()
src/theme.js                  ← Paper MD3 light theme, design tokens, pain-colour util, vector-icon adapter
src/database/db.js            ← all SQLite: logs/symptoms/activities/exercises/sets,
                                migrations, db_meta (export folder), and analytics queries
src/screens/TodayScreen.js    ← per-day logging; ‹/› date nav to back-fill/edit past days
src/screens/HistoryScreen.js  ← list + detail; ✏️ opens the day in Today for editing
src/screens/InsightsScreen.js ← analytics: pain-over-time, activity/exercise impact, load, symptoms
src/screens/ExportScreen.js   ← CSV (UTF-8 BOM) + JSON; share OR save-to-device (SAF)
src/components/PainSelector.js, SymptomPicker.js,
src/components/ActivityList.js ← add/edit activity sheet, exercise name type-ahead
```

DB rows use **language-independent keys** (`styrke`, `sykling`, `stairs_up`…); only the
display labels are English. Never change these keys — it breaks existing data.

**Analytics modelling note:** "what provokes the injury" is computed against **next-day**
pain (pain often shows up the day after), at both activity-type and **exercise** level —
squats/deadlifts load the knee differently than bench/biceps, so a single "Strength"
average would hide the signal. All insight queries live in `db.js`; everything guards on
`n` (occurrence count) and is framed as associations, not conclusions.

**Schema migrations:** `CREATE TABLE IF NOT EXISTS` never alters an existing table, so new
columns are added with `ALTER TABLE` guarded by a `PRAGMA table_info` check (see
`initDatabase` + `_columnExists`). `distance_km` on `activities` was added this way.

`applicationId` is `com.evenv.skadeoppfolgingsapp`. **Do not change it** — a new id makes
Android treat it as a different app and the user loses their SQLite history.

## Building & installing  →  see the `/install-app` skill

The skill `.claude/skills/install-app/SKILL.md` automates this. The essentials:

```powershell
cd C:\Users\evenv\Documents\CodingProjects\InjuryTracker\android
.\gradlew assembleRelease
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" -s RFGL10GT15W `
  install -r app\build\outputs\apk\release\app-release.apk
```

`install -r` updates over the existing app and **keeps all data** (same signing key).

## Hard-won gotchas (read before building)

1. **ASCII path only.** Non-ASCII characters (ø/æ/å) in the project path break the NDK
   C++ build (`cannot open file …<F8>…`). This folder (`InjuryTracker`) is ASCII — keep
   it that way. The original `Skadeoppfølgingsapp` folder could never build.

2. **Gradle must be 8.13.** RN's Gradle plugin needs ≥8.13; the default 9.3.1 fails with
   `JvmVendorSpec … IBM_SEMERU`. Pinned in `android/gradle/wrapper/gradle-wrapper.properties`.
   Don't "upgrade" it.

3. **`index.js` + `registerRootComponent` are required.** Without them a release build
   crashes instantly with `Invariant Violation: "main" has not been registered`.
   `package.json` `"main"` must be `"index.js"`, and `index.js` must call
   `registerRootComponent(App)`.

4. **Build via Gradle, NOT `expo run:android`.** `expo run:android` crashes enumerating
   devices when a stale **offline emulator** entry exists
   (`could not connect to TCP port 5562 … emulator-5562`). `./gradlew assembleRelease`
   + `adb install` sidesteps this and also skips the offline emulator automatically.

5. **Release build, not debug.** A debug build needs Metro running and the PC connected.
   Release bundles the JS — it runs standalone. For a daily-use app, always build release.

6. **Keep `android/app/release.keystore`.** It signs release builds (alias `kneetracker`,
   passwords `kneetracker123`). Lose it and you can't ship an update that installs over the
   existing app without wiping data. It's committed (and the user should back it up).

7. **Never run `expo prebuild --clean`.** It regenerates `android/` and wipes the manual
   fixes: Gradle version, signing config, `strings.xml` app label, and
   `android.overridePathCheck=true` in `gradle.properties`.

8. **App label lives in `android/app/src/main/res/values/strings.xml`** (`app_name`),
   because we build via Gradle, not prebuild. `app.json` `name` alone won't change it.

9. **adb device is flaky.** The phone (Samsung, id `RFGL10GT15W`) drops adb authorization
   when it sleeps — shows `unauthorized` or vanishes. Fix: wake + unlock the phone, accept
   the "Allow USB debugging?" dialog, and if needed
   `adb kill-server; adb start-server`. adb lives at
   `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`.

10. **Expo Go does NOT work** — it only supports its bundled SDK, not our SDK 56 native
    build. Don't suggest it; build and install the APK instead.

11. **Build arm64-v8a only** (`reactNativeArchitectures=arm64-v8a` in
    `android/gradle.properties`). Building `armeabi-v7a` blows past Windows' 260-char
    `MAX_PATH` in the CMake/ninja codegen step — it fails with
    `ninja: error: mkdir(…react_codegen_safeareacontext.dir/…): No such file or directory`
    on the `armeabi-v7a` ABI (arm64-v8a's path is ~2 chars shorter, just under the limit).
    The phone only supports arm64-v8a anyway, so the other ABIs are dead weight — this also
    cuts the APK from ~80 MB to ~32 MB and speeds up the build. Note: Windows
    `LongPathsEnabled=1` is already ON here but does **not** help — ninja/CMake don't use the
    `\\?\` prefix, so the NDK build still hits the 260-char wall. arm64-only is the real fix.

12. **expo-file-system: import from `expo-file-system/legacy`.** In SDK 56 the classic
    `FileSystem.writeAsStringAsync` / `documentDirectory` / `EncodingType` API is deprecated
    and **throws at runtime** (`Method writeAsStringAsync … is deprecated`) — which the
    Export screen surfaced as an error alert. Fix: `import * as FileSystem from
    'expo-file-system/legacy'`. Same API, no deprecation; keeps the UTF-8 BOM behaviour that
    makes Excel open special characters. (The new `File`/`Directory`/`Paths` API is the
    long-term path, but legacy is the low-risk fix.)

13. **Don't hardcode `height` on the bottom tab bar without adding the safe-area inset.**
    Setting `tabBarStyle: { height: 60 }` makes React Navigation stop auto-adding the bottom
    inset, so Android's system nav bar overlaps the Today/History/Export tabs. Fix in
    `App.js`: a `Tabs` child of `SafeAreaProvider` reads `useSafeAreaInsets()` and uses
    `height: 60 + insets.bottom`, `paddingBottom: 8 + insets.bottom`. The hook must run in a
    component **inside** the provider (App renders the provider, so it can't read insets
    itself).

14. **Build date keys (`YYYY-MM-DD`) from LOCAL date parts, never `toISOString()`.**
    `toISOString()` converts to UTC; in a positive-offset timezone (CEST = UTC+2) that rolls
    the date back a day. It made the `‹/›` date nav jump two days back and the `›` (forward)
    do nothing, and would skew the next-day analytics. Use a helper that reads
    `getFullYear()/getMonth()/getDate()` (see `toDateStr`/`nextDateStr`). Display formatting
    via `toLocaleDateString` is fine — it's only the key arithmetic that must stay local.

15. **No local image rasterizer; the launcher icon is static PNGs.** `convert` on this
    machine is **Windows' `convert.exe`** (filesystem tool), NOT ImageMagick — there is no
    `magick`/`inkscape`/`sharp`. So don't try to generate/resize icons here; use pre-rendered
    PNGs or Android Studio's *Image Asset Studio*. The current launcher icon is a single
    full-bleed squircle PNG copied into every `mipmap-*dpi/ic_launcher{,_round}.png` (no
    `mipmap-anydpi-v26` adaptive XML — the adaptive foreground/background drawables weren't
    available). `app.json` `icon` does nothing without prebuild; the `res/` mipmaps are the
    source of truth.
