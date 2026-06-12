---
name: install-app
description: Build and install Injury Tracker on the user's Android phone. Use whenever the user wants to build the app, install it, deploy a new version, or get changes onto the phone. Produces a standalone signed release APK and installs it over the existing app (keeping data).
---

# Install Injury Tracker on the phone

Build a standalone **release** APK (JS bundled, no Metro needed) and install it on the
connected Samsung phone. `install -r` keeps all existing SQLite data because every build
is signed with the same `release.keystore`.

All hard-won project details are in `/CLAUDE.md` — read its "Hard-won gotchas" section if
anything below fails.

## Variables

- Project root: `C:\Users\evenv\Documents\CodingProjects\InjuryTracker`
- adb: `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`
- Phone adb id: `RFGL10GT15W`
- APK output: `android\app\build\outputs\apk\release\app-release.apk`

## Steps

### 1. Confirm the phone is connected and authorized

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices
```

Expect `RFGL10GT15W   device`. Other outcomes:
- **`unauthorized`** → wake + unlock the phone, accept the "Allow USB debugging?" dialog
  (tick "Always allow"). Re-run.
- **Phone missing / only an `offline` emulator** → ask the user to plug in + unlock the
  phone. If still stuck: `adb kill-server; adb start-server`, then re-check.
- An `emulator-XXXX  offline` line is harmless here — Gradle + adb skip it. (It only breaks
  `expo run:android`, which we don't use.)

### 2. Build the release APK

```powershell
cd C:\Users\evenv\Documents\CodingProjects\InjuryTracker\android
.\gradlew assembleRelease
```

Wait for `BUILD SUCCESSFUL` (~1–4 min). If it fails, jump to Troubleshooting.

### 3. Install on the phone

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" -s RFGL10GT15W `
  install -r "C:\Users\evenv\Documents\CodingProjects\InjuryTracker\android\app\build\outputs\apk\release\app-release.apk"
```

Expect `Success`. If it fails with a **signature mismatch**
(`INSTALL_FAILED_UPDATE_INCOMPATIBLE`), a differently-signed build is installed; uninstall
first then re-install (this wipes data):
`adb -s RFGL10GT15W uninstall com.evenv.skadeoppfolgingsapp`.

### 4. Launch and verify it didn't crash

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb -s RFGL10GT15W shell input keyevent KEYCODE_WAKEUP
& $adb -s RFGL10GT15W shell am start -n com.evenv.skadeoppfolgingsapp/.MainActivity
Start-Sleep -Seconds 6
& $adb -s RFGL10GT15W shell pidof com.evenv.skadeoppfolgingsapp   # non-empty = alive
& $adb -s RFGL10GT15W logcat -b crash -d | Select-String "FATAL|Invariant"   # should be empty
```

Optional visual check (pull a screenshot and Read it):
```powershell
& $adb -s RFGL10GT15W shell screencap -p /sdcard/s.png
& $adb -s RFGL10GT15W pull /sdcard/s.png C:\Users\evenv\Documents\CodingProjects\InjuryTracker\_shot.png
& $adb -s RFGL10GT15W shell rm /sdcard/s.png
```
`_shot.png` is gitignored. Delete it when done.

## Troubleshooting (root causes we actually hit)

| Symptom | Fix |
|---|---|
| `Invariant Violation: "main" has not been registered` (app shows splash then dies) | `index.js` missing or `package.json` `main` ≠ `index.js`. Restore `index.js` calling `registerRootComponent(App)`. |
| `JvmVendorSpec … IBM_SEMERU` during build | Gradle too new. `gradle-wrapper.properties` must pin **8.13**. |
| `cannot open file …<F8>…` / NDK C++ error | Project path has non-ASCII chars. The path must be pure ASCII. |
| `expo run:android` crashes on `TCP port 5562` | A stale offline emulator. Don't use `expo run:android` — use Gradle + adb as above. |
| App needs Metro / "could not connect to development server" | A debug APK got installed. Always build **release** (`assembleRelease`). |

## After building

- A fresh APK overwrites the old one at the output path. Optionally copy it to the Desktop
  as a manual-install backup.
- Do **not** commit the APK (gitignored) or run `expo prebuild --clean`.
