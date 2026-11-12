// نقطة البداية + الراوتر + شريط التنقل
import { h, $ } from './util.js';
import { hasProfile, subscribe } from './store.js';
import { initBackend, syncProfile } from './backend.js';
import * as welcome from './screens/welcome.js';
import * as home from './screens/home.js';
import * as quiz from './screens/quiz.js';
import * as practice from './screens/practice.js';
import * as board from './screens/board.js';
import * as me from './screens/me.js';
import * as wheel from './screens/wheel.js';
import * as admin from './screens/admin.js';
import { sfx } from './audio.js';

const SCREENS = { welcome, home, quiz, practice, board, me, wheel, admin };
const NAV = [
  { id: 'home', icon: '🏠', label: 'الرئيسية' },
  { id: 'practice', icon: '🎯', label: 'تدريب' },
  { id: 'board', icon: '🏆', label: 'الترتيب' },
  { id: 'me', icon: '👤', label: 'حسابي' },
];

export const navigate = (path) => { location.hash = '#' + path; };

function parse() {
  const raw = location.hash.slice(1) || '/home';
  const [path, qs] = raw.split('?');
  const seg = path.split('/').filter(Boolean);
  return { name: seg[0] || 'home', seg, q: Object.fromEntries(new URLSearchParams(qs || '')) };
}

const app = $('#app');
let current = null;

function navBar(active) {
  return h('nav', { class: 'nav' }, NAV.map((n) => h('a', {
    href: '#/' + n.id, class: n.id === active ? 'active' : '', onclick: () => sfx('tap'),
  }, h('span', { class: 'ni' }, n.icon), h('span', null, n.label))));
}

function route() {
  try { current?.destroy?.(); } catch (e) { console.warn(e); }
  const r = parse();
  if (!hasProfile() && r.name !== 'welcome') { location.replace('#/welcome'); return; }
  if (hasProfile() && r.name === 'welcome') { location.replace('#/home'); return; }
  const screen = SCREENS[r.name] || SCREENS.home;
  const view = screen.render(r);
  current = view;
  app.replaceChildren(view.el);
  if (view.nav !== false) { app.append(navBar(r.name)); app.classList.add('has-nav'); } else app.classList.remove('has-nav');
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);

// مزامنة الملف الشخصي مع الخلفية (لو Firebase مفعّل) بعد أي تغيير
let syncTimer = 0;
subscribe(() => { clearTimeout(syncTimer); syncTimer = setTimeout(syncProfile, 1500); });

// تثبيت التطبيق
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__installPrompt = e; window.dispatchEvent(new Event('rq-install-ready')); });

// منع التحديد/القائمة أثناء الكويز فقط (بدون تعطيل الإمكانيات الأساسية للمتصفح)
document.addEventListener('contextmenu', (e) => { if (e.target.closest?.('.quiz')) e.preventDefault(); });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW', e)));
}

route();
initBackend();
