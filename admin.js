// لوحة الإدارة: إدارة الأسئلة، تاريخ رمضان، إعلان، استيراد/تصدير
// في الوضع المحلي: تعدّل على جهازك فقط. مع Firebase: الأدمن (مستند في admins/) ينشر للكل.
import { h, fmt, download, pickFile } from '../util.js';
import { getSettings, setSettings } from '../store.js';
import { CATS, allQuestions, getBank, getCustom, addCustom, removeCustom, setHidden, bankStats, normalizeImport, importQuestions, isValid } from '../bank.js';
import { CONFIG } from '../config.js';
import { ramadanStartKey } from '../engine.js';
import { backendState, publishQuestion, publishConfig } from '../backend.js';
import { toast, confirmBox } from '../fx.js';

export function render() {
  const bs = backendState();
  if (bs.mode === 'firebase' && !bs.admin) {
    return { el: h('div', { class: 'screen' }, h('h1', { class: 'page-title' }, 'غير مصرّح'), h('p', { class: 'muted' }, 'حسابك مش أدمن. أضف مستند باسم الـ UID بتاعك في collection اسمه admins من Firebase Console.'), h('button', { class: 'btn btn-ghost', onclick: () => { location.hash = '#/me'; } }, 'رجوع')) };
  }
  let tab = 'q', search = '';
  const body = h('div', { class: 'stack' });
  const tabs = h('div', { class: 'tabs' });
  const online = bs.mode === 'firebase';

  const draw = () => {
    tabs.replaceChildren(...[['q', 'الأسئلة'], ['add', 'إضافة'], ['set', 'إعدادات']].map(([k, t]) => h('button', { class: tab === k ? 'on' : '', onclick: () => { tab = k; draw(); } }, t)));
    if (tab === 'q') body.replaceChildren(...questionsTab());
    if (tab === 'add') body.replaceChildren(...addTab());
    if (tab === 'set') body.replaceChildren(...settingsTab());
  };

  function questionsTab() {
    const st = bankStats();
    const hidden = new Set(getSettings().hiddenIds || []);
    const custom = new Set(getCustom().map((q) => q.id));
    const need = CONFIG.daysTotal * CONFIG.questionsPerRound;
    const listBox = h('div', { class: 'stack' });
    const fill = () => {
      const list = allQuestions().filter((q) => !search || q.q.includes(search)).slice(0, 80);
      listBox.replaceChildren(...list.map((q) => h('div', { class: 'qrow' + (hidden.has(q.id) ? ' hid' : '') },
        h('div', null, h('b', null, q.q), h('small', { class: 'muted' }, `${CATS[q.cat]?.t || q.cat} · ${['', 'سهل', 'متوسط', 'صعب'][q.diff]} · ✔ ${q.a[q.c]}`)),
        custom.has(q.id)
          ? h('button', { class: 'btn btn-sm btn-ghost danger', onclick: async () => { if (await confirmBox('حذف السؤال؟', q.q)) { removeCustom(q.id); draw(); } } }, 'حذف')
          : h('button', { class: 'btn btn-sm btn-ghost', onclick: () => { setHidden(q.id, !hidden.has(q.id)); draw(); } }, hidden.has(q.id) ? 'إظهار' : 'إخفاء'))));
    };
    fill();
    return [
      h('div', { class: 'stats-row' },
        h('div', null, h('b', null, st.total), h('small', null, `من ${need} مطلوب`)),
        h('div', null, h('b', null, `${st.d1}/${st.d2}/${st.d3}`), h('small', null, 'سهل/متوسط/صعب'))),
      st.total < need && h('div', { class: 'card announce' }, `البنك فيه ${st.total} سؤال، والـ ٣٠ يوم محتاجين ${need} عشان مفيش تكرار. أضف أو استورد أسئلة.`),
      h('input', { class: 'input', placeholder: 'بحث في الأسئلة…', value: search, oninput: (e) => { search = e.target.value.trim(); fill(); } }),
      listBox,
    ];
  }

  function addTab() {
    const cat = h('select', { class: 'input' }, Object.entries(CATS).map(([k, c]) => h('option', { value: k }, c.t)));
    const diff = h('select', { class: 'input' }, [[1, 'سهل'], [2, 'متوسط'], [3, 'صعب']].map(([v, t]) => h('option', { value: v }, t)));
    const q = h('textarea', { class: 'input', rows: 3, placeholder: 'نص السؤال' });
    const opts = [0, 1, 2, 3].map((i) => h('input', { class: 'input', placeholder: i === 0 ? '✔ الإجابة الصحيحة' : 'إجابة خاطئة ' + i }));
    const e = h('input', { class: 'input', placeholder: 'شرح/مصدر (اختياري)' });
    const save = async () => {
      const obj = { cat: cat.value, diff: Number(diff.value), q: q.value.trim(), a: opts.map((o) => o.value.trim()), c: 0, e: e.value.trim() };
      if (!isValid(obj) || obj.q.length < 5 || obj.a.some((x) => !x)) return toast('كمّل السؤال والإجابات الأربعة', 'err');
      addCustom(obj);
      if (online) { try { await publishQuestion(obj); toast('اتنشر للكل ✅', 'ok'); } catch (err) { toast('اتحفظ محلياً بس: ' + err.message, 'err'); } } else toast('اتضاف ✅', 'ok');
      q.value = ''; opts.forEach((o) => (o.value = '')); e.value = '';
    };
    const importBtn = h('button', { class: 'btn btn-ghost', onclick: async () => {
      const t = await pickFile('.json'); if (!t) return;
      try {
        const list = normalizeImport(JSON.parse(t));
        const n = importQuestions(list);
        toast(`اتستورد ${n} سؤال جديد من ${list.length}`, 'ok'); draw();
      } catch { toast('ملف JSON غير صالح', 'err'); }
    } }, '📥 استيراد أسئلة (JSON — يدعم صيغة المشروع القديم)');
    return [
      h('div', { class: 'card stack' }, h('label', { class: 'lbl' }, 'القسم'), cat, h('label', { class: 'lbl' }, 'الصعوبة'), diff, h('label', { class: 'lbl' }, 'السؤال'), q,
        h('label', { class: 'lbl' }, 'الإجابات (الأولى هي الصحيحة، وبتتخلط تلقائياً)'), ...opts, e, h('button', { class: 'btn btn-gold', onclick: save }, online ? 'إضافة ونشر' : 'إضافة')),
      importBtn,
      h('button', { class: 'btn btn-ghost', onclick: () => download('questions.json', JSON.stringify(getBank().map(({ cat, diff, q, a, c, e }) => ({ cat, diff, q, a, c, e })), null, 2)) }, '📤 تصدير البنك كاملاً'),
    ];
  }

  function settingsTab() {
    const s = getSettings();
    const date = h('input', { class: 'input', type: 'date', value: ramadanStartKey() });
    const ann = h('input', { class: 'input', placeholder: 'إعلان يظهر في الصفحة الرئيسية', value: s.announce || '' });
    return [
      h('div', { class: 'card stack' },
        h('label', { class: 'lbl' }, 'أول يوم رمضان'), date,
        h('small', { class: 'muted' }, 'بعد رؤية الهلال عدّل التاريخ لو اختلف.'),
        h('label', { class: 'lbl' }, 'إعلان'), ann,
        h('button', { class: 'btn btn-gold', onclick: async () => {
          setSettings({ ramadanStart: date.value, announce: ann.value.trim() });
          if (online) { try { await publishConfig({ ramadanStart: date.value, announce: ann.value.trim() }); toast('اتنشر للكل ✅', 'ok'); } catch (err) { toast('اتحفظ محلياً بس: ' + err.message, 'err'); } } else toast('اتحفظ ✅', 'ok');
        } }, 'حفظ')),
      h('p', { class: 'fine' }, online ? 'متصل بـ Firebase: التغييرات هنا بتتنشر لكل اللاعبين.' : 'الوضع المحلي: التغييرات على جهازك بس.'),
      h('button', { class: 'btn btn-ghost', onclick: () => { location.hash = '#/me'; } }, 'رجوع'),
    ];
  }

  draw();
  return { el: h('div', { class: 'screen' }, h('h1', { class: 'page-title' }, 'لوحة الإدارة 🛠️'), tabs, body) };
}
