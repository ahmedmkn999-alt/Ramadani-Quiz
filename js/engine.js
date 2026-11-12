// محرك اللعبة: التقويم، اختيار الأسئلة، النقاط، المستويات، الشارات، العجلة
import { CONFIG } from './config.js';
import { getBank, getStarter } from './bank.js';
import { getProfile, getSettings, update } from './store.js';
import { dateKey, dayNumber, hashStr, mulberry32, seededShuffle, shuffle, randInt } from './util.js';

// ───────────── التقويم
export function ramadanStartKey() {
  return getSettings().ramadanStart || CONFIG.ramadanStart;
}

export function ramadanInfo(now = new Date()) {
  const diff = dayNumber(dateKey(now)) - dayNumber(ramadanStartKey());
  if (diff < 0) return { phase: 'before', day: 0, daysUntil: -diff };
  if (diff >= CONFIG.daysTotal) return { phase: 'after', day: CONFIG.daysTotal, daysUntil: 0 };
  return { phase: 'during', day: diff + 1, daysUntil: 0 };
}

export const previewOn = () => !!getProfile().prefs.preview;

export function isUnlocked(day) {
  if (previewOn()) return true;
  const info = ramadanInfo();
  return info.phase === 'after' || (info.phase === 'during' && day <= info.day);
}

/** هل اللعب في هذا اليوم يُعتبر متأخراً (يوم مضى)؟ */
export function isLate(day) {
  if (previewOn()) return false;
  const info = ramadanInfo();
  return info.phase === 'after' || (info.phase === 'during' && day < info.day);
}

// ───────────── اختيار الأسئلة
const planFor = (day) => (day <= 10 ? [1, 1, 1, 2, 2] : day <= 20 ? [1, 2, 2, 2, 3] : [2, 2, 3, 3, 3]);

let planCache = { key: '', rounds: [] };

/** يوزّع بنك الأسئلة على ٣٠ يوماً مرة واحدة بشكل ثابت (نفس النتيجة لكل اللاعبين) */
function allRounds() {
  const bank = getBank();
  const key = bank.length + ':' + hashStr(bank.map((q) => q.id).join(','));
  if (planCache.key === key) return planCache.rounds;

  const rnd = mulberry32(hashStr('rq27-' + CONFIG.year));
  const pools = { 1: [], 2: [], 3: [] };
  for (const q of bank) pools[q.diff].push(q);
  for (const d of [1, 2, 3]) pools[d] = seededShuffle(pools[d], rnd);
  const ptr = { 1: 0, 2: 0, 3: 0 };
  const order = { 1: [1, 2, 3], 2: [2, 1, 3], 3: [3, 2, 1] };

  const rounds = [];
  for (let day = 1; day <= CONFIG.daysTotal; day++) {
    const round = [];
    const used = new Set();
    for (const want of planFor(day)) {
      let pick = null;
      // ١) غير مستخدم من الصعوبة المطلوبة ثم الأقرب لها
      for (const d of order[want]) {
        while (ptr[d] < pools[d].length && used.has(pools[d][ptr[d]].id)) ptr[d]++;
        if (ptr[d] < pools[d].length) { pick = pools[d][ptr[d]++]; break; }
      }
      // ٢) لو البنك خلص: نعيد تدوير الأسئلة (بدون تكرار داخل اليوم الواحد)
      if (!pick) {
        const all = seededShuffle(bank.filter((q) => !used.has(q.id)), rnd);
        pick = all.find((q) => q.diff === want) || all[0];
      }
      if (pick) { round.push(pick); used.add(pick.id); }
    }
    rounds.push(round);
  }
  planCache = { key, rounds };
  return rounds;
}

/** يجهّز سؤالاً بخيارات مخلوطة؛ seed ثابت للجولات اليومية */
export function prepare(q, seed) {
  const rnd = seed ? mulberry32(hashStr(seed + q.id)) : Math.random;
  const idx = seededShuffle([0, 1, 2, 3], rnd);
  return { id: q.id, cat: q.cat, diff: q.diff, q: q.q, e: q.e || '', opts: idx.map((i) => q.a[i]), c: idx.indexOf(q.c) };
}

export function buildRound(day) {
  const list = allRounds()[day - 1] || [];
  return list.map((q) => prepare(q, 'd' + day));
}

export function buildPractice(cat, diff, n = 10) {
  let pool = getBank().filter((q) => (!cat || q.cat === cat) && (!diff || q.diff === Number(diff)));
  if (pool.length < n) pool = getBank();
  return shuffle(pool).slice(0, n).map((q) => prepare(q));
}

export function pickNightQuestion(key = dateKey()) {
  const pool = getBank().filter((q) => q.diff >= 2);
  const list = pool.length ? pool : getBank();
  const q = list[hashStr('night' + key) % list.length];
  return prepare(q, 'n' + key);
}

// ───────────── الوقت والنقاط
export const timeFor = (diff) => (diff === 1 ? 15 : diff === 2 ? 20 : 25);
export const isPressureDay = (day) => day >= 26;
/** وضع الضغط (٢٦–٣٠): الإجابة الصحيحة تزيد وقت السؤال التالي والخاطئة تنقصه */
export const pressureTime = (prev, correct) => Math.max(6, Math.min(25, prev + (correct ? 3 : -3)));

export function scoreAnswer({ correct, timeLeft, timeTotal, streak }) {
  if (!correct) return 0;
  const bonus = Math.round(50 * Math.max(0, timeLeft) / timeTotal);
  const mult = 1 + 0.1 * Math.min(streak, 5);
  return Math.round((100 + bonus) * mult);
}

export const starsFor = (correct, total) => (correct >= total ? 3 : correct >= total - 1 ? 2 : correct >= Math.ceil(total * 0.6) ? 1 : 0);

// ───────────── المستويات
export const xpForLevel = (l) => 60 * (l - 1) * (l - 1);
export function levelInfo(xp) {
  const level = Math.floor(Math.sqrt(xp / 60)) + 1;
  const base = xpForLevel(level), next = xpForLevel(level + 1);
  return { level, base, next, pct: Math.round(((xp - base) / (next - base)) * 100), title: titleFor(level) };
}
export function titleFor(l) {
  if (l >= 12) return 'أسطورة رمضان';
  if (l >= 8) return 'عالِم';
  if (l >= 5) return 'فارس';
  if (l >= 3) return 'مجتهد';
  return 'مبتدئ';
}

// ───────────── الشارات
export const BADGES = [
  { id: 'first',   icon: '🌱', title: 'أول خطوة',     desc: 'أكمل أول يوم',                    test: (p) => Object.keys(p.days).length >= 1 },
  { id: 'perfect', icon: '💎', title: 'يوم كامل',      desc: 'جاوب كل أسئلة يوم صح',            test: (p) => Object.values(p.days).some((d) => d.correct === d.total && d.total > 0) },
  { id: 'streak3', icon: '🔥', title: 'ثلاثة متتالية', desc: 'سلسلة ٣ أيام',                    test: (p) => p.bestStreak >= 3 },
  { id: 'streak7', icon: '⚡', title: 'أسبوع كامل',    desc: 'سلسلة ٧ أيام',                    test: (p) => p.bestStreak >= 7 },
  { id: 'streak15',icon: '🏅', title: 'نصف الشهر',     desc: 'سلسلة ١٥ يوم',                    test: (p) => p.bestStreak >= 15 },
  { id: 'streak30',icon: '👑', title: 'ختمتها',        desc: 'سلسلة ٣٠ يوم',                    test: (p) => p.bestStreak >= 30 },
  { id: 'speed',   icon: '🚀', title: 'برق',           desc: '١٠ إجابات صحيحة في أقل من ٣ ثواني', test: (p) => p.stats.fast >= 10 },
  { id: 'scholar', icon: '📚', title: 'عالِم صغير',    desc: '١٠٠ إجابة صحيحة',                 test: (p) => p.stats.correct >= 100 },
  { id: 'night',   icon: '🌃', title: 'سهرانين',       desc: '٥ أسئلة ليل',                     test: (p) => p.nights.length >= 5 },
  { id: 'lucky',   icon: '🍀', title: 'محظوظ',         desc: 'اكسب الجاكبوت في العجلة',          test: (p) => p.stats.jackpots >= 1 },
  { id: 'trainer', icon: '🎯', title: 'مجتهد',         desc: '٥ جولات تدريب',                   test: (p) => p.stats.practiceRuns >= 5 },
  { id: 'lvl5',    icon: '⭐', title: 'مستوى ٥',        desc: 'وصل للمستوى الخامس',              test: (p) => levelInfo(p.xp).level >= 5 },
  { id: 'month',   icon: '🌙', title: 'أتممت الشهر',   desc: 'أكمل ٣٠ يوماً',                   test: (p) => Object.keys(p.days).length >= 30 },
];

/** يضيف الشارات الجديدة للاعب ويعيدها */
export function evaluateBadges() {
  const fresh = [];
  update((p) => {
    for (const b of BADGES) {
      if (!p.badges.includes(b.id) && b.test(p)) { p.badges.push(b.id); fresh.push(b); }
    }
  });
  return fresh;
}

// ───────────── إنهاء يوم
export function completeDay(day, r) {
  const before = levelInfo(getProfile().xp).level;
  const stars = starsFor(r.correct, r.total);
  const late = isLate(day);
  const xpGain = Math.round(r.score * 0.5) + stars * 30 + (r.correct === r.total && r.total ? 100 : 0);
  update((p) => {
    p.days[day] = { score: r.score, correct: r.correct, total: r.total, stars, late, at: Date.now() };
    p.score += r.score;
    p.xp += xpGain;
    p.stats.answered += r.answered;
    p.stats.correct += r.correct;
    p.stats.fast += r.fast;
    if (!late) {
      if (p.lastDay === day - 1) p.streak += 1;
      else if (p.lastDay === day) { /* نفس اليوم */ }
      else p.streak = 1;
      p.lastDay = Math.max(p.lastDay, day);
      p.bestStreak = Math.max(p.bestStreak, p.streak);
    }
  });
  const badges = evaluateBadges();
  const after = levelInfo(getProfile().xp).level;
  return { stars, xpGain, badges, leveledUp: after > before, level: after, late };
}

export function completePractice(correct, total) {
  update((p) => { p.stats.practiceRuns += 1; p.stats.practiceCorrect += correct; });
  return evaluateBadges();
}

// ───────────── العجلة
export const WHEEL = [
  { id: 'xp50',    label: '+50 نقطة',  icon: '⭐', type: 'score', v: 50,  w: 18, color: '#c9972b' },
  { id: 'fifty',   label: '٥٠:٥٠',     icon: '✂️', type: 'inv', k: 'fifty',  w: 14, color: '#2b6f77' },
  { id: 'xp100',   label: '+100 نقطة', icon: '🌟', type: 'score', v: 100, w: 14, color: '#a8711a' },
  { id: 'freeze',  label: '+١٠ ثواني', icon: '⏳', type: 'inv', k: 'freeze', w: 14, color: '#3c5a99' },
  { id: 'none',    label: 'حظ أوفر',   icon: '🍃', type: 'none', w: 14, color: '#4a4f66' },
  { id: 'skip',    label: 'تخطّي',     icon: '⏭️', type: 'inv', k: 'skip',   w: 12, color: '#6a4c93' },
  { id: 'xp200',   label: '+200 نقطة', icon: '💫', type: 'score', v: 200, w: 10, color: '#b5651d' },
  { id: 'jackpot', label: 'جاكبوت 500', icon: '💎', type: 'score', v: 500, w: 4,  color: '#d6336c' },
];

export const canSpinToday = () => getProfile().wheelDate !== dateKey() || previewOn();

export function spinResult() {
  const total = WHEEL.reduce((s, x) => s + x.w, 0);
  let r = randInt(total * 100) / 100;
  for (let i = 0; i < WHEEL.length; i++) { r -= WHEEL[i].w; if (r < 0) return i; }
  return 0;
}

export function applyReward(seg) {
  update((p) => {
    p.wheelDate = dateKey();
    p.stats.wheelSpins += 1;
    if (seg.type === 'score') { p.score += seg.v; p.xp += seg.v; }
    if (seg.type === 'inv') p.inv[seg.k] += 1;
    if (seg.id === 'jackpot') p.stats.jackpots += 1;
  });
  return evaluateBadges();
}

// ───────────── سؤال الليل
export function nightWindowOpen(now = new Date()) {
  if (previewOn()) return true;
  const h = now.getHours();
  return h >= 19 || h < 4;
}
export const nightDone = (key = dateKey()) => getProfile().nights.includes(key);

export function answerNight(correct) {
  const key = dateKey();
  update((p) => {
    p.nights.push(key);
    if (correct) { p.score += 50; p.xp += 150; p.stats.correct += 1; }
    p.stats.answered += 1;
  });
  return evaluateBadges();
}
