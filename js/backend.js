// واجهة موحّدة للخلفية: وضع محلي (افتراضي) أو Firebase (اختياري)
import { getProfile, getSettings, setSettings } from './store.js';
import { getRemote, saveRemote, invalidate } from './bank.js';

let impl = null;
let state = { mode: 'local', admin: false, error: '' };
const listeners = new Set();
export const onBackend = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((f) => f(state));

export const backendState = () => state;
export const isOnlineMode = () => state.mode === 'firebase';

export async function initBackend() {
  try {
    const { firebaseConfig } = await import('../firebase-config.js');
    if (!firebaseConfig || !firebaseConfig.apiKey) return;
    const mod = await import('./backend-firebase.js');
    impl = await mod.create(firebaseConfig);
    state = { mode: 'firebase', admin: false, error: '' };
    emit();
    // مزامنة خلفية: لا تعطّل التطبيق لو مفيش نت
    impl.isAdmin().then((a) => { state = { ...state, admin: a }; emit(); }).catch(() => {});
    refreshRemote();
    if (getProfile().name) syncProfile();
  } catch (e) {
    console.warn('Firebase غير متاح، سنكمل بالوضع المحلي', e);
    state = { mode: 'local', admin: false, error: String(e?.message || e) };
    emit();
  }
}

export function syncProfile() {
  if (!impl) return;
  impl.pushProfile(getProfile()).catch((e) => console.warn('sync', e));
}

export async function fetchLeaderboard() {
  if (!impl) return null;
  return impl.leaderboard();
}

/** أسئلة وإعدادات من الأدمن (تُخزَّن محلياً فتشتغل أوفلاين) */
export async function refreshRemote() {
  if (!impl) return;
  try {
    const qs = await impl.fetchQuestions();
    if (qs.length) { saveRemote(qs); invalidate(); }
    const cfg = await impl.fetchConfig();
    if (cfg) setSettings({ ramadanStart: cfg.ramadanStart || getSettings().ramadanStart, announce: cfg.announce || '' });
  } catch (e) { console.warn('remote', e); }
}

export async function publishQuestion(q) {
  if (!impl) throw new Error('Firebase غير مفعّل');
  return impl.publishQuestion(q);
}
export async function publishConfig(cfg) {
  if (!impl) throw new Error('Firebase غير مفعّل');
  return impl.publishConfig(cfg);
}

export { getRemote };
