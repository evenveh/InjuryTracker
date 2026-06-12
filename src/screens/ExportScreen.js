import React, { useState } from 'react';
import { StyleSheet, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Card, Button } from 'react-native-paper';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { getFullExportData } from '../database/db';
import { SYMPTOM_LABELS } from '../components/SymptomPicker';
import { ACTIVITY_LABEL } from '../components/ActivityList';
import { C } from '../theme';

function escape(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

function buildCSV(data) {
  const headers = [
    'Date', 'Weekday', 'Pain (0-10)', 'Symptoms',
    'Activity type', 'Duration (min)',
    'Exercise', 'Set', 'Weight (kg)', 'Reps',
    'Notes',
  ];

  const rows = [headers.map(escape).join(',')];

  for (const log of data) {
    const d = new Date(log.date + 'T00:00:00');
    const weekday = d.toLocaleDateString('en-GB', { weekday: 'long' });
    const symStr = (log.symptoms || [])
      .map((k) => SYMPTOM_LABELS[k] || k)
      .join('; ');

    const pushRow = (actLabel, duration, exName, setNum, weight, reps, note) =>
      rows.push(
        [log.date, weekday, log.pain_level, symStr,
         actLabel, duration, exName, setNum, weight, reps, note]
          .map(escape)
          .join(',')
      );

    if (!log.activities?.length) {
      pushRow('', '', '', '', '', '', log.notes || '');
      continue;
    }

    for (const act of log.activities) {
      const actLabel = ACTIVITY_LABEL[act.type] || act.type;
      const dur = act.duration_min || '';

      if (act.type !== 'styrke' || !act.exercises?.length) {
        pushRow(actLabel, dur, '', '', '', '', act.notes || log.notes || '');
        continue;
      }

      for (const ex of act.exercises) {
        if (!ex.sets?.length) {
          pushRow(actLabel, dur, ex.name, '', '', '', act.notes || log.notes || '');
          continue;
        }
        for (const sset of ex.sets) {
          pushRow(
            actLabel, dur, ex.name,
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

async function shareFile(uri, mimeType, dialogTitle) {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType, dialogTitle });
  } else {
    Alert.alert('Saved', `File saved to:\n${uri}`);
  }
}

export default function ExportScreen() {
  const [busy, setBusy] = useState(false);

  const exportCSV = async () => {
    try {
      setBusy(true);
      const data = getFullExportData();
      if (!data.length) { Alert.alert('No data', 'The log is empty.'); return; }

      // UTF-8 BOM so Excel opens special characters correctly
      const csv = '﻿' + buildCSV(data);
      const name = `injury_log_${new Date().toISOString().split('T')[0]}.csv`;
      const uri = FileSystem.documentDirectory + name;

      await FileSystem.writeAsStringAsync(uri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await shareFile(uri, 'text/csv', 'Share CSV report');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setBusy(false);
    }
  };

  const exportJSON = async () => {
    try {
      setBusy(true);
      const data = getFullExportData();
      if (!data.length) { Alert.alert('No data', 'The log is empty.'); return; }

      const json = JSON.stringify(data, null, 2);
      const name = `injury_log_backup_${new Date().toISOString().split('T')[0]}.json`;
      const uri = FileSystem.documentDirectory + name;

      await FileSystem.writeAsStringAsync(uri, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await shareFile(uri, 'application/json', 'Share backup');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={s.content}>

        <Card mode="elevated" elevation={2} style={s.card}>
          <Card.Content>
            <Text variant="titleMedium" style={s.cardTitle}>Export to CSV</Text>
            <Text style={s.cardDesc}>
              One row per set. Includes date, pain, symptoms, activities with
              exercise/weight/reps and notes. Opens directly in Excel — special
              characters work correctly (UTF-8 BOM).
            </Text>
            <Button
              mode="contained"
              icon="file-delimited-outline"
              onPress={exportCSV}
              disabled={busy}
              loading={busy}
              contentStyle={{ paddingVertical: 6 }}
            >
              {busy ? 'Exporting…' : 'Export CSV'}
            </Button>
          </Card.Content>
        </Card>

        <Card mode="elevated" elevation={2} style={s.card}>
          <Card.Content>
            <Text variant="titleMedium" style={s.cardTitle}>Backup (JSON)</Text>
            <Text style={s.cardDesc}>
              Complete backup of all data. Can be used to restore when needed
              or opened in another program.
            </Text>
            <Button
              mode="outlined"
              icon="code-json"
              onPress={exportJSON}
              disabled={busy}
              loading={busy}
              contentStyle={{ paddingVertical: 6 }}
            >
              {busy ? 'Exporting…' : 'Export JSON backup'}
            </Button>
          </Card.Content>
        </Card>

        <Card mode="contained" style={s.infoCard}>
          <Card.Content>
            <Text variant="titleSmall" style={s.infoTitle}>About data storage</Text>
            <Text style={s.infoText}>
              All data is stored exclusively on your phone via SQLite.
              No data is sent to the internet. History is not deleted on app
              updates. Take regular backups to protect your data against
              uninstalling the app.
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
  infoCard: { backgroundColor: C.inner },
  infoTitle: { color: C.accent, fontWeight: '700', marginBottom: 8 },
  infoText: { color: C.muted, fontSize: 13, lineHeight: 20 },
});
