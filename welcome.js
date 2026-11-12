import { h } from '../util.js';
import { update } from '../store.js';
import { AVATARS, CONFIG } from '../config.js';
import { toast } from '../fx.js';
import { sfx } from '../audio.js';
import { crescent } from '../icons.js';

export function render() {
  let avatar = AVATARS[0];
  const name = h('input', { class: 'input', placeholder: 'اسمك (يظهر في الترتيب)', maxlength: 24, autocomplete: 'off' });
  const team = h('input', { class: 'input', placeholder: 'اسم فريقك (اختياري) — مثلاً: العيلة', maxlength: 24, autocomplete: 'off' });
  const avs = h('div', { class: 'avatars' });
  const drawAv = () => avs.replaceChildren(...AVATARS.map((a) => h('button', {
    class: 'av' + (a === avatar ? ' on' : ''), type: 'button', onclick: () => { avatar = a; sfx('tap'); drawAv(); },
  }, a)));
  drawAv();

  const go = () => {
    const n = name.value.trim();
    if (n.length < 2) { toast('اكتب اسمك (حرفين على الأقل)', 'err'); name.focus(); return; }
    update((p) => { p.name = n; p.avatar = avatar; p.team = team.value.trim(); });
    sfx('win');
    location.hash = '#/home';
  };
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });

  const el = h('div', { class: 'screen welcome' },
    h('div', { class: 'hero-moon', html: crescent(110) }),
    h('h1', { class: 'gold-text' }, CONFIG.appName),
    h('p', { class: 'sub' }, `تحدي رمضان ${CONFIG.year}: ٣٠ يوم، أسئلة يومية، عجلة حظ، ومنافسة مع أصحابك — وبيشتغل بدون إنترنت.`),
    h('div', { class: 'card stack' },
      h('label', { class: 'lbl' }, 'اختار شخصيتك'), avs,
      h('label', { class: 'lbl' }, 'اسمك'), name,
      h('label', { class: 'lbl' }, 'فريقك'), team,
      h('button', { class: 'btn btn-gold btn-lg', onclick: go }, 'يلا نبدأ 🌙')),
    h('p', { class: 'fine' }, 'بياناتك محفوظة على جهازك. مفيش كلمات سر ولا تسجيل.'));
  return { el, nav: false };
}
