// أصوات واهتزاز بسيط عبر WebAudio (بدون ملفات صوت = يشتغل أوفلاين)
import { getProfile } from './store.js';

let ctx = null;
function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, start, dur, type = 'sine', gain = 0.08) {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t = c.currentTime + start;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

const SFX = {
  correct: () => { tone(660, 0, 0.14); tone(880, 0.1, 0.22); },
  wrong:   () => { tone(220, 0, 0.25, 'sawtooth', 0.06); tone(165, 0.12, 0.3, 'sawtooth', 0.06); },
  tick:    () => tone(900, 0, 0.05, 'square', 0.03),
  win:     () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.3)),
  spin:    () => tone(500, 0, 0.04, 'triangle', 0.05),
  tap:     () => tone(480, 0, 0.05, 'triangle', 0.04),
};

export function sfx(name) {
  if (!getProfile().prefs.sound) return;
  try { SFX[name]?.(); } catch { /* ignore */ }
}

export function buzz(ms = 30) {
  if (!getProfile().prefs.haptics) return;
  try { navigator.vibrate?.(ms); } catch { /* ignore */ }
}
