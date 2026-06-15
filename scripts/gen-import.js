// One-off generator: turns the 59-day Norwegian log into a JSON backup the app
// can import (same shape as the app's JSON export). Run: node scripts/gen-import.js
// Decisions: pain scale 0–3 (mild); "strak mark"/RDL = Romanian deadlift;
// symptoms tagged from text; exercises recorded even without weight/reps.

const fs = require('fs');
const path = require('path');

// Day 1 = Monday 2026-04-06  (Day 59 = Wednesday 2026-06-03).
const DAY1 = '2026-04-06';
function dateForDay(n) {
  const [y, m, d] = DAY1.split('-').map(Number);
  const dt = new Date(y, m - 1, d + (n - 1));
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

// helpers
const ex = (name, sets = []) => ({
  name,
  order_idx: 0, // fixed up per activity below
  sets: sets.map(([weight_kg, reps], i) => ({
    set_number: i + 1,
    weight_kg: weight_kg ?? null,
    reps: reps ?? null,
  })),
});
const strength = (exercises) => ({
  type: 'styrke',
  duration_min: null,
  distance_km: null,
  notes: '',
  exercises: exercises.map((e, i) => ({ ...e, order_idx: i })),
});
const cardio = (type, duration_min = null) => ({
  type,
  duration_min,
  distance_km: null,
  notes: '',
  exercises: [],
});
const walk = () => cardio('tur', null);

const D = {};
D[1]  = { pain: 0, notes: 'Første økt etter sykdom. Ingen vondt i kne.', symptoms: [], activities: [] };
D[2]  = { pain: 0, notes: 'Ingen vondt.', symptoms: [], activities: [ strength([
  ex('Deadlift', [[120,5],[140,4],[130,5],[130,5],[130,5]]),
  ex('Romanian deadlift', [[100,8],[100,8],[100,8],[100,8]]),
  ex('Leg curl', [[60,8],[60,8],[60,8],[60,8]]),
  ex('Hip thrust', [[140,10],[140,10],[140,10],[140,10]]),
]) ] };
D[3]  = { pain: 0, notes: 'Ingen smerter. Ganske slitsomt.', symptoms: [], activities: [ cardio('sykling',20), cardio('staking',20) ] };
D[4]  = { pain: 0, notes: 'Ingen smerter', symptoms: [], activities: [] };
D[5]  = { pain: 0, notes: 'Kjørte veldig høy knebøy til boks med 100kg, 5 reps. Ingen smerter før eller etter. Så vanlig beinøkt etter, uten Markløft.', symptoms: [], activities: [ strength([ ex('Box squat', [[100,5]]) ]) ] };
D[6]  = { pain: 0, notes: 'Ingen smerter', symptoms: [], activities: [] };
D[7]  = { pain: 0, notes: 'Ingen smerter. Gikk en lang tur i byen. Ble en del skritt i natt også.', symptoms: [], activities: [ walk() ] };
D[8]  = { pain: 0, notes: 'Ingen smerter. Benkeøkt.', symptoms: [], activities: [ strength([ ex('Bench press') ]) ] };
D[9]  = { pain: 1, notes: 'Noe stikking i starten av dagen når jeg skulle gå i trappa mildt. Gav seg fort.', symptoms: ['morning','stairs_up'], activities: [] };
D[10] = { pain: 0, notes: 'Bra. Svømmer. Føles ok etterpå, men ble en veldig rolig økt. Litt beinspark.', symptoms: [], activities: [ cardio('svomming', null) ] };
D[11] = { pain: 1, notes: 'Mulig det er litt mer sårt. Ikke mye, men føles litt dårligere ut.', symptoms: [], activities: [] };
[12,13,14,15].forEach((n) => { D[n] = { pain: 0, notes: 'Bra!', symptoms: [], activities: [] }; });
D[16] = { pain: 0, notes: 'Både knebøy og Markløft i dag. Vurdere å droppe en øvelse her. Kanskje strak mark ryker.', symptoms: [], activities: [ strength([
  ex('Deadlift', [[140,4],[140,4],[140,4],[140,4],[130,5]]),
  ex('Squat', [[110,5],[110,5],[110,5],[115,5],[115,5]]),
]) ] };
D[17] = { pain: 1, notes: 'Litt ish, men stort sett bra. Kjører staking i dag. Dropper sykkel. 10 min ellipse.', symptoms: [], activities: [ cardio('staking', null), cardio('ellipse', 10) ] };
D[18] = { pain: 0, notes: 'Ganske bra.', symptoms: [], activities: [] };
D[19] = { pain: 1, notes: 'Småstikking, men ikke sånn at jeg tror det gjør noe. Kjører veldig høy bøy. Prøver å holde vinkelen i ankelen lik eller mindre enn i Markløft.', symptoms: [], activities: [ strength([
  ex('Squat', [[120,5],[130,5]]),
  ex('Romanian deadlift'),
  ex('Leg curl'),
  ex('Hip thrust'),
]) ] };
D[20] = { pain: 1, notes: 'Samme som dagen før.', symptoms: [], activities: [] };
D[21] = { pain: 0, notes: 'Ok', symptoms: [], activities: [] };
D[22] = { pain: 0, notes: 'Ok. Trente mark 5 reps + knebøy 8 reps. Ingen smerter under økta.', symptoms: [], activities: [ strength([
  ex('Deadlift', [[null,5]]),
  ex('Squat', [[null,8]]),
]) ] };
D[23] = { pain: 1, notes: 'Småstikking. Gikk 20000 steg. Merka det i slutten av dagen.', symptoms: ['walking'], activities: [ walk() ] };
D[24] = { pain: 1, notes: 'Småstikking opp trappene.', symptoms: ['stairs_up'], activities: [] };
D[25] = { pain: 2, notes: 'Litt sår i dag også. Skal ha bein, men dropper knebøy. Tar Markløft og bakside. Gjør dette så lenge kneet viser symptomer.', symptoms: [], activities: [ strength([ ex('Deadlift') ]) ] };
D[26] = { pain: 2, notes: 'Litt sår. Gikk mye på feltstevne og var enda mer sår på kvelden.', symptoms: ['walking'], activities: [ walk() ] };
D[27] = { pain: 2, notes: 'Fortsatt litt sår. Kjenner det i trappene. Ble ny runde på feltstevne i dag og er mer sår på kvelden. Roet seg litt etterhvert.', symptoms: ['stairs_up','walking'], activities: [ walk() ] };
D[28] = { pain: 2, notes: 'Litt sår på morgenen. Ikke så galt, men ca samme som lørdag. Prøve høye utfall?', symptoms: ['morning'], activities: [] };
D[29] = { pain: 3, notes: 'Merker at det er sårt. Til og med ned trappene. Første gang jeg har hatt det på en stund. Skal ta benk press med beina opp i dag, og dropper bein i morgen.', symptoms: ['stairs_down'], activities: [ strength([ ex('Bench press') ]) ] };
D[30] = { pain: 2, notes: 'Ganske likt. Kanskje litt bedre. Dropper Markløft, men trener bakside.', symptoms: [], activities: [] };
D[31] = { pain: 2, notes: 'Merker også at sitting gjør kneet sårt. Sånn det pleide å være før. Har ikke lagt merke til at disse symptomene forsvant.', symptoms: ['sitting'], activities: [] };
D[32] = { pain: 2, notes: 'Ble gradvis bedre. Fortsatt ingen beintrening.', symptoms: [], activities: [] };
D[33] = { pain: 1, notes: 'Ble gradvis bedre. Fortsatt ingen beintrening.', symptoms: [], activities: [] };
D[34] = { pain: 1, notes: 'Ble gradvis bedre. Fortsatt ingen beintrening.', symptoms: [], activities: [] };
D[35] = { pain: 0, notes: 'Ble gradvis bedre. Fortsatt ingen beintrening.', symptoms: [], activities: [] };
D[36] = { pain: 1, notes: 'Begynner å bli bra, men kjenner fortsatt at det stikker litt i trappene. Vanlig brystøkt, men holder mer vertikal vinkel i knæra på benkpress.', symptoms: ['stairs_up'], activities: [ strength([ ex('Bench press') ]) ] };
D[37] = { pain: 1, notes: 'Mulig mindre stikking. Kjører Markløft i dag, men holder meg unna alt på quads.', symptoms: [], activities: [ strength([ ex('Deadlift') ]) ] };
D[38] = { pain: 1, notes: 'Ganske likt. Ingen trening.', symptoms: [], activities: [] };
D[39] = { pain: 1, notes: 'Greit. Lite stikking.', symptoms: [], activities: [] };
D[40] = { pain: 1, notes: 'Samme. Trente 5x5 på 130 i mark, en ny øvelse på glutes, Hip thrust, strak mark og leg curl.', symptoms: [], activities: [ strength([
  ex('Deadlift', [[130,5],[130,5],[130,5],[130,5],[130,5]]),
  ex('Glute machine'),
  ex('Hip thrust'),
  ex('Romanian deadlift'),
  ex('Leg curl'),
]) ] };
D[41] = { pain: 3, notes: 'Definitivt mer sår. Ikke helt sykt, men mer sår. Mistenker den nye glutemaskinen kan ha påvirka noe. Ble en del fleks i kneet. Kjører en sykkeløkt og staking.', symptoms: [], activities: [ cardio('sykling', null), cardio('staking', null) ] };
D[42] = { pain: 0, notes: 'Ganske god.', symptoms: [], activities: [] };
D[43] = { pain: 0, notes: 'Bra. Nesten smertefri', symptoms: [], activities: [] };
D[44] = { pain: 0, notes: 'Samme som i går.', symptoms: [], activities: [] };
D[45] = { pain: 0, notes: 'Sykler i 20 min, skiergo i 20 min. Slitsomt. Ingen smerter.', symptoms: [], activities: [ cardio('sykling', 20), cardio('staking', 20) ] };
D[46] = { pain: 0, notes: 'Bra', symptoms: [], activities: [] };
D[47] = { pain: 0, notes: 'Bra, 5x5 Markløft', symptoms: [], activities: [ strength([ ex('Deadlift', [[null,5],[null,5],[null,5],[null,5],[null,5]]) ]) ] };
D[48] = { pain: 0, notes: 'Bra, sykling + skiergo', symptoms: [], activities: [ cardio('sykling', null), cardio('staking', null) ] };
D[49] = { pain: 0, notes: 'Bra', symptoms: [], activities: [] };
D[50] = { pain: 1, notes: 'Bra, benkpress. Kanskje litt sårt på kvelden, men ikke mye.', symptoms: ['after_exercise'], activities: [ strength([ ex('Bench press') ]) ] };
D[51] = { pain: 1, notes: 'Bra, tung Markløft: 140,155,162,170,140. Ingen smerter under Markløft. Lett sårhet på Hip thrust (vanlig).', symptoms: ['during_exercise'], activities: [ strength([
  ex('Deadlift', [[140,null],[155,null],[162,null],[170,null],[140,null]]),
  ex('Hip thrust'),
]) ] };
D[52] = { pain: 1, notes: 'Bra. 20 min sykling, 20 min staking. Slitsomt. Kjente litt sårhet i kneet i etterkant. Ikke mye, men litt.', symptoms: ['after_exercise'], activities: [ cardio('sykling', 20), cardio('staking', 20) ] };
D[53] = { pain: 2, notes: 'Litt mer sårt. Ikke galt, men mer enn i går på denne tida. Rart at det varierer selv om jeg kjører samme kondisøkt.', symptoms: [], activities: [] };
D[54] = { pain: 0, notes: 'Bra', symptoms: [], activities: [] };
D[55] = { pain: 0, notes: 'Bra', symptoms: [], activities: [] };
D[56] = { pain: 0, notes: 'Bra', symptoms: [], activities: [] };
D[57] = { pain: 0, notes: 'Bra', symptoms: [], activities: [] };
D[58] = { pain: 0, notes: 'Bra, opp til 160x2 på mark, og testa litt bulgarsk utfall: 10kg 4x5. Lett, med høy vinkel.', symptoms: [], activities: [ strength([
  ex('Deadlift', [[160,2]]),
  ex('Bulgarian split squat', [[10,5],[10,5],[10,5],[10,5]]),
]) ] };
D[59] = { pain: 0, notes: 'Bra. Sykling og staking, 20 min hver.', symptoms: [], activities: [ cardio('sykling', 20), cardio('staking', 20) ] };

const logs = [];
for (let n = 1; n <= 59; n++) {
  const day = D[n];
  if (!day) throw new Error('Missing day ' + n);
  logs.push({
    date: dateForDay(n),
    pain_level: day.pain,
    notes: day.notes,
    symptoms: day.symptoms,
    activities: day.activities,
  });
}

const out = path.join(__dirname, '..', 'injury_log_import.json');
fs.writeFileSync(out, JSON.stringify(logs, null, 2), 'utf8');

// quick sanity report
const acts = {};
let exCount = 0;
for (const l of logs) for (const a of l.activities) {
  acts[a.type] = (acts[a.type] || 0) + 1;
  exCount += (a.exercises || []).length;
}
console.log(`Wrote ${logs.length} days → ${out}`);
console.log(`First day ${logs[0].date}, last day ${logs[58].date}`);
console.log('Activities by type:', acts);
console.log('Total exercise rows:', exCount);
