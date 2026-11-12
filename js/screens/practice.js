import { h, fmt } from '../util.js';
import { getProfile } from '../store.js';
import { CATS, bankStats } from '../bank.js';
import { sfx } from '../audio.js';

export function render() {
  let cat = '', diff = '';
  const p = getProfile();
  const st = bankStats();
  const catBox = h('div', { class: 'chips-sel' });
  const diffBox = h('div', { class: 'chips-sel' });
  const draw = () => {
    catBox.replaceChildren(
      h('button', { class: 'sel' + (cat === '' ? ' on' : ''), onclick: () => { cat = ''; sfx('tap'); draw(); } }, '🎲 الكل'),
      ...Object.entries(CATS).map(([k, c]) => h('button', { class: 'sel' + (cat === k ? ' on' : ''), onclick: () => { cat = k; sfx('tap'); draw(); } }, `${c.i} ${c.t}`)));
    diffBox.replaceChildren(...[['', 'أي مستوى'], ['1', 'سهل'], ['2', 'متوسط'], ['3', 'صعب']].map(([v, t]) =>
      h('button', { class: 'sel' + (diff === v ? ' on' : ''), onclick: () => { diff = v; sfx('tap'); draw(); } }, t)));
  };
  draw();
  const acc = p.stats.practiceRuns ? Math.round((p.stats.practiceCorrect / (p.stats.practiceRuns * 10)) * 100) : 0;
  const el = h('div', { class: 'screen' },
    h('h1', { class: 'page-title' }, 'التدريب 🎯'),
    h('p', { class: 'muted' }, 'جولات حرة من ١٠ أسئلة، بدون وقت محدود لعدد المحاولات وبدون استهلاك المساعدات. بتشتغل أوفلاين.'),
    h('div', { class: 'card stack' },
      h('label', { class: 'lbl' }, 'القسم'), catBox,
      h('label', { class: 'lbl' }, 'المستوى'), diffBox,
      h('button', { class: 'btn btn-gold btn-lg', onclick: () => { location.hash = `#/quiz/practice?cat=${cat}&diff=${diff}`; } }, 'ابدأ الجولة')),
    h('div', { class: 'stats-row' },
      h('div', null, h('b', null, fmt(p.stats.practiceRuns)), h('small', null, 'جولة تدريب')),
      h('div', null, h('b', null, acc + '%'), h('small', null, 'دقة تقريبية')),
      h('div', null, h('b', null, fmt(st.total)), h('small', null, 'سؤال في البنك'))));
  return { el };
}
