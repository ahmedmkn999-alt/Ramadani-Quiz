import { h, fmt } from '../util.js';
import { getProfile } from '../store.js';
import { fetchLeaderboard, backendState, onBackend } from '../backend.js';
import { levelInfo } from '../engine.js';

export function render() {
  let tab = 'players';
  const body = h('div', { class: 'stack' });
  const tabs = h('div', { class: 'tabs' });
  let data = null, err = '', loading = false;

  const medal = (i) => ['🥇', '🥈', '🥉'][i] || i + 1;

  const draw = () => {
    tabs.replaceChildren(
      h('button', { class: tab === 'players' ? 'on' : '', onclick: () => { tab = 'players'; draw(); } }, 'اللاعبين'),
      h('button', { class: tab === 'teams' ? 'on' : '', onclick: () => { tab = 'teams'; draw(); } }, 'الفرق'));
    const p = getProfile();

    if (backendState().mode !== 'firebase') {
      body.replaceChildren(
        h('div', { class: 'card' },
          h('b', null, 'الوضع المحلي'),
          h('p', { class: 'muted' }, 'الترتيب العالمي والفرق محتاجين تفعيل Firebase (خطوات بسيطة في README). لحد ما تفعّله، دي إحصائياتك على الجهاز:')),
        h('div', { class: 'row me' }, h('span', { class: 'rk' }, '🥇'), h('span', { class: 'av2' }, p.avatar), h('div', { class: 'nm' }, p.name, h('small', null, `${levelInfo(p.xp).title} · ${Object.keys(p.days).length} يوم`)), h('b', null, fmt(p.score))));
      return;
    }
    if (loading) { body.replaceChildren(h('p', { class: 'muted center' }, 'جاري التحميل…')); return; }
    if (err) { body.replaceChildren(h('div', { class: 'card' }, h('p', { class: 'muted' }, 'مش قادر أحمّل الترتيب (ممكن مفيش نت). آخر نتيجة محفوظة على جهازك.'), h('button', { class: 'btn btn-ghost', onclick: load }, 'حاول تاني'))); return; }
    if (!data) return;

    if (tab === 'players') {
      body.replaceChildren(...data.rows.map((r, i) => h('div', { class: 'row' + (r.id === data.me ? ' me' : '') },
        h('span', { class: 'rk' }, medal(i)), h('span', { class: 'av2' }, r.avatar || '🌙'),
        h('div', { class: 'nm' }, r.name, h('small', null, `${r.team ? r.team + ' · ' : ''}🔥 ${r.streak || 0} · ${r.daysDone || 0} يوم`)),
        h('b', null, fmt(r.score)))));
    } else {
      const m = new Map();
      for (const r of data.rows) {
        if (!r.team) continue;
        const t = m.get(r.team) || { team: r.team, score: 0, n: 0 };
        t.score += r.score || 0; t.n += 1; m.set(r.team, t);
      }
      const list = [...m.values()].sort((a, b) => b.score - a.score);
      body.replaceChildren(...(list.length ? list.map((t, i) => h('div', { class: 'row' + (t.team === p.team ? ' me' : '') },
        h('span', { class: 'rk' }, medal(i)), h('span', { class: 'av2' }, '👥'),
        h('div', { class: 'nm' }, t.team, h('small', null, `${t.n} لاعب`)), h('b', null, fmt(t.score)))) : [h('p', { class: 'muted center' }, 'مفيش فرق لسه — اكتب اسم فريقك من «حسابي».')]));
    }
  };

  async function load() {
    if (backendState().mode !== 'firebase') return draw();
    loading = true; err = ''; draw();
    try { data = await fetchLeaderboard(); } catch (e) { err = String(e); }
    loading = false; draw();
  }

  draw();
  load();
  const un = onBackend(() => load());
  return { el: h('div', { class: 'screen' }, h('h1', { class: 'page-title' }, 'الترتيب 🏆'), tabs, body), destroy: un };
}
