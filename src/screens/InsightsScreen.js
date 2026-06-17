import React, { useState, useCallback, useRef } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Card, Icon, Chip } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';

import {
  getPainSeries,
  getActivityImpact,
  getExerciseImpact,
  getExerciseVolumeSeries,
  getSymptomStats,
} from '../database/db';
import { ACTIVITY_LABEL, ACTIVITY_ICON } from '../components/ActivityList';
import { SYMPTOM_LABELS } from '../components/SymptomPicker';
import { C, getPainColor } from '../theme';
import { formatDayMonth, formatDayMonthSlash } from '../utils/date';

const MIN_OCCURRENCES = 3; // need this many sessions before showing a signal
const MAX_EXERCISES = 10; // strength card shows only the 10 most pain-linked exercises
const PLOT_H = 130;
const GOOD = '#16a34a';

// ─── Reusable scrolling bar chart ──────────────────────────────────────────────
// A horizontal, scroll-to-latest bar chart with a y-axis, a sparse date x-axis,
// and a caption. Pain and exercise-volume both render through this; they differ
// only in scale, colour and labels. `data` is [{ key, date, value }].

const X_TICK_TARGET = 6; // aim for ~6 date ticks across the visible axis

function BarChart({ data, maxValue, yLabels, yAxisWidth = 22, barColor, caption }) {
  // Default the horizontal scroll to the right edge (latest data) instead of the
  // left (earliest). scrollToEnd fires from onContentSizeChange, so it runs once
  // the bars are laid out — and again whenever new data comes in.
  const scrollRef = useRef(null);
  // Label every Nth bar so "5/6" ticks never collide; always label the last one
  // (the most recent, which is where we scroll to).
  const step = Math.max(3, Math.ceil(data.length / X_TICK_TARGET));

  return (
    <View>
      <View style={s.plotRow}>
        <View style={[s.yAxis, { width: yAxisWidth }]}>
          {yLabels.map((label) => (
            <Text key={label} style={s.axisLabel}>{label}</Text>
          ))}
        </View>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.bars}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {data.map((p, i) => {
            const showTick = i % step === 0 || i === data.length - 1;
            return (
              <View key={p.key} style={s.barSlot}>
                <View style={s.barBox}>
                  <View
                    style={[
                      s.bar,
                      {
                        height: 4 + (p.value / maxValue) * (PLOT_H - 4),
                        backgroundColor: barColor(p.value),
                      },
                    ]}
                  />
                </View>
                <Text style={s.xTick} numberOfLines={1}>
                  {showTick ? formatDayMonthSlash(p.date) : ''}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      </View>
      <Text style={s.caption}>{caption}</Text>
    </View>
  );
}

// ─── A. Pain over time ─────────────────────────────────────────────────────────

function PainTimeline({ series }) {
  if (series.length < 2) {
    return <Text style={s.empty}>Log a few days to see your pain trend.</Text>;
  }
  return (
    <BarChart
      data={series.map((p) => ({ key: p.date, date: p.date, value: p.pain_level }))}
      maxValue={10}
      yLabels={['10', '5', '0']}
      barColor={(v) => getPainColor(v)}
      caption={`${formatDayMonth(series[0].date)} → ${formatDayMonth(series[series.length - 1].date)} · ${series.length} days`}
    />
  );
}

// ─── Volume per exercise ────────────────────────────────────────────────────────

function ExerciseVolumeChart({ series }) {
  const maxVol = series.length ? Math.max(...series.map((p) => p.volume)) : 0;
  if (maxVol <= 0) {
    return <Text style={s.empty}>No weighted volume logged for this exercise yet.</Text>;
  }
  return (
    <BarChart
      data={series.map((p) => ({ key: p.date, date: p.date, value: p.volume }))}
      maxValue={maxVol}
      yLabels={[`${Math.round(maxVol)}`, '0']}
      yAxisWidth={44}
      barColor={() => C.accent}
      caption={`${formatDayMonth(series[0].date)} → ${formatDayMonth(series[series.length - 1].date)} · ${series.length} sessions`}
    />
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

// ─── Reusable labelled bar (used by the symptoms card) ─────────────────────────

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
  const [volumeByExercise, setVolumeByExercise] = useState({});
  const [symptoms, setSymptoms] = useState([]);
  const [picked, setPicked] = useState(null); // which exercise the volume chart shows

  useFocusEffect(
    useCallback(() => {
      setSeries(getPainSeries());
      setImpact(getActivityImpact());
      setExImpact(getExerciseImpact());
      setVolumeByExercise(getExerciseVolumeSeries());
      setSymptoms(getSymptomStats());
    }, [])
  );

  const enough = impact.items.filter((i) => i.n >= MIN_OCCURRENCES);
  const tooFew = impact.items.filter((i) => i.n < MIN_OCCURRENCES);
  const exEnough = exImpact.items.filter((i) => i.n >= MIN_OCCURRENCES);
  const exTooFew = exImpact.items.filter((i) => i.n < MIN_OCCURRENCES);
  // items arrive sorted most-pain-linked first, so the top slice is the strongest.
  const exTop = exEnough.slice(0, MAX_EXERCISES);
  const exHidden = exEnough.length - exTop.length + exTooFew.length;

  // The volume chart offers exactly the exercises shown in "Strength — by exercise".
  // Fall back to the first (most pain-linked) when nothing is picked yet, or when a
  // previous pick is no longer in the list (e.g. after new data shifts the top 10).
  const exTopNames = exTop.map((i) => i.name);
  const selected = exTopNames.includes(picked) ? picked : exTopNames[0];

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
            <Text variant="labelSmall" style={s.section}>VOLUME BY EXERCISE</Text>
            {exTop.length === 0 ? (
              <Text style={s.empty}>Log weighted strength exercises to see this.</Text>
            ) : (
              <>
                <Text style={s.subtitle}>
                  Training volume (weight × reps, in kg) per session. Pick an exercise:
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.chips}
                >
                  {exTop.map((item) => (
                    <Chip
                      key={item.name}
                      compact
                      selected={selected === item.name}
                      onPress={() => setPicked(item.name)}
                      style={s.chip}
                    >
                      {item.name}
                    </Chip>
                  ))}
                </ScrollView>
                <ExerciseVolumeChart series={volumeByExercise[selected] || []} />
              </>
            )}
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
                  Average pain after each activity type (baseline, all days: {impact.baseline.toFixed(1)}).
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
                {exTop.length === 0 ? (
                  <Text style={s.empty}>
                    Need at least {MIN_OCCURRENCES} sessions of an exercise before a signal shows.
                  </Text>
                ) : (
                  exTop.map((item) => (
                    <ImpactRow
                      key={item.name}
                      label={item.name}
                      icon="dumbbell"
                      item={item}
                      baseline={exImpact.baseline}
                    />
                  ))
                )}
                {exHidden > 0 && (
                  <Text style={s.tooFew}>
                    {exHidden} more hidden (weaker pain link or too few sessions).
                  </Text>
                )}
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

  // Bar charts (pain + volume)
  plotRow: { flexDirection: 'row', alignItems: 'flex-start' },
  yAxis: { height: PLOT_H, justifyContent: 'space-between', paddingRight: 4 },
  axisLabel: { color: C.muted, fontSize: 10, textAlign: 'right' },
  bars: { alignItems: 'flex-start', paddingLeft: 2 },
  barSlot: { width: 12, alignItems: 'center', marginHorizontal: 1.5 },
  barBox: { width: 12, height: PLOT_H, justifyContent: 'flex-end' },
  bar: { width: 12, borderRadius: 2 },
  xTick: { width: 34, marginTop: 4, fontSize: 9, color: C.muted, textAlign: 'center' },
  chips: { paddingBottom: 14, paddingRight: 4 },
  chip: { marginRight: 8 },
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
