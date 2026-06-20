import React, { useState } from 'react';
import { View, StyleSheet, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Card, Button, Icon } from 'react-native-paper';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

import { getFullExportData, getMeta, setMeta, importBackup } from '../database/db';
import { SYMPTOM_LABELS } from '../components/SymptomPicker';
import { ACTIVITY_LABEL } from '../components/ActivityList';
import { C } from '../theme';
import { formatWeekday } from '../utils/date';

const SAF = FileSystem.StorageAccessFramework;
const EXPORT_DIR_KEY = 'export_dir_uri';

function escape(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

function buildCSV(data) {
  const headers = [
    'Date', 'Weekday', 'Pain (0-10)', 'Symptoms',
    'Activity type', 'Duration (min)', 'Distance (km)',
    'Exercise', 'Set', 'Weight (kg)', 'Reps',
    'Notes',
  ];

  const rows = [headers.map(escape).join(',')];

  for (const log of data) {
    const weekday = formatWeekday(log.date);
    const symStr = (log.symptoms || [])
      .map((k) => SYMPTOM_LABELS[k] || k)
      .join('; ');

    const pushRow = (actLabel, duration, distance, exName, setNum, weight, reps, note) =>
      rows.push(
        [log.date, weekday, log.pain_level, symStr,
         actLabel, duration, distance, exName, setNum, weight, reps, note]
          .map(escape)
          .join(',')
      );

    if (!log.activities?.length) {
      pushRow('', '', '', '', '', '', '', log.notes || '');
      continue;
    }

    for (const act of log.activities) {
      const actLabel = ACTIVITY_LABEL[act.type] || act.type;
      const dur = act.duration_min || '';
      const dist = act.distance_km ?? '';

      if (act.type !== 'styrke' || !act.exercises?.length) {
        pushRow(actLabel, dur, dist, '', '', '', '', act.notes || log.notes || '');
        continue;
      }

      for (const ex of act.exercises) {
        if (!ex.sets?.length) {
          pushRow(actLabel, dur, dist, ex.name, '', '', '', act.notes || log.notes || '');
          continue;
        }
        for (const sset of ex.sets) {
          pushRow(
            actLabel, dur, dist, ex.name,
            sset.set_number,
            sset.weight_kg ?? '',
            sset.reps ?? '',
            act.notes || log.notes || ''
          );
        }
      }
    }
  }

  return rows.join('\n');
}

// ─── Payload builders ──────────────────────────────────────────────────────────
// Each returns the file contents + naming, or null when there's nothing to export.

function todayKey() {
  return new Date().toISOString().split('T')[0];
}

function csvPayload() {
  const data = getFullExportData();
  if (!data.length) return null;
  return {
    content: '﻿' + buildCSV(data), // UTF-8 BOM so Excel reads special chars
    baseName: `injury_log_${todayKey()}`,
    ext: 'csv',
    mimeType: 'text/csv',
  };
}

function jsonPayload() {
  const data = getFullExportData();
  if (!data.length) return null;
  return {
    content: JSON.stringify(data, null, 2),
    baseName: `injury_log_backup_${todayKey()}`,
    ext: 'json',
    mimeType: 'application/json',
  };
}

// ─── Output actions ─────────────────────────────────────────────────────────────

// Share sheet: write to app-private storage, then hand the file to another app.
async function sharePayload(payload) {
  const uri = FileSystem.documentDirectory + `${payload.baseName}.${payload.ext}`;
  await FileSystem.writeAsStringAsync(uri, payload.content, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: payload.mimeType,
      dialogTitle: `Share ${payload.ext.toUpperCase()}`,
    });
  } else {
    Alert.alert('Saved', `File saved to:\n${uri}`);
  }
}

// Save to a user-visible folder via the Storage Access Framework. The granted
// folder is remembered (db_meta) so we only prompt once; if that grant was
// revoked, creating the file throws and we ask again.
async function savePayloadToDevice(payload) {
  const writeInto = async (dirUri) => {
    const fileUri = await SAF.createFileAsync(dirUri, payload.baseName, payload.mimeType);
    await FileSystem.writeAsStringAsync(fileUri, payload.content, {
      encoding: FileSystem.EncodingType.UTF8,
    });
  };

  const saved = getMeta(EXPORT_DIR_KEY);
  if (saved) {
    try {
      await writeInto(saved);
      return true;
    } catch {
      // permission likely revoked — fall through to ask again
    }
  }

  const perm = await SAF.requestDirectoryPermissionsAsync();
  if (!perm.granted) return false; // user cancelled the folder picker
  setMeta(EXPORT_DIR_KEY, perm.directoryUri);
  await writeInto(perm.directoryUri);
  return true;
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ExportScreen() {
  const [busy, setBusy] = useState(null); // id of the running action, or null
  const isBusy = busy !== null;

  const run = async (id, build, action, successMsg) => {
    try {
      setBusy(id);
      const payload = build();
      if (!payload) { Alert.alert('No data', 'The log is empty.'); return; }
      const ok = await action(payload);
      const msg = successMsg && successMsg(ok, payload);
      if (msg) Alert.alert('Saved to device ✓', msg);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setBusy(null);
    }
  };

  const share = (id, build) => run(id, build, sharePayload, null);
  const save = (id, build) =>
    run(id, build, savePayloadToDevice, (ok, p) =>
      ok ? `${p.baseName}.${p.ext} was written to the folder you picked.` : null
    );

  // Restore: pick a JSON backup, parse it, confirm, then import.
  const importFile = async () => {
    try {
      setBusy('import');
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const content = await FileSystem.readAsStringAsync(res.assets[0].uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const data = JSON.parse(content);
      const count = Array.isArray(data) ? data.length : 0;
      if (!count) { Alert.alert('Nothing to import', 'The file has no day entries.'); return; }
      Alert.alert(
        'Import backup?',
        `This loads ${count} day(s) and overwrites any matching dates.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Import',
            onPress: () => {
              try {
                const r = importBackup(data);
                Alert.alert('Imported ✓', `${r.days} day(s) loaded.`);
              } catch (e) {
                Alert.alert('Import failed', e.message);
              }
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={s.content}>

        <Card mode="elevated" elevation={2} style={s.card}>
          <Card.Content>
            <Text variant="titleMedium" style={s.cardTitle}>CSV report</Text>
            <Text style={s.cardDesc}>
              One row per set. Includes date, pain, symptoms, activities with
              exercise/weight/reps and notes. Opens directly in Excel — special
              characters work correctly (UTF-8 BOM).
            </Text>
            <Button
              mode="contained"
              icon="share-variant"
              onPress={() => share('csv-share', csvPayload)}
              disabled={isBusy}
              loading={busy === 'csv-share'}
              contentStyle={s.btnContent}
            >
              Share CSV
            </Button>
            <Button
              mode="outlined"
              icon="content-save-outline"
              onPress={() => save('csv-save', csvPayload)}
              disabled={isBusy}
              loading={busy === 'csv-save'}
              style={s.secondBtn}
              contentStyle={s.btnContent}
            >
              Save to device
            </Button>
          </Card.Content>
        </Card>

        <Card mode="elevated" elevation={2} style={s.card}>
          <Card.Content>
            <Text variant="titleMedium" style={s.cardTitle}>JSON backup</Text>
            <Text style={s.cardDesc}>
              Complete backup of all data. Can be used to restore when needed
              or opened in another program.
            </Text>
            <Button
              mode="contained"
              icon="share-variant"
              onPress={() => share('json-share', jsonPayload)}
              disabled={isBusy}
              loading={busy === 'json-share'}
              contentStyle={s.btnContent}
            >
              Share JSON
            </Button>
            <Button
              mode="outlined"
              icon="content-save-outline"
              onPress={() => save('json-save', jsonPayload)}
              disabled={isBusy}
              loading={busy === 'json-save'}
              style={s.secondBtn}
              contentStyle={s.btnContent}
            >
              Save to device
            </Button>
          </Card.Content>
        </Card>

        <Card mode="elevated" elevation={2} style={s.card}>
          <Card.Content>
            <Text variant="titleMedium" style={s.cardTitle}>Restore from backup</Text>
            <Text style={s.cardDesc}>
              Load a JSON backup file. Each day in the file overwrites that date;
              days not in the file are kept. Use this to restore after reinstalling
              or to seed history.
            </Text>
            <Button
              mode="outlined"
              icon="database-import-outline"
              onPress={importFile}
              disabled={isBusy}
              loading={busy === 'import'}
              contentStyle={s.btnContent}
            >
              Import JSON backup
            </Button>
          </Card.Content>
        </Card>

        <Card mode="contained" style={s.infoCard}>
          <Card.Content>
            <View style={s.infoHeader}>
              <Icon source="shield-lock-outline" size={18} color={C.accent} />
              <Text variant="titleSmall" style={s.infoTitle}>About data storage</Text>
            </View>
            <Text style={s.infoText}>
              All data is stored exclusively on your phone.
              No data is sent to the internet. It is recommended to take regular backups to protect your data..
            </Text>
          </Card.Content>
        </Card>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 48 },
  card: { marginBottom: 12 },
  cardTitle: { color: C.text, fontWeight: '700', marginBottom: 8 },
  cardDesc: { color: C.muted, fontSize: 14, lineHeight: 20, marginBottom: 16 },
  btnContent: { paddingVertical: 6 },
  secondBtn: { marginTop: 10 },
  infoCard: { backgroundColor: C.inner },
  infoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  infoTitle: { color: C.accent, fontWeight: '700' },
  infoText: { color: C.muted, fontSize: 13, lineHeight: 20 },
});
