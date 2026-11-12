// تنبيهات، نوافذ، وكونفيتي — بدون مكتبات خارجية
import { h } from './util.js';

export function toast(msg, type = '') {
  const host = document.getElementById('toasts');
  const t = h('div', { class: 'toast ' + type }, msg);
  host.append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2600);
}

/** modal({title, icon, body, actions:[{label, kind, onClick}]}) */
export function modal({ title, icon = '', body, actions = [{ label: 'تمام' }], dismissible = true }) {
  const close = () => { wrap.classList.remove('show'); setTimeout(() => wrap.remove(), 200); };
  const box = h('div', { class: 'modal' },
    icon && h('div', { class: 'modal-icon' }, icon),
    title && h('h3', null, title),
    body && (typeof body === 'string' ? h('p', null, body) : body),
    h('div', { class: 'modal-actions' },
      actions.map((a) => h('button', {
        class: 'btn ' + (a.kind || 'btn-gold'),
        onclick: async () => { close(); await a.onClick?.(); },
      }, a.label))));
  const wrap = h('div', { class: 'modal-wrap', onclick: (e) => { if (dismissible && e.target === wrap) close(); } }, box);
  document.body.append(wrap);
  requestAnimationFrame(() => wrap.classList.add('show'));
  return close;
}

export function confirmBox(title, body, yes = 'نعم', no = 'إلغاء') {
  return new Promise((res) => {
    modal({
      title, body, dismissible: false,
      actions: [
        { label: no, kind: 'btn-ghost', onClick: () => res(false) },
        { label: yes, kind: 'btn-gold', onClick: () => res(true) },
      ],
    });
  });
}

export function confetti(n = 120) {
  const cv = h('canvas', { class: 'confetti' });
  document.body.append(cv);
  const ctx = cv.getContext('2d');
  const W = (cv.width = innerWidth), H = (cv.height = innerHeight);
  const colors = ['#f5c451', '#ffdf8a', '#34d399', '#60a5fa', '#f472b6', '#fff'];
  const ps = Array.from({ length: n }, () => ({
    x: W / 2 + (Math.random() - 0.5) * 120, y: H * 0.35,
    vx: (Math.random() - 0.5) * 11, vy: -Math.random() * 12 - 4,
    s: 4 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
    c: colors[(Math.random() * colors.length) | 0],
  }));
  let f = 0;
  (function tick() {
    ctx.clearRect(0, 0, W, H);
    for (const p of ps) {
      p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6); ctx.restore();
    }
    if (++f < 130) requestAnimationFrame(tick); else cv.remove();
  })();
}

export function countUp(el, to, ms = 900) {
  const t0 = performance.now();
  (function step(t) {
    const k = Math.min(1, (t - t0) / ms);
    el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))).toLocaleString('en');
    if (k < 1) requestAnimationFrame(step);
  })(t0);
}
