import { h, fmt, download, pickFile, dateKey } from '../util.js';
import { getProfile, update, exportData, importData, resetAll, subscribe } from '../store.js';
import { AVATARS, CONFIG } from '../config.js';
import { levelInfo, BADGES } from '../engine.js';
import { backendState } from '../backend.js';
import { toast, confirmBox } from '../fx.js';
import { sfx } from '../audio.js';

export function render() {
  const el = h('div', { class: 'screen' });
  const draw = () => {
    const p = getProfile();
    const lv = levelInfo(p.xp);
    const acc = p.stats.answered ? Math.round((p.stats.correct / p.stats.answered) * 100) : 0;

    const name = h('input', { class: 'input', value: p.name, maxlength: 24 });
    const team = h('input', { class: 'input', value: p.team, maxlength: 24, placeholder: 'اسم الفريق' });
    const save = () => {
      const n = name.value.trim();
      if (n.length < 2) return toast('الاسم قصير', 'err');
      update((x) => { x.name = n; x.team = team.value.trim(); });
      toast('اتحفظ ✅', 'ok');
    };

    const toggle = (label, key, hint) => h('label', { class: 'toggle' },
      h('div', null, h('b', null, label), hint && h('small', { class: 'muted' }, hint)),
      h('input', { type: 'checkbox', checked: p.prefs[key] ? true : null, onchange: (e) => { update((x) => { x.prefs[key] = e.target.checked; }); sfx('tap'); } }),
      h('i', { class: 'sw' }));

    el.replaceChildren(
      h('div', { class: 'profile-head' },
        h('div', { class: 'avatar xl' }, p.avatar),
        h('h1', null, p.name),
        h('div', { class: 'muted' }, `المستوى ${lv.level} · ${lv.title}`),
        h('div', { class: 'xp wide' }, h('div', { class: 'bar' }, h('i', { style: { width: lv.pct + '%' } })), h('small', null, `${fmt(p.xp)} خبرة`))),
      h('div', { class: 'stats-grid' },
        stat('⭐', fmt(p.score), 'النقاط'), stat('🔥', p.bestStreak, 'أفضل سلسلة'),
        stat('📅', Object.keys(p.days).length + '/' + CONFIG.daysTotal, 'أيام مكتملة'), stat('🎯', acc + '%', 'دقة الإجابات'),
        stat('✅', fmt(p.stats.correct), 'إجابات صحيحة'), stat('🚀', p.stats.fast, 'إجابات برق')),

      h('h2', { class: 'sec' }, `الشارات (${p.badges.length}/${BADGES.length})`),
      h('div', { class: 'badges' }, BADGES.map((b) => h('div', { class: 'badge ' + (p.badges.includes(b.id) ? 'on' : 'off'), title: b.desc }, h('span', null, p.badges.includes(b.id) ? b.icon : '🔒'), h('small', null, b.title), h('em', null, b.desc)))),

      h('h2', { class: 'sec' }, 'الملف الشخصي'),
      h('div', { class: 'card stack' },
        h('label', { class: 'lbl' }, 'الشخصية'),
        h('div', { class: 'avatars' }, AVATARS.map((a) => h('button', { class: 'av' + (a === p.avatar ? ' on' : ''), onclick: () => { update((x) => { x.avatar = a; }); sfx('tap'); } }, a))),
        h('label', { class: 'lbl' }, 'الاسم'), name, h('label', { class: 'lbl' }, 'الفريق'), team,
        h('button', { class: 'btn btn-gold', onclick: save }, 'حفظ')),

      h('h2', { class: 'sec' }, 'الإعدادات'),
      h('div', { class: 'card' },
        toggle('الأصوات', 'sound'), toggle('الاهتزاز', 'haptics'),
        toggle('وضع التجربة', 'preview', 'يفتح كل الأيام والعجلة وسؤال الليل لاختبار التطبيق قبل رمضان')),

      h('h2', { class: 'sec' }, 'بياناتك'),
      h('div', { class: 'card stack' },
        h('button', { class: 'btn btn-ghost', onclick: () => { download(`ramadan-quiz-backup-${dateKey()}.json`, exportData()); toast('اتنزلت النسخة الاحتياطية'); } }, '💾 نسخة احتياطية'),
        h('button', { class: 'btn btn-ghost', onclick: async () => { const t = await pickFile(); if (!t) return; try { importData(t); toast('اتستعادت البيانات ✅', 'ok'); } catch (e) { toast('الملف مش صالح', 'err'); } } }, '📥 استعادة نسخة'),
        h('button', { class: 'btn btn-ghost danger', onclick: async () => { if (await confirmBox('مسح كل البيانات؟', 'هتفقد تقدمك على الجهاز ده نهائياً.', 'امسح', 'إلغاء')) { resetAll(); location.hash = '#/welcome'; location.reload(); } } }, '🗑️ مسح كل شيء'),
        (backendState().mode === 'local' || backendState().admin) && h('button', { class: 'btn btn-ghost', onclick: () => { location.hash = '#/admin'; } }, '🛠️ لوحة الإدارة')),
      h('p', { class: 'fine' }, `${CONFIG.appName} ${CONFIG.year} · الإصدار ${CONFIG.version} · ${backendState().mode === 'firebase' ? 'متصل بـ Firebase' : 'وضع محلي'}`));
  };
  const stat = (i, v, l) => h('div', { class: 'stat' }, h('span', null, i), h('b', null, v), h('small', null, l));
  draw();
  // نعيد الرسم عند تغيّر الملف الشخصي، لكن مش أثناء الكتابة في الحقول
  const un = subscribe(() => { if (!document.activeElement || document.activeElement.tagName !== 'INPUT') draw(); });
  return { el, destroy: un };
}
