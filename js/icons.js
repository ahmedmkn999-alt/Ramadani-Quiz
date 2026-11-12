// أيقونات SVG أصلية (هلال، فانوس، نجمة) — رسم خاص بالمشروع
export const crescent = (size = 64) => `
<svg width="${size}" height="${size}" viewBox="90 70 340 380" aria-hidden="true">
  <defs><linearGradient id="gc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe9a6"/><stop offset="1" stop-color="#e0a82e"/></linearGradient></defs>
  <path d="M300 90a170 170 0 1 0 0 332 140 140 0 1 1 0-332z" fill="url(#gc)"/>
  <path d="M372 150l11 25 27 3-20 18 6 27-24-14-24 14 6-27-20-18 27-3z" fill="#ffe9a6"/>
</svg>`;

export const lantern = (size = 40) => `
<svg width="${size}" height="${size * 1.5}" viewBox="0 0 40 60" aria-hidden="true">
  <defs><linearGradient id="gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffdf8a"/><stop offset="1" stop-color="#d9962a"/></linearGradient></defs>
  <path d="M20 0v8" stroke="#e0a82e" stroke-width="2"/>
  <path d="M12 8h16l-2 5H14z" fill="#e0a82e"/>
  <path d="M14 13h12c5 4 6 14 0 24H14C8 27 9 17 14 13z" fill="url(#gl)" opacity=".92"/>
  <path d="M20 13v24M14 25h12" stroke="#7a4b0c" stroke-width="1" opacity=".5"/>
  <path d="M14 37h12l2 5H12z" fill="#e0a82e"/>
  <path d="M20 42v6" stroke="#e0a82e" stroke-width="2"/><circle cx="20" cy="51" r="3" fill="#e0a82e"/>
</svg>`;
