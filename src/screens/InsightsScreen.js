import React, { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Card, Icon } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';

import {
  getPainSeries,
  getActivityImpact,
  getExerciseImpact,
  getLoadVsPain,
  getSymptomStats,
} from '../database/db';
import { ACTIVITY_LABEL, ACTIVITY_ICON } from '../components/ActivityList';
import { SYMPTOM_LABELS } from '../components/SymptomPicker';
import { C, getPainColor } from '../theme';

const MIN_OCCURRENCES = 3; // need this many sessions before showing a signal
const PLOT_H = 130;
const GOOD = '#16a34a';

function shortDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ─── A. Pain over time ─────────────────────────────────────────────────────────

function PainTimeline({ series }) {
  if (series.length < 2) {
    return <Text style={s.empty}>Log a few days to see your pain trend.</Text>;
  }
  return (
    <View>
      <View style={s.plotRow}>
        <View style={s.yAxis}>
          <Text style={s.axisLabel}>10</Text>
          <Text style={s.axisLabel}>5</Text>
          <Text style={s.axisLabel}>0</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.bars}
        >
          {series.map((p) => (
            <View key={p.date} style={s.barSlot}>
              <View
                style={[
                  s.bar,
                  {
                    height: 4 + (p.pain_level / 10) * (PLOT_H - 4),
                    backgroundColor: getPainColor(p.pain_level),
                  },
                ]}
              />
            </View>
          ))}
        </ScrollView>
      </View>
      <Text style={s.caption}>
        {shortDate(series[0].date)} → {shortDate(series[series.length - 1].date)} · {series.length} days
      </Text>
    </View>
  );
}

// ─── B. What provokes it ───────────────────────────────────────────────────────

function ImpactRow({ label, icon, item, baseline }) {
  const usingNext = item.nextDayAvg != null;
  const value = usingNext ? item.nextDayAvg : item.sameDayAvg;
  const delta = value - baseline;
  const deltaColor = delta > 0.2 ? C.danger : delta < -0.2 ? GOOD : C.muted;
  const barColor = getPainColor(Math.round(value));

  return (
    <View style={s.impactRow}>
      <Icon source={icon} size={20} color={C.accent} />
      <View style={{ flex: 1 }}>
        <View style={s.impactHead}>
          <Text style={s.impactLabel}>{label}</Text>
          <Text style={[s.impactValue, { color: barColor }]}>{value.toFixed(1)}</Text>
        </View>
        <View style={s.track}>
          <View style={[s.fill, { width: `${(value / 10) * 100}%`, backgroundColor: barColor }]} />
        </View>
        <View style={s.impactMeta}>
          <Text style={[s.delta, { color: deltaColor }]}>
            {delta >= 0 ? '+' : ''}{delta.toFixed(1)} vs baseline
          </Text>
          <Text style={s.nText}>{usingNext ? 'next-day' : 'same-day'} · n={item.n}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Reusable labelled bar (used by C and D) ───────────────────────────────────

function MetricBar({ label, value, n, sub }) {
  const color = value == null ? C.muted : getPainColor(Math.round(value));
  return (
    <View style={s.metricRow}>
      <View style={s.impactHead}>
        <Text style={s.impactLabel}>{label}</Text>
        <Text style={[s.impactValue, { color }]}>{value == null ? '—' : value.toFixed(1)}</Text>
      </View>
      <View style={s.track}>
        {value != null && (
          <View style={[s.fill, { width: `${(value / 10) * 100}%`, backgroundColor: color }]} />
        )}
      </View>
      <View style={s.impactMeta}>
        <Text style={s.nText}>{sub}</Text>
        <Text style={s.nText}>n={n}</Text>
      </View>
    </View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function InsightsScreen() {
  const [series, setSeries] = useState([]);
  const [impact, setImpact] = useState({ baseline: null, items: [] });
  const [exImpact, setExImpact] = useState({ baseline: null, items: [] });
  const [load, setLoad] = useState({ bins: [], baseline: null });
  const [symptoms, setSymptoms] = useState([]);

  useFocusEffect(
    useCallback(() => {
      setSeries(getPainSeries());
      setImpact(getActivityImpact());
      setExImpact(getExerciseImpact());
      setLoad(getLoadVsPain());
      setSymptoms(getSymptomStats());
    }, [])
  );

  const enough = impact.items.filter((i) => i.n >= MIN_OCCURRENCES);
  const tooFew = impact.items.filter((i) => i.n < MIN_OCCURRENCES);
  const exEnough = exImpact.items.filter((i) => i.n >= MIN_OCCURRENCES);
  const exTooFew = exImpact.items.filter((i) => i.n < MIN_OCCURRENCES);

  return (
    <SafeAreaView style={s.container} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={s.content}>
        <Card mode="elevated" elevation={2} style={s.card}>
          <Card.Content>
            <Text variant="labelSmall" style={s.section}>PAIN OVER TIME</Text>
            <PainTimeline series={series} />
          </Card.Content>
        </Card>

        <Card mode="elevated" elevation={2} style={s.card}>
          <Card.Content>
            <Text variant="labelSmall" style={s.section}>WHAT PROVOKES IT</Text>
            {impact.baseline == null ? (
              <Text style={s.empty}>No activities logged yet.</Text>
            ) : (
              <>
                <Text style={s.subtitle}>
                  Average pain after each activity (baseline, all days: {impact.baseline.toFixed(1)}).
                  Higher = more pain followed.
                </Text>
                {enough.length === 0 ? (
                  <Text style={s.empty}>
                    Need at least {MIN_OCCURRENCES} sessions of an activity before a signal shows.
                  </Text>
                ) : (
                  enough.map((item) => (
                    <ImpactRow
                      key={item.type}
                      label={ACTIVITY_LABEL[item.type] || item.type}
                      icon={ACTIVITY_ICON[item.type] || 'flash'}
                      item={item}
                      baseline={impact.baseline}
                    />
                  ))
                )}
                {tooFew.length > 0 && (
                  <Text style={s.tooFew}>
                    Not enough data yet:{' '}
                    {tooFew.map((i) => `${ACTIVITY_LABEL[i.type] || i.type} (n=${i.n})`).join(', ')}.
                  </Text>
                )}
              </>
            )}
          </Card.Content>
        </Card>

        <Card mode="elevated" elevation={2} style={s.card}>
          <Card.Content>
            <Text variant="labelSmall" style={s.section}>STRENGTH — BY EXERCISE</Text>
            {exImpact.baseline == null || exImpact.items.length === 0 ? (
              <Text style={s.empty}>Log strength exercises to see this.</Text>
            ) : (
              <>
                <Text style={s.subtitle}>
                  Average pain the day after each exercise — finer than the single "Strength" row,
                  since squats/deadlifts load the knee differently than upper-body work.
                </Text>
                {exEnough.length === 0 ? (
                  <Text style={s.empty}>
                    Need at least {MIN_OCCURRENCES} sessions of an exercise before a signal shows.
                  </Text>
                ) : (
                  exEnough.map((item) => (
                    <ImpactRow
                      key={item.name}
                      label={item.name}
                      icon="dumbbell"
                      item={item}
                      baseline={exImpact.baseline}
                    />
                  ))
                )}
                {exTooFew.length > 0 && (
                  <Text style={s.tooFew}>
                    Not enough data yet:{' '}
                    {exTooFew.map((i) => `${i.name} (n=${i.n})`).join(', ')}.
                  </Text>
                )}
              </>
            )}
          </Card.Content>
        </Card>

        <Card mode="elevated" elevation={2} style={s.card}>
          <Card.Content>
            <Text variant="labelSmall" style={s.section}>TRAINING LOAD VS NEXT-DAY PAIN</Text>
            {load.baseline == null || load.bins.every((b) => b.n === 0) ? (
              <Text style={s.empty}>Log activity durations and pain to see this.</Text>
            ) : (
              <>
                <Text style={s.subtitle}>
                  Average pain the day after, grouped by how many active minutes that day.
                </Text>
                {load.bins.map((b) => (
                  <MetricBar
                    key={b.label}
                    label={b.label}
                    value={b.avgNextPain}
                    n={b.n}
                    sub="next-day pain"
                  />
                ))}
              </>
            )}
          </Card.Content>
        </Card>

        <Card mode="elevated" elevation={2} style={s.card}>
          <Card.Content>
            <Text variant="labelSmall" style={s.section}>SYMPTOMS</Text>
            {symptoms.length === 0 ? (
              <Text style={s.empty}>No symptoms logged yet.</Text>
            ) : (
              <>
                <Text style={s.subtitle}>
                  How often each symptom appears, and average pain on those days.
                </Text>
                {symptoms.map((sym) => (
                  <MetricBar
                    key={sym.key}
                    label={SYMPTOM_LABELS[sym.key] || sym.key}
                    value={sym.avgPain}
                    n={sym.n}
                    sub="avg pain that day"
                  />
                ))}
              </>
            )}
          </Card.Content>
        </Card>

        <Text style={s.disclaimer}>
          These are associations in your own data, not medical conclusions — useful as
          talking points with your physiotherapist.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 48 },
  card: { marginBottom: 12 },
  section: {
    color: C.muted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 14,
  },
  subtitle: { color: C.muted, fontSize: 13, lineHeight: 18, marginBottom: 16 },
  empty: { color: C.muted, fontSize: 14, lineHeight: 20, paddingVertical: 8 },

  // Pain timeline
  plotRow: { flexDirection: 'row', height: PLOT_H },
  yAxis: { height: PLOT_H, justifyContent: 'space-between', width: 22, paddingRight: 4 },
  axisLabel: { color: C.muted, fontSize: 10, textAlign: 'right' },
  bars: { alignItems: 'flex-end', height: PLOT_H, paddingLeft: 2 },
  barSlot: { width: 12, height: PLOT_H, justifyContent: 'flex-end', marginHorizontal: 1.5 },
  bar: { width: 12, borderRadius: 2 },
  caption: { color: C.muted, fontSize: 12, marginTop: 8, textAlign: 'center' },

  // Impact rows
  impactRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 16 },
  metricRow: { marginBottom: 16 },
  impactHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  impactLabel: { color: C.text, fontSize: 14, fontWeight: '600' },
  impactValue: { fontSize: 15, fontWeight: '800' },
  track: { height: 8, backgroundColor: C.inner, borderRadius: 4, overflow: 'hidden', marginTop: 6 },
  fill: { height: 8, borderRadius: 4 },
  impactMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  delta: { fontSize: 12, fontWeight: '600' },
  nText: { color: C.muted, fontSize: 12 },

  tooFew: { color: C.muted, fontSize: 12, fontStyle: 'italic', marginTop: 4 },
  disclaimer: { color: C.muted, fontSize: 12, lineHeight: 18, fontStyle: 'italic', paddingHorizontal: 4 },
});
