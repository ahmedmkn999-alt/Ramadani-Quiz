// شاشة الكويز: يومي (بنقاط وتقدم محفوظ) أو تدريب (حر)
import { h, fmt, sleep } from '../util.js';
import { getProfile, update, roundMarker } from '../store.js';
import { CATS } from '../bank.js';
import { CONFIG } from '../config.js';
import { buildRound, buildPractice, isUnlocked, isPressureDay, pressureTime, timeFor, scoreAnswer, completeDay, completePractice, levelInfo } from '../engine.js';
import { toast, confirmBox, confetti, countUp } from '../fx.js';
import { sfx, buzz } from '../audio.js';
import { syncProfile } from '../backend.js';

const go = (p) => { location.hash = '#' + p; };
const RING = 2 * Math.PI * 26;

export function render(r) {
  const isDay = r.seg[1] === 'day';
  const day = isDay ? Number(r.seg[2]) : 0;
  const root = h('div', { class: 'screen quiz' });
  let raf = 0, hiddenAt = 0, destroyed = false;
  const view = { el: root, nav: false, destroy() { destroyed = true; cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', onVis); } };

  if (isDay) {
    if (!Number.isInteger(day) || day < 1 || day > CONFIG.daysTotal || !isUnlocked(day)) { queueMicrotask(() => { toast('اليوم ده لسه مقفول 🔒', 'err'); go('/home'); }); return view; }
    if (getProfile().days[day]) { queueMicrotask(() => { toast('لعبت اليوم ده خلاص يا بطل ✅'); go('/home'); }); return view; }
  }

  const questions = isDay ? buildRound(day) : buildPractice(r.q.cat, r.q.diff);
  if (!questions.length) { queueMicrotask(() => { toast('مفيش أسئلة متاحة', 'err'); go('/home'); }); return view; }

  const scored = isDay;
  const pressure = isDay && isPressureDay(day);
  const st = { i: 0, score: 0, correct: 0, streak: 0, fast: 0, answered: 0, pt: 10 };
  let q, locked = false, total = 0, extra = 0, t0 = 0, lastSec = 99, used = {};
  let els = {};

  // ── استئناف جولة انقطعت (إغلاق التطبيق/تحديث الصفحة): السؤال الجاري يُحسب خطأ
  if (scored) {
    const m = roundMarker.get();
    if (m && m.day === day && m.st) {
      Object.assign(st, m.st);
      st.i += 1; st.streak = 0;
      if (pressure) st.pt = pressureTime(st.pt, false);
      queueMicrotask(() => toast('رجعت لنص الجولة — السؤال اللي كنت فيه اتحسب خطأ', 'err'));
    }
  }

  const remaining = () => total + extra - (performance.now() - t0) / 1000;

  function inv(k) { return scored ? getProfile().inv[k] : '∞'; }

  function show() {
    if (destroyed) return;
    if (st.i >= questions.length) return finish();
    q = questions[st.i];
    locked = false; used = {}; extra = 0; lastSec = 99;
    total = pressure ? st.pt : timeFor(q.diff);
    t0 = performance.now();
    if (scored) roundMarker.set({ day, st: { ...st } });

    els.num = h('div', { class: 'ring-num' }, Math.ceil(total));
    const ring = h('div', { class: 'ring' },
      (() => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 60 60');
        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        for (const [k, v] of Object.entries({ cx: 30, cy: 30, r: 26, fill: 'none', 'stroke-width': 5, class: 'ring-bg' })) bg.setAttribute(k, v);
        const fg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        for (const [k, v] of Object.entries({ cx: 30, cy: 30, r: 26, fill: 'none', 'stroke-width': 5, 'stroke-linecap': 'round', class: 'ring-fg', 'stroke-dasharray': RING, 'stroke-dashoffset': 0 })) fg.setAttribute(k, v);
        s.append(bg, fg); els.fg = fg; return s; })(), els.num);

    els.score = h('b', null, fmt(st.score));
    els.streak = h('span', { class: 'sk' }, st.streak > 1 ? `🔥 x${(1 + 0.1 * Math.min(st.streak, 5)).toFixed(1)}` : '');
    const top = h('div', { class: 'q-top' },
      h('button', { class: 'x', 'aria-label': 'خروج', onclick: quit }, '✕'),
      h('div', { class: 'prog' }, questions.map((_, i) => h('i', { class: i < st.i ? 'done' : i === st.i ? 'cur' : '' }))),
      h('div', { class: 'sc' }, '⭐ ', els.score));

    els.btns = q.opts.map((o, i) => h('button', { class: 'opt', onclick: () => answer(i) }, h('span', { class: 'ltr' }, 'أبجد'[i]), h('span', null, o)));
    const catI = CATS[q.cat];
    const card = h('div', { class: 'q-card' },
      h('div', { class: 'q-meta' }, h('span', null, `${catI?.i || ''} ${catI?.t || ''}`), h('span', { class: 'diff d' + q.diff }, ['', 'سهل', 'متوسط', 'صعب'][q.diff]), els.streak),
      h('h2', null, q.q));

    const ll = (k, icon, label, fn) => {
      const c = h('i', { class: 'cnt' }, inv(k));
      const b = h('button', { class: 'll', onclick: fn }, h('span', null, icon), h('small', null, label), c);
      els['ll_' + k] = { b, c };
      return b;
    };
    const lifelines = h('div', { class: 'lifelines' }, ll('fifty', '✂️', '٥٠:٥٠', useFifty), ll('freeze', '⏳', '+١٠ ثواني', useFreeze), ll('skip', '⏭️', 'تخطّي', useSkip));
    els.fb = h('div', { class: 'feedback' });
    root.replaceChildren(top, h('div', { class: 'q-body' }, ring, card), h('div', { class: 'opts' }, els.btns), els.fb, lifelines);
    refreshLL();
    cancelAnimationFrame(raf);
    tick();
  }

  function refreshLL() {
    for (const k of ['fifty', 'freeze', 'skip']) {
      const x = els['ll_' + k]; if (!x) continue;
      x.c.textContent = inv(k);
      x.b.disabled = locked || used[k] || (scored && getProfile().inv[k] <= 0);
    }
  }

  function tick() {
    if (destroyed || locked) return;
    const left = remaining();
    const all = total + extra;
    els.fg.setAttribute('stroke-dashoffset', String(RING * (1 - Math.max(0, left) / all)));
    const sec = Math.max(0, Math.ceil(left));
    els.num.textContent = sec;
    els.num.classList.toggle('low', left <= 5);
    els.fg.classList.toggle('low', left <= 5);
    if (sec !== lastSec) { lastSec = sec; if (left <= 5 && left > 0) { sfx('tick'); buzz(8); } }
    if (left <= 0) return answer(-1);
    raf = requestAnimationFrame(tick);
  }

  function spend(k) { if (scored) update((p) => { p.inv[k] -= 1; }); used[k] = true; refreshLL(); sfx('tap'); }

  function useFifty() {
    if (locked || used.fifty || (scored && getProfile().inv.fifty <= 0)) return;
    spend('fifty');
    const wrong = q.opts.map((_, i) => i).filter((i) => i !== q.c).sort(() => Math.random() - 0.5).slice(0, 2);
    wrong.forEach((i) => { els.btns[i].classList.add('gone'); els.btns[i].disabled = true; });
  }
  function useFreeze() {
    if (locked || used.freeze || (scored && getProfile().inv.freeze <= 0)) return;
    spend('freeze'); extra += 10; toast('+١٠ ثواني ⏳');
  }
  function useSkip() {
    if (locked || used.skip || (scored && getProfile().inv.skip <= 0)) return;
    spend('skip'); answer(-2);
  }

  function answer(i) {
    if (locked) return;
    locked = true;
    cancelAnimationFrame(raf);
    const left = Math.max(0, remaining());
    const skipped = i === -2;
    const correct = i === q.c;
    let pts = 0;
    if (!skipped) {
      pts = scoreAnswer({ correct, timeLeft: left, timeTotal: total + extra, streak: st.streak });
      st.answered += 1;
      if (correct) { st.correct += 1; st.streak += 1; if (total + extra - left < 3) st.fast += 1; } else st.streak = 0;
      st.score += pts;
      if (pressure) st.pt = pressureTime(st.pt, correct);
    }
    els.btns.forEach((b, k) => { b.disabled = true; if (k === q.c) b.classList.add('correct'); else if (k === i) b.classList.add('wrong'); else b.classList.add('dim'); });
    els.score.textContent = fmt(st.score);
    refreshLL();
    if (skipped) { els.fb.replaceChildren(h('span', { class: 'muted' }, 'تم التخطّي — بدون نقاط وبدون خسارة السلسلة')); }
    else {
      sfx(correct ? 'correct' : 'wrong'); buzz(correct ? 25 : 70);
      els.fb.replaceChildren(h('span', { class: correct ? 'good' : 'bad' }, correct ? `صح! +${pts}` : i === -1 ? 'خلص الوقت ⌛' : i === -3 ? 'خرجت من الشاشة' : 'إجابة خاطئة'));
    }
    if (q.e) els.fb.append(h('small', { class: 'muted' }, q.e));
    setTimeout(() => { st.i += 1; show(); }, q.e ? 2300 : 1500);
  }

  // ── مكافحة الغش البسيطة: لو خرج اللاعب من الشاشة أثناء سؤال يومي يُحسب خطأ
  function onVis() {
    if (destroyed) return;
    if (document.hidden) { if (!locked) { hiddenAt = performance.now(); cancelAnimationFrame(raf); } return; }
    if (!hiddenAt) return;
    const away = performance.now() - hiddenAt; hiddenAt = 0;
    if (locked) return;
    if (scored && away > 800) { toast('خرجت من الشاشة! السؤال اتحسب خطأ', 'err'); answer(-3); }
    else { t0 += away; tick(); }
  }
  document.addEventListener('visibilitychange', onVis);

  async function quit() {
    const ok = await confirmBox('تخرج من الجولة؟', scored ? 'الأسئلة المتبقية هتتحسب خطأ ومش هتقدر تعيد اليوم ده.' : 'هتخسر تقدمك في الجولة دي.', 'اخرج', 'كمّل');
    if (!ok) return;
    if (scored) { cancelAnimationFrame(raf); st.i = questions.length; finish(); } else { go('/practice'); }
  }

  // ── النتيجة
  async function finish() {
    cancelAnimationFrame(raf);
    document.removeEventListener('visibilitychange', onVis);
    destroyed = true;
    let sum = null, badges = [];
    if (scored) {
      sum = completeDay(day, { score: st.score, correct: st.correct, total: questions.length, answered: st.answered, fast: st.fast });
      roundMarker.clear();
      badges = sum.badges;
      syncProfile();
    } else {
      badges = completePractice(st.correct, questions.length);
    }
    const stars = scored ? sum.stars : st.correct >= questions.length ? 3 : st.correct >= questions.length * 0.7 ? 2 : st.correct >= questions.length * 0.5 ? 1 : 0;
    const scoreEl = h('div', { class: 'res-score' }, '0');
    const p = getProfile();
    const lv = levelInfo(p.xp);
    root.replaceChildren(h('div', { class: 'result' },
      h('div', { class: 'res-title' }, stars === 3 ? 'ممتاز! 🏆' : stars === 2 ? 'برافو 👏' : stars === 1 ? 'حلو، كمّل 💪' : 'معلش، بكرة أحسن 🌙'),
      h('div', { class: 'stars big' }, [0, 1, 2].map((k) => h('span', { class: k < stars ? 'on' : '', style: { animationDelay: 0.25 * k + 's' } }, '★'))),
      scored ? scoreEl : h('div', { class: 'res-score' }, `${st.correct}/${questions.length}`),
      scored && h('div', { class: 'muted' }, 'نقطة'),
      h('div', { class: 'res-grid' },
        h('div', null, h('b', null, `${st.correct}/${questions.length}`), h('small', null, 'إجابات صح')),
        scored && h('div', null, h('b', null, '+' + fmt(sum.xpGain)), h('small', null, 'خبرة')),
        scored && h('div', null, h('b', null, '🔥 ' + p.streak), h('small', null, sum.late ? 'متأخر (بدون سلسلة)' : 'سلسلة')),
        !scored && h('div', null, h('b', null, 'مستوى ' + lv.level), h('small', null, lv.title))),
      scored && sum.leveledUp && h('div', { class: 'card gold-card' }, '🎉 ترقيت للمستوى ', h('b', null, sum.level), ' — ', lv.title),
      badges.length > 0 && h('div', { class: 'card' }, h('b', null, 'شارات جديدة'), h('div', { class: 'badge-row' }, badges.map((b) => h('div', { class: 'badge on' }, h('span', null, b.icon), h('small', null, b.title))))),
      h('div', { class: 'res-actions' },
        h('button', { class: 'btn btn-gold btn-lg', onclick: () => go(scored ? '/home' : '/practice') }, scored ? 'رجوع للخريطة' : 'تدريب تاني'),
        h('button', { class: 'btn btn-ghost', onclick: () => share(scored, day, st, questions.length, stars) }, 'شارك نتيجتك 📤'))));
    if (scored) countUp(scoreEl, st.score);
    if (stars >= 2) { confetti(stars === 3 ? 180 : 90); sfx('win'); } else sfx(stars ? 'correct' : 'wrong');
    await sleep(0);
  }

  show();
  return view;
}

async function share(scored, day, st, n, stars) {
  const text = scored
    ? `جاوبت ${st.correct}/${n} في اليوم ${day} من «${CONFIG.appName}» وجمعت ${st.score} نقطة ${'⭐'.repeat(stars)} — تعالى نافسني! 🌙`
    : `جاوبت ${st.correct}/${n} في تدريب «${CONFIG.appName}» 🌙`;
  try {
    if (navigator.share) await navigator.share({ text, url: location.origin + location.pathname });
    else { await navigator.clipboard.writeText(text); toast('اتنسخت النتيجة، الصقها لأصحابك'); }
  } catch { /* المستخدم لغى المشاركة */ }
}
