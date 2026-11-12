import { h, fmt } from '../util.js';
import { getProfile, getSettings, subscribe } from '../store.js';
import { CONFIG } from '../config.js';
import { ramadanInfo, isUnlocked, isLate, levelInfo, canSpinToday, nightWindowOpen, nightDone, pickNightQuestion, answerNight, previewOn } from '../engine.js';
import { toast, modal, confetti } from '../fx.js';
import { sfx, buzz } from '../audio.js';
import { lantern } from '../icons.js';

const go = (p) => { location.hash = '#' + p; };
const starsText = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

export function render() {
  const el = h('div', { class: 'screen home' });
  const draw = () => {
    const p = getProfile();
    const lv = levelInfo(p.xp);
    const info = ramadanInfo();
    const done = Object.keys(p.days).length;

    // ── الهيدر
    const header = h('header', { class: 'top' },
      h('div', { class: 'who' },
        h('div', { class: 'avatar' }, p.avatar),
        h('div', null, h('div', { class: 'nm' }, p.name), h('div', { class: 'tt' }, `المستوى ${lv.level} · ${lv.title}`))),
      h('div', { class: 'chips' },
        h('div', { class: 'chip fire', title: 'سلسلة الأيام' }, '🔥 ' + p.streak),
        h('div', { class: 'chip gold', title: 'النقاط' }, '⭐ ' + fmt(p.score))));
    const xp = h('div', { class: 'xp' },
      h('div', { class: 'bar' }, h('i', { style: { width: lv.pct + '%' } })),
      h('small', null, `${fmt(p.xp - lv.base)} / ${fmt(lv.next - lv.base)} للمستوى ${lv.level + 1}`));

    // ── كارت الحالة (قبل/أثناء/بعد رمضان)
    let hero;
    if (info.phase === 'before' && !previewOn()) {
      hero = h('div', { class: 'card hero' },
        h('div', { class: 'lantern', html: lantern(36) }),
        h('div', { class: 'big' }, fmt(info.daysUntil)),
        h('div', { class: 'cap' }, 'يوم على رمضان'),
        h('p', { class: 'muted' }, 'جهّز نفسك: دوّر في التدريب، لفّ العجلة، وافتح الأيام بوضع التجربة من «حسابي».'),
        h('button', { class: 'btn btn-gold', onclick: () => go('/practice') }, 'ابدأ التدريب 🎯'));
    } else if (info.phase === 'after' && !previewOn()) {
      hero = h('div', { class: 'card hero' }, h('div', { class: 'big' }, '🌙'), h('div', { class: 'cap' }, 'تقبل الله منا ومنكم'),
        h('p', { class: 'muted' }, `أكملت ${done} من ${CONFIG.daysTotal} يوم. الأيام الفائتة لسه متاحة لتكملها.`));
    } else {
      const day = info.phase === 'during' ? info.day : Math.min(CONFIG.daysTotal, (done || 0) + 1);
      const res = p.days[day];
      hero = h('div', { class: 'card hero' },
        h('div', { class: 'lantern', html: lantern(36) }),
        h('div', { class: 'cap' }, previewOn() ? 'وضع التجربة · اليوم' : 'تحدي اليوم'),
        h('div', { class: 'big' }, fmt(day)),
        res
          ? h('div', null, h('div', { class: 'stars on' }, starsText(res.stars)), h('p', { class: 'muted' }, `${res.correct}/${res.total} صح · ${fmt(res.score)} نقطة`))
          : h('div', null, h('p', { class: 'muted' }, `${CONFIG.questionsPerRound} أسئلة · كل ثانية بتفرق · سلسلة الإجابات بتضاعف النقاط`),
              h('button', { class: 'btn btn-gold btn-lg', onclick: () => go('/quiz/day/' + day) }, 'ابدأ التحدي ⚽')));
    }

    // ── إعلان الأدمن
    const ann = getSettings().announce;
    const annEl = ann ? h('div', { class: 'card announce' }, '📣 ', ann) : null;

    // ── اختصارات
    const spin = canSpinToday();
    const nightOpen = nightWindowOpen();
    const nDone = nightDone();
    const quick = h('div', { class: 'quick' },
      h('button', { class: 'q-item', onclick: () => go('/wheel') }, h('span', { class: 'qi' }, '🎡'), h('b', null, 'عجلة الحظ'), h('small', { class: spin ? 'ok' : '' }, spin ? 'لفّة متاحة!' : 'بكرة')),
      h('button', { class: 'q-item', onclick: () => openNight() }, h('span', { class: 'qi' }, '🌃'), h('b', null, 'سؤال الليل'), h('small', { class: nightOpen && !nDone ? 'ok' : '' }, nDone ? 'تم ✅' : nightOpen ? 'متاح' : 'بعد المغرب')),
      h('button', { class: 'q-item', onclick: () => go('/practice') }, h('span', { class: 'qi' }, '🎯'), h('b', null, 'تدريب'), h('small', null, 'بدون حدود')));

    // ── التثبيت
    const install = installCard();

    // ── خريطة الأيام
    const grid = h('div', { class: 'days' });
    for (let d = 1; d <= CONFIG.daysTotal; d++) {
      const r = p.days[d];
      const open = isUnlocked(d);
      const today = info.phase === 'during' && info.day === d;
      const cls = ['day', r ? 'done' : open ? 'open' : 'locked', today ? 'today' : '', d >= 26 ? 'hot' : ''].join(' ');
      grid.append(h('button', {
        class: cls,
        onclick: () => {
          sfx('tap'); buzz(10);
          if (!open) return toast(`اليوم ${d} بيفتح في موعده 🔒`);
          if (r) return toast(`اليوم ${d}: ${r.correct}/${r.total} صح · ${fmt(r.score)} نقطة${r.late ? ' (متأخر)' : ''}`);
          go('/quiz/day/' + d);
        },
      }, h('b', null, d), h('small', null, r ? starsText(r.stars) : open ? (isLate(d) ? 'فات' : '▶') : '🔒')));
    }

    el.replaceChildren(...[header, xp, annEl, hero, quick, install, h('h2', { class: 'sec' }, 'خريطة الشهر'),
      h('p', { class: 'muted small' }, 'الأيام ٢٦–٣٠ «وضع الضغط»: الوقت بيزيد مع الصح وبينقص مع الغلط 🔥'), grid].filter(Boolean));
  };
  draw();
  const un = subscribe(draw);
  const onInstall = () => draw();
  window.addEventListener('rq-install-ready', onInstall);
  return { el, destroy() { un(); window.removeEventListener('rq-install-ready', onInstall); } };
}

function installCard() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone) return null;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (window.__installPrompt) {
    return h('div', { class: 'card install' },
      h('div', null, h('b', null, 'ثبّت التطبيق'), h('small', { class: 'muted' }, ' — يفتح بسرعة ويشتغل أوفلاين')),
      h('button', { class: 'btn btn-gold btn-sm', onclick: async () => { const e = window.__installPrompt; e.prompt(); await e.userChoice; window.__installPrompt = null; } }, 'تثبيت'));
  }
  if (ios) {
    return h('div', { class: 'card install' }, h('div', null, h('b', null, 'على الآيفون: '), h('small', { class: 'muted' }, 'اضغط زر المشاركة في Safari ثم «إضافة إلى الشاشة الرئيسية».')));
  }
  return null;
}

function openNight() {
  if (nightDone()) return toast('خلصت سؤال الليلة، نتقابل بكرة 🌙');
  if (!nightWindowOpen()) return toast('سؤال الليل بيفتح بعد المغرب (٧ مساءً) 🌃');
  const q = pickNightQuestion();
  let answered = false;
  const box = h('div', { class: 'night' });
  const btns = q.opts.map((o, i) => h('button', { class: 'opt', onclick: () => pick(i) }, h('span', { class: 'ltr' }, 'أبجد'[i]), h('span', null, o)));
  box.append(h('p', { class: 'nq' }, q.q), h('div', { class: 'opts' }, btns));
  const pick = (i) => {
    if (answered) return;
    answered = true;
    const ok = i === q.c;
    btns[q.c].classList.add('correct');
    if (!ok) btns[i].classList.add('wrong');
    sfx(ok ? 'correct' : 'wrong'); buzz(ok ? 20 : 60);
    const badges = answerNight(ok);
    if (ok) confetti(60);
    box.append(h('p', { class: ok ? 'good' : 'bad' }, ok ? 'صح! +٥٠ نقطة و +١٥٠ خبرة 🌟' : 'خطأ، حظ أوفر المرة الجاية'), q.e && h('small', { class: 'muted' }, q.e));
    badges.forEach((b) => toast(`شارة جديدة: ${b.icon} ${b.title}`, 'ok'));
  };
  modal({ title: 'سؤال الليل 🌃', body: box, actions: [{ label: 'إغلاق', kind: 'btn-ghost' }], dismissible: false });
}
