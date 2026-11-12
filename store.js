// حالة اللاعب والإعدادات — محفوظة على الجهاز (تعمل أوفلاين)
import { dateKey } from './util.js';

const PK = 'rq27.profile';
const SK = 'rq27.settings';

function uid() {
  try { if (crypto.randomUUID) return crypto.randomUUID(); } catch { /* ignore */ }
  return 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function fresh() {
  return {
    v: 2,
    id: uid(),
    name: '',
    avatar: '🌙',
    team: '',
    xp: 0,
    score: 0,
    streak: 0,
    bestStreak: 0,
    lastDay: 0,
    days: {},            // { [dayNumber]: {score, correct, total, stars, late, at} }
    inv: { fifty: 2, freeze: 2, skip: 1 },
    badges: [],
    wheelDate: '',
    nights: [],          // مفاتيح تواريخ سؤال الليل المُجاب
    stats: { answered: 0, correct: 0, fast: 0, practiceRuns: 0, practiceCorrect: 0, wheelSpins: 0, jackpots: 0 },
    prefs: { sound: true, haptics: true, preview: false },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function merge(base, saved) {
  const out = { ...base, ...saved };
  out.inv = { ...base.inv, ...(saved.inv || {}) };
  out.stats = { ...base.stats, ...(saved.stats || {}) };
  out.prefs = { ...base.prefs, ...(saved.prefs || {}) };
  out.days = saved.days || {};
  out.badges = saved.badges || [];
  out.nights = saved.nights || [];
  return out;
}

function read(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
function write(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* التخزين ممتلئ أو ممنوع */ }
}

let profile = (() => { const s = read(PK); return s ? merge(fresh(), s) : fresh(); })();
const subs = new Set();

export const getProfile = () => profile;
export const hasProfile = () => !!profile.name;
export const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };

export function update(fn) {
  fn(profile);
  profile.updatedAt = Date.now();
  write(PK, profile);
  subs.forEach((f) => f(profile));
}

export function replaceProfile(p) {
  profile = merge(fresh(), p);
  write(PK, profile);
  subs.forEach((f) => f(profile));
}

// ── الإعدادات العامة (تاريخ رمضان، أسئلة مخفية، إعلان من الأدمن)
const defSettings = { ramadanStart: '', hiddenIds: [], announce: '' };
let settings = { ...defSettings, ...(read(SK) || {}) };
export const getSettings = () => settings;
export function setSettings(patch) {
  settings = { ...settings, ...patch };
  write(SK, settings);
}

// ── نسخة احتياطية
export function exportData() {
  return JSON.stringify({ app: 'rq27', exportedAt: new Date().toISOString(), profile, settings, custom: read('rq27.custom') || [] }, null, 2);
}
export function importData(text) {
  const d = JSON.parse(text);
  if (d.app !== 'rq27' || !d.profile) throw new Error('ملف غير صالح');
  replaceProfile(d.profile);
  if (d.settings) setSettings(d.settings);
  if (Array.isArray(d.custom)) write('rq27.custom', d.custom);
}
export function resetAll() {
  ['rq27.profile', 'rq27.settings', 'rq27.custom', 'rq27.remote', 'rq27.round'].forEach((k) => localStorage.removeItem(k));
  profile = fresh();
  settings = { ...defSettings };
}

// ── تقدم الجولة الجارية (لمنع الخروج وإعادة المحاولة)
export const roundMarker = {
  get: () => read('rq27.round'),
  set: (v) => write('rq27.round', v),
  clear: () => localStorage.removeItem('rq27.round'),
};

export const todayKey = () => dateKey();
export { read as readKey, write as writeKey };
