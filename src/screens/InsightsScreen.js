import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Card, Icon, Chip } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Polyline, Circle, Line, Rect, Text as SvgText } from 'react-native-svg';

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
const DAY_W = 15;        // px per day on the x-axis — shared by both charts so columns line up
const Y_AXIS_W = 40;     // y-axis gutter width — shared so the two plot areas start at the same x
const X_TICK_TARGET = 6; // aim for ~6 date ticks across the axis
const GOOD = '#16a34a';
// Distinct line colours for the volume chart, indexed by selection order.
const SERIES_COLORS = [
  '#2563eb', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6',
  '#ec4899', '#14b8a6', '#a16207', '#0ea5e9', '#6366f1',
];

// ─── Reusable scrolling bar chart ──────────────────────────────────────────────
// Horizontal bar chart with a fixed y-axis and a sparse "5/6" date x-axis. The
// parent owns the ScrollView ref + onScroll + onContentSizeChange so it can keep
// this chart's horizontal position in lockstep with the volume chart (PAIN OVER
// TIME is the master timeline). `data` is [{ key, date, value }].

function BarChart({ data, maxValue, yLabels, barColor, caption, scrollRef, scrollHandlers, onContentSizeChange }) {
  // Label every Nth bar so "5/6" ticks never collide; always label the last one.
  const step = Math.max(3, Math.ceil(data.length / X_TICK_TARGET));

  return (
    <View>
      <View style={s.plotRow}>
        <View style={[s.yAxis, { width: Y_AXIS_W }]}>
          {yLabels.map((label) => (
            <Text key={label} style={s.axisLabel}>{label}</Text>
          ))}
        </View>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.bars}
          onContentSizeChange={onContentSizeChange}
          {...scrollHandlers}
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

function PainTimeline({ series, scrollRef, scrollHandlers, onContentSizeChange }) {
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
      scrollRef={scrollRef}
      scrollHandlers={scrollHandlers}
      onContentSizeChange={onContentSizeChange}
    />
  );
}

// ─── Volume per exercise (line chart) ───────────────────────────────────────────
// One or more exercises overlaid as lines on a shared kg axis, so they're directly
// comparable. The x-axis is the PAIN OVER TIME timeline (every logged day) — passed
// in as `masterDates` — so a volume point sits at the same x as that day's pain bar,
// and the two charts scroll in lockstep. A line bridges days an exercise wasn't done
// (the usual line-chart caveat). Drawn with react-native-svg.

const VOL_PAD = { top: 10, bottom: 22 };

// "Nice" rounded y-axis ticks: ~`count` intervals ending on a clean number, so
// the axis reads 0 / 400 / 800 / 1200 rather than 0 / 1057. Returns the tick
// values plus the rounded-up max the chart should scale to.
function niceTicks(max, count) {
  if (max <= 0) return { ticks: [0], niceMax: 1 };
  const rawStep = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const niceStep = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const niceMax = Math.ceil(max / niceStep) * niceStep;
  const ticks = [];
  for (let v = 0; v <= niceMax + niceStep / 2; v += niceStep) ticks.push(Math.round(v));
  return { ticks, niceMax };
}

function VolumeLineChart({ seriesList, masterDates, scrollRef, scrollHandlers, onContentSizeChange }) {
  const [tip, setTip] = useState(null); // tapped point: { key, x, y, main, sub }

  // Clear the tooltip when the selection changes (axis + coords shift). We no
  // longer remount the chart on selection, so it stays put / synced with pain.
  const seriesKey = seriesList.map((ser) => ser.name).join('|');
  useEffect(() => { setTip(null); }, [seriesKey]);

  const maxVol = Math.max(0, ...seriesList.flatMap((ser) => ser.points.map((p) => p.volume)));
  if (masterDates.length === 0 || maxVol <= 0) {
    return (
      <Text style={s.empty}>No weighted volume logged for the selected exercise(s) yet.</Text>
    );
  }

  const contentW = masterDates.length * DAY_W;
  const plotH = PLOT_H - VOL_PAD.top - VOL_PAD.bottom;
  const { ticks, niceMax } = niceTicks(maxVol, 4);
  const indexOf = (date) => masterDates.indexOf(date);
  const xAt = (date) => indexOf(date) * DAY_W + DAY_W / 2; // same centring as the pain bars
  const yAt = (vol) => VOL_PAD.top + (1 - vol / niceMax) * plotH;
  const step = Math.max(3, Math.ceil(masterDates.length / X_TICK_TARGET));

  // Tap a point to pin/unpin a tooltip with its value.
  const tapPoint = (ser, p) => {
    const key = `${ser.name}@${p.date}`;
    setTip((prev) =>
      prev && prev.key === key
        ? null
        : {
            key,
            x: xAt(p.date),
            y: yAt(p.volume),
            main: `${Math.round(p.volume)} kg`,
            sub: `${ser.name} · ${formatDayMonthSlash(p.date)}`,
          }
    );
  };

  // Tooltip box, clamped to stay inside the scrollable content width.
  let tipBox = null;
  if (tip) {
    const w = Math.max(tip.main.length, tip.sub.length) * 6 + 14;
    const h = 30;
    const x = Math.max(2, Math.min(tip.x - w / 2, contentW - w - 2));
    const y = tip.y - h - 8 < 0 ? tip.y + 10 : tip.y - h - 8;
    tipBox = { x, y, w, h };
  }

  return (
    <View style={s.plotRow}>
      {/* fixed y-axis (does not scroll) */}
      <Svg width={Y_AXIS_W} height={PLOT_H}>
        {ticks.map((t) => (
          <SvgText key={t} x={Y_AXIS_W - 6} y={yAt(t) + 3} fontSize="10" fill={C.muted} textAnchor="end">
            {t}
          </SvgText>
        ))}
      </Svg>

      {/* scrollable plot, locked to the pain chart's scroll position */}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onContentSizeChange={onContentSizeChange}
        {...scrollHandlers}
      >
        <Svg width={contentW} height={PLOT_H}>
          {/* horizontal gridlines at each y tick */}
          {ticks.map((t) => (
            <Line key={t} x1={0} y1={yAt(t)} x2={contentW} y2={yAt(t)} stroke={C.inner} strokeWidth="1" />
          ))}

          {/* one polyline (with visible dots) per selected exercise */}
          {seriesList.map((ser) => {
            const pts = ser.points.filter((p) => indexOf(p.date) >= 0);
            return (
              <React.Fragment key={ser.name}>
                <Polyline
                  points={pts.map((p) => `${xAt(p.date)},${yAt(p.volume)}`).join(' ')}
                  fill="none"
                  stroke={ser.color}
                  strokeWidth="2"
                />
                {pts.map((p) => (
                  <Circle key={p.date} cx={xAt(p.date)} cy={yAt(p.volume)} r="2.5" fill={ser.color} />
                ))}
              </React.Fragment>
            );
          })}

          {/* sparse x-axis date ticks ("5/6") — same dates/positions as the pain chart */}
          {masterDates.map((d, i) =>
            i % step === 0 || i === masterDates.length - 1 ? (
              <SvgText key={d} x={i * DAY_W + DAY_W / 2} y={PLOT_H - 6} fontSize="9" fill={C.muted} textAnchor="middle">
                {formatDayMonthSlash(d)}
              </SvgText>
            ) : null
          )}

          {/* invisible, larger tap targets over each point */}
          {seriesList.map((ser) =>
            ser.points
              .filter((p) => indexOf(p.date) >= 0)
              .map((p) => (
                <Circle
                  key={`${ser.name}@${p.date}`}
                  cx={xAt(p.date)}
                  cy={yAt(p.volume)}
                  r="11"
                  fill="transparent"
                  onPress={() => tapPoint(ser, p)}
                />
              ))
          )}

          {/* tooltip for the tapped point */}
          {tipBox && (
            <React.Fragment>
              <Rect x={tipBox.x} y={tipBox.y} width={tipBox.w} height={tipBox.h} rx="4" fill={C.text} opacity="0.92" />
              <SvgText x={tipBox.x + tipBox.w / 2} y={tipBox.y + 13} fontSize="11" fontWeight="bold" fill="#fff" textAnchor="middle">
                {tip.main}
              </SvgText>
              <SvgText x={tipBox.x + tipBox.w / 2} y={tipBox.y + 24} fontSize="9" fill="#fff" textAnchor="middle">
                {tip.sub}
              </SvgText>
            </React.Fragment>
          )}
        </Svg>
      </ScrollView>
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
  const [picked, setPicked] = useState([]); // exercises overlaid on the volume chart

  // Pain (master) and volume charts scroll together over the same timeline.
  const painScrollRef = useRef(null);
  const volScrollRef = useRef(null);
  const activeChart = useRef(null); // which chart the user is actively scrolling

  useFocusEffect(
    useCallback(() => {
      setSeries(getPainSeries());
      setImpact(getActivityImpact());
      const ex = getExerciseImpact();
      setExImpact(ex);
      setVolumeByExercise(getExerciseVolumeSeries());
      setSymptoms(getSymptomStats());
      // Seed/clean the volume selection: drop picks no longer in the top list, and
      // default to the single most pain-linked exercise the first time.
      const topNames = ex.items
        .filter((i) => i.n >= MIN_OCCURRENCES)
        .slice(0, MAX_EXERCISES)
        .map((i) => i.name);
      setPicked((prev) =>
        prev.length ? prev.filter((n) => topNames.includes(n)) : topNames.slice(0, 1)
      );
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
  const exTopNames = exTop.map((i) => i.name);
  const selectedNames = picked.filter((n) => exTopNames.includes(n));
  const volSeriesList = selectedNames.map((name, idx) => ({
    name,
    color: SERIES_COLORS[idx % SERIES_COLORS.length],
    points: volumeByExercise[name] || [],
  }));
  const toggleExercise = (name) =>
    setPicked((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));

  // Keep the two charts horizontally in lockstep. Only the chart the user is
  // actively dragging/flinging drives the other; the driven chart's scroll events
  // are ignored, so the programmatic scrollTo can't bounce back and fight (which
  // caused the jitter / double image). Begin-drag and momentum-begin fire only for
  // real user input — never for scrollTo — so the follower never grabs control.
  const scrollHandlers = (me, other) => ({
    scrollEventThrottle: 16,
    onScrollBeginDrag: () => { activeChart.current = me; },
    onMomentumScrollBegin: () => { activeChart.current = me; },
    onScrollEndDrag: () => { if (activeChart.current === me) activeChart.current = null; },
    onMomentumScrollEnd: () => { if (activeChart.current === me) activeChart.current = null; },
    onScroll: (e) => {
      if (activeChart.current !== me) return;
      other.current?.scrollTo({ x: e.nativeEvent.contentOffset.x, animated: false });
    },
  });
  const positionToEnd = (ref) => () => ref.current?.scrollToEnd({ animated: false });

  return (
    <SafeAreaView style={s.container} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={s.content}>
        <Card mode="elevated" elevation={2} style={s.card}>
          <Card.Content>
            <Text variant="labelSmall" style={s.section}>PAIN OVER TIME</Text>
            <PainTimeline
              series={series}
              scrollRef={painScrollRef}
              scrollHandlers={scrollHandlers('pain', volScrollRef)}
              onContentSizeChange={positionToEnd(painScrollRef)}
            />
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
                  Training volume (weight × reps, in kg) per session. Tap to add or remove
                  exercises — they share one kg axis so you can compare them.
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
                      selected={selectedNames.includes(item.name)}
                      onPress={() => toggleExercise(item.name)}
                      style={s.chip}
                    >
                      {item.name}
                    </Chip>
                  ))}
                </ScrollView>
                {selectedNames.length === 0 ? (
                  <Text style={s.empty}>Pick at least one exercise above.</Text>
                ) : (
                  <>
                    <VolumeLineChart
                      seriesList={volSeriesList}
                      masterDates={series.map((p) => p.date)}
                      scrollRef={volScrollRef}
                      scrollHandlers={scrollHandlers('vol', painScrollRef)}
                      onContentSizeChange={positionToEnd(volScrollRef)}
                    />
                    {volSeriesList.length > 1 && (
                      <View style={s.legend}>
                        {volSeriesList.map((ser) => (
                          <View key={ser.name} style={s.legendItem}>
                            <View style={[s.legendDot, { backgroundColor: ser.color }]} />
                            <Text style={s.legendLabel}>{ser.name}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </>
                )}
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
  bars: { alignItems: 'flex-start' },
  barSlot: { width: 12, alignItems: 'center', marginHorizontal: 1.5 },
  barBox: { width: 12, height: PLOT_H, justifyContent: 'flex-end' },
  bar: { width: 12, borderRadius: 2 },
  xTick: { width: 34, marginTop: 4, fontSize: 9, color: C.muted, textAlign: 'center' },
  chips: { paddingBottom: 14, paddingRight: 4 },
  chip: { marginRight: 8 },
  caption: { color: C.muted, fontSize: 12, marginTop: 8, textAlign: 'center' },

  // Volume line-chart legend
  legend: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { color: C.text, fontSize: 12 },

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
