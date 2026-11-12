import { h } from '../util.js';
import { WHEEL, canSpinToday, spinResult, applyReward } from '../engine.js';
import { getProfile, subscribe } from '../store.js';
import { toast, modal, confetti } from '../fx.js';
import { sfx, buzz } from '../audio.js';
import { syncProfile } from '../backend.js';

const SIZE = 300;

function drawWheel(cv) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = SIZE * dpr; cv.height = SIZE * dpr;
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  const c = SIZE / 2, R = c - 6, n = WHEEL.length, per = (Math.PI * 2) / n;
  WHEEL.forEach((s, i) => {
    const a0 = -Math.PI / 2 + i * per, a1 = a0 + per;
    g.beginPath(); g.moveTo(c, c); g.arc(c, c, R, a0, a1); g.closePath();
    g.fillStyle = s.color; g.fill();
    g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 2; g.stroke();
    g.save();
    g.translate(c, c); g.rotate(a0 + per / 2);
    g.textAlign = 'right'; g.fillStyle = '#fff';
    g.font = '28px serif'; g.textBaseline = 'middle';
    g.fillText(s.icon, R - 14, 0);
    g.font = '800 12px Cairo, system-ui, sans-serif';
    g.fillText(s.label.replace('جاكبوت ', 'جاكبوت '), R - 50, 0);
    g.restore();
  });
  g.beginPath(); g.arc(c, c, R, 0, Math.PI * 2); g.lineWidth = 6; g.strokeStyle = '#f5c451'; g.stroke();
}

export function render() {
  let rot = 0, spinning = false;
  const cv = h('canvas', { class: 'wheel-cv', style: { width: SIZE + 'px', height: SIZE + 'px' } });
  drawWheel(cv);
  document.fonts?.ready.then(() => drawWheel(cv));
  const status = h('p', { class: 'muted' });
  const btn = h('button', { class: 'btn btn-gold btn-lg', onclick: spin }, 'لفّ العجلة 🎡');

  const inv = h('div', { class: 'stats-row' });
  const refresh = () => {
    const p = getProfile();
    inv.replaceChildren(
      h('div', null, h('b', null, p.inv.fifty), h('small', null, '✂️ ٥٠:٥٠')),
      h('div', null, h('b', null, p.inv.freeze), h('small', null, '⏳ +١٠ ثواني')),
      h('div', null, h('b', null, p.inv.skip), h('small', null, '⏭️ تخطّي')));
    const can = canSpinToday();
    btn.disabled = spinning || !can;
    status.textContent = can ? 'لفّة مجانية كل يوم — جايزتك ممكن تكون نقاط أو مساعدات للكويز.' : 'خلصت لفّة النهاردة. ارجع بكرة! (وضع التجربة في «حسابي» بيفتحها)';
  };
  refresh();
  const un = subscribe(refresh);

  function spin() {
    if (spinning || !canSpinToday()) return;
    spinning = true; btn.disabled = true;
    const idx = spinResult();
    const seg = WHEEL[idx];
    const per = 360 / WHEEL.length;
    const jitter = (Math.random() - 0.5) * per * 0.6;
    const desired = (((360 - (idx + 0.5) * per + jitter) % 360) + 360) % 360;
    rot += 360 * 5 + ((desired - (rot % 360)) + 360) % 360;
    cv.style.transform = `rotate(${rot}deg)`;
    const tk = setInterval(() => { sfx('spin'); buzz(6); }, 180);
    setTimeout(() => {
      clearInterval(tk);
      const badges = applyReward(seg);
      syncProfile();
      spinning = false;
      const win = seg.type !== 'none';
      if (win) { confetti(seg.id === 'jackpot' ? 220 : 90); sfx('win'); } else sfx('wrong');
      modal({
        icon: seg.icon, title: win ? 'مبروك!' : 'حظ أوفر',
        body: win ? `كسبت: ${seg.label}` : 'معلش المرة دي، جرّب بكرة 🍃',
        actions: [{ label: 'تمام' }],
      });
      badges.forEach((b) => toast(`شارة جديدة: ${b.icon} ${b.title}`, 'ok'));
    }, 4700);
  }

  const el = h('div', { class: 'screen wheel' },
    h('h1', { class: 'page-title' }, 'عجلة الحظ 🎡'),
    status,
    h('div', { class: 'wheel-wrap' }, h('div', { class: 'pointer' }), h('div', { class: 'wheel-clip' }, cv)),
    btn,
    h('h3', { class: 'sec' }, 'رصيدك من المساعدات'), inv,
    h('button', { class: 'btn btn-ghost', onclick: () => { location.hash = '#/home'; } }, 'رجوع'));
  return { el, destroy: un };
}
