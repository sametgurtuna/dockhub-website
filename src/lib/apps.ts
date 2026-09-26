function gear(cx: number, cy: number, outer: number, inner: number, teeth: number): string {
  const step = (Math.PI * 2) / teeth;
  const pts: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * step - Math.PI / 2;
    const angles = [a - step * 0.3, a - step * 0.16, a + step * 0.16, a + step * 0.3];
    const radii = [inner, outer, outer, inner];
    angles.forEach((ang, k) => {
      pts.push(`${pts.length ? 'L' : 'M'}${(cx + Math.cos(ang) * radii[k]).toFixed(2)} ${(cy + Math.sin(ang) * radii[k]).toFixed(2)}`);
    });
  }
  return `${pts.join(' ')} Z`;
}

const svg = (body: string) => `<svg viewBox="0 0 48 48" aria-hidden="true">${body}</svg>`;

/**
 * Gradients, clips and the shared soft shadow live in a single <svg> definition block on the page (Base.astro);
 * icons reference them by id. Styled after Windows 11's Fluent app icons: a light source from the top,
 * a darker back layer, a lighter front layer and a soft contact shadow.
 */
export const appDefs = `
<filter id="f-ic" x="-20%" y="-15%" width="140%" height="145%" color-interpolation-filters="sRGB">
  <feDropShadow dx="0" dy="1.4" stdDeviation="1.2" flood-color="#000" flood-opacity=".32"/>
</filter>
<linearGradient id="g-ex-back" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EDA921"/><stop offset="1" stop-color="#C47F0C"/></linearGradient>
<linearGradient id="g-ex-front" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFDF7A"/><stop offset=".55" stop-color="#FFC940"/><stop offset="1" stop-color="#F4AE22"/></linearGradient>
<linearGradient id="g-ex-paper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E3EAF3"/></linearGradient>
<radialGradient id="g-br" cx=".38" cy=".3" r=".85"><stop offset="0" stop-color="#6DE3FF"/><stop offset=".45" stop-color="#1E9BF0"/><stop offset="1" stop-color="#0B4DB8"/></radialGradient>
<linearGradient id="g-br-land" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7FF0B4"/><stop offset="1" stop-color="#1FB57A"/></linearGradient>
<linearGradient id="g-br-ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#BFE9FF"/></linearGradient>
<radialGradient id="g-br-hi" cx=".32" cy=".22" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<linearGradient id="g-tm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34353D"/><stop offset="1" stop-color="#15161B"/></linearGradient>
<linearGradient id="g-tm-bar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5A5B66"/><stop offset="1" stop-color="#43444E"/></linearGradient>
<linearGradient id="g-tm-p" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7FE0FF"/><stop offset="1" stop-color="#3A8BFF"/></linearGradient>
<linearGradient id="g-np" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#DCE3EE"/></linearGradient>
<linearGradient id="g-np-top" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3D8BF0"/><stop offset="1" stop-color="#1D63D0"/></linearGradient>
<linearGradient id="g-np-pen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFC45A"/><stop offset="1" stop-color="#F28C1E"/></linearGradient>
<linearGradient id="g-ph" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8FDBFF"/><stop offset="1" stop-color="#4A92F0"/></linearGradient>
<linearGradient id="g-ph-back" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2F5FA"/><stop offset="1" stop-color="#CBD5E3"/></linearGradient>
<linearGradient id="g-ph-hill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4CC98A"/><stop offset="1" stop-color="#1E9A62"/></linearGradient>
<linearGradient id="g-mu" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF8A5B"/><stop offset=".5" stop-color="#F5427A"/><stop offset="1" stop-color="#B42BD6"/></linearGradient>
<linearGradient id="g-st" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C9D3E1"/><stop offset="1" stop-color="#6D7D95"/></linearGradient>
<linearGradient id="g-st-in" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3D4656"/><stop offset="1" stop-color="#1F2530"/></linearGradient>
<linearGradient id="g-ca" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3F434F"/><stop offset="1" stop-color="#1B1D24"/></linearGradient>
<linearGradient id="g-ca-key" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6B707E"/><stop offset="1" stop-color="#555A67"/></linearGradient>
<linearGradient id="g-ca-eq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5FC6FF"/><stop offset="1" stop-color="#2A8AF0"/></linearGradient>
<linearGradient id="g-bin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EEF4FC" stop-opacity=".95"/><stop offset="1" stop-color="#9FB4D2" stop-opacity=".95"/></linearGradient>
<linearGradient id="g-bin-lid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#C9D7EA"/></linearGradient>
<linearGradient id="g-pc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4E5566"/><stop offset="1" stop-color="#262A33"/></linearGradient>
<radialGradient id="g-pc-wall" cx=".5" cy=".9" r=".9"><stop offset="0" stop-color="#9BE1FF"/><stop offset=".35" stop-color="#2F8BF0"/><stop offset="1" stop-color="#0B2C78"/></radialGradient>
<linearGradient id="g-pc-stand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C5CEDB"/><stop offset="1" stop-color="#8795AA"/></linearGradient>
<clipPath id="c-ph"><rect x="7" y="10" width="34" height="28" rx="5"/></clipPath>
<clipPath id="c-br"><circle cx="24" cy="24" r="18"/></clipPath>
<clipPath id="c-pc"><rect x="7" y="9.5" width="34" height="21" rx="2"/></clipPath>
`;

export const appIcons = {
  explorer: svg(`<g filter="url(#f-ic)">
    <path d="M4 12.5A3.5 3.5 0 0 1 7.5 9h9.9a3 3 0 0 1 2.12.88L22.6 13H40.5A3.5 3.5 0 0 1 44 16.5v18A3.5 3.5 0 0 1 40.5 38h-33A3.5 3.5 0 0 1 4 34.5z" fill="url(#g-ex-back)"/>
    <rect x="8.5" y="14.5" width="31" height="16" rx="2" fill="url(#g-ex-paper)"/>
    <path d="M4 20.5A3.5 3.5 0 0 1 7.5 17h33a3.5 3.5 0 0 1 3.5 3.5v14a3.5 3.5 0 0 1-3.5 3.5h-33A3.5 3.5 0 0 1 4 34.5z" fill="url(#g-ex-front)"/>
    <path d="M7.5 17h33a3.5 3.5 0 0 1 3.5 3.5v.8a3.5 3.5 0 0 0-3.5-3.2h-33A3.5 3.5 0 0 0 4 21.3v-.8A3.5 3.5 0 0 1 7.5 17z" fill="#fff" fill-opacity=".7"/>
  </g>`),
  browser: svg(`<g filter="url(#f-ic)">
    <circle cx="24" cy="24" r="18" fill="url(#g-br)"/>
    <g clip-path="url(#c-br)">
      <path d="M9 19c3-1 5 1 8 0s3-5 7-5 4 3 3 5-4 3-4 6 3 4 2 7-5 4-7 2-2-5-5-6-6-1-6-4 0-4 2-5z" fill="url(#g-br-land)" opacity=".92"/>
      <path d="M31 29c2-1 5 0 7 2s1 6-2 7-5-1-6-3 0-5 1-6z" fill="url(#g-br-land)" opacity=".85"/>
    </g>
    <ellipse cx="24" cy="24" rx="23" ry="8.2" transform="rotate(-24 24 24)" fill="none" stroke="url(#g-br-ring)" stroke-width="2.6" stroke-dasharray="46 6 200" stroke-linecap="round"/>
    <circle cx="24" cy="24" r="18" fill="url(#g-br-hi)"/>
    <circle cx="24" cy="24" r="17.5" fill="none" stroke="#fff" stroke-opacity=".22"/>
  </g>`),
  terminal: svg(`<g filter="url(#f-ic)">
    <rect x="4" y="7" width="40" height="34" rx="5.5" fill="url(#g-tm)"/>
    <path d="M4 12.5A5.5 5.5 0 0 1 9.5 7h29A5.5 5.5 0 0 1 44 12.5V14H4z" fill="url(#g-tm-bar)"/>
    <circle cx="9.5" cy="10.6" r="1.3" fill="#FF6159"/><circle cx="13.6" cy="10.6" r="1.3" fill="#FFBD2E"/><circle cx="17.7" cy="10.6" r="1.3" fill="#28C840"/>
    <path d="M11.5 20.5l6.5 5.5-6.5 5.5" stroke="url(#g-tm-p)" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M21.5 32.5h11" stroke="#F2F4F8" stroke-width="3.2" stroke-linecap="round"/>
    <rect x="4.5" y="7.5" width="39" height="33" rx="5" fill="none" stroke="#fff" stroke-opacity=".14"/>
  </g>`),
  notepad: svg(`<g filter="url(#f-ic)">
    <rect x="8" y="7" width="30" height="36" rx="4" fill="url(#g-np)"/>
    <path d="M8 11a4 4 0 0 1 4-4h22a4 4 0 0 1 4 4v4H8z" fill="url(#g-np-top)"/>
    <g fill="#E9EEF6" stroke="#9AA8BD" stroke-width="1"><rect x="12.5" y="4.5" width="3" height="6.5" rx="1.5"/><rect x="18.5" y="4.5" width="3" height="6.5" rx="1.5"/><rect x="24.5" y="4.5" width="3" height="6.5" rx="1.5"/><rect x="30.5" y="4.5" width="3" height="6.5" rx="1.5"/></g>
    <path d="M13 22h20M13 27.5h20M13 33h12" stroke="#8C99AE" stroke-width="2" stroke-linecap="round"/>
    <g transform="rotate(40 34 32)">
      <rect x="31.5" y="19" width="5" height="18" rx="1.2" fill="url(#g-np-pen)"/>
      <rect x="31.5" y="19" width="5" height="3.2" rx="1.2" fill="#F07BA0"/>
      <path d="M31.5 37h5l-2.5 4.6z" fill="#F3D9B1"/><path d="M33.2 40.1h1.6l-.8 1.5z" fill="#3B3F4A"/>
    </g>
  </g>`),
  photos: svg(`<g filter="url(#f-ic)">
    <rect x="9" y="5.5" width="32" height="26" rx="4.5" transform="rotate(-8 25 18)" fill="url(#g-ph-back)"/>
    <rect x="7" y="10" width="34" height="28" rx="5" fill="url(#g-ph)"/>
    <circle cx="32" cy="18" r="3.6" fill="#FFE27A"/>
    <g clip-path="url(#c-ph)">
      <path d="M5 33l11-10.5 8 7.5 4.5-4L43 37v4H5z" fill="#2F6FD6"/>
      <path d="M5 36.5l10.5-7 8.5 6 5.5-3.5L43 39v3H5z" fill="url(#g-ph-hill)"/>
    </g>
    <rect x="7.5" y="10.5" width="33" height="27" rx="4.5" fill="none" stroke="#fff" stroke-opacity=".35"/>
  </g>`),
  music: svg(`<g filter="url(#f-ic)">
    <rect x="5" y="5" width="38" height="38" rx="10" fill="url(#g-mu)"/>
    <path d="M5 15a10 10 0 0 1 10-10h18a10 10 0 0 1 10 10v2C38 12 30 10 24 10S10 12 5 17z" fill="#fff" fill-opacity=".16"/>
    <path d="M20 31.5V15.8l13-2.8v15.4" stroke="#fff" stroke-width="2.8" fill="none" stroke-linejoin="round"/>
    <path d="M20 19.6l13-2.8" stroke="#fff" stroke-width="2.8"/>
    <ellipse cx="16.6" cy="31.6" rx="4" ry="3.4" fill="#fff"/><ellipse cx="29.6" cy="28.4" rx="4" ry="3.4" fill="#fff"/>
  </g>`),
  settings: svg(`<g filter="url(#f-ic)">
    <path fill="url(#g-st)" d="${gear(24, 24, 19.5, 15.5, 8)}"/>
    <circle cx="24" cy="24" r="12" fill="url(#g-st-in)"/>
    <circle cx="24" cy="24" r="6.2" fill="url(#g-st)"/>
    <circle cx="24" cy="24" r="12" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="1.2"/>
    <circle cx="24" cy="24" r="3" fill="#2B3240"/>
  </g>`),
  calculator: svg(`<g filter="url(#f-ic)">
    <rect x="8.5" y="4.5" width="31" height="39" rx="5" fill="url(#g-ca)"/>
    <rect x="12.5" y="8.5" width="23" height="8.5" rx="2" fill="#10131A"/>
    <path d="M26 14.5h6.5" stroke="#E8ECF3" stroke-width="2" stroke-linecap="round"/>
    <g fill="url(#g-ca-key)"><rect x="12.5" y="20.5" width="6.5" height="5.5" rx="1.5"/><rect x="21" y="20.5" width="6.5" height="5.5" rx="1.5"/><rect x="12.5" y="28" width="6.5" height="5.5" rx="1.5"/><rect x="21" y="28" width="6.5" height="5.5" rx="1.5"/><rect x="12.5" y="35.5" width="15" height="4.5" rx="1.5"/></g>
    <rect x="29.5" y="20.5" width="6" height="5.5" rx="1.5" fill="#8A909E"/>
    <rect x="29.5" y="28" width="6" height="12" rx="1.5" fill="url(#g-ca-eq)"/>
    <rect x="9" y="5" width="30" height="38" rx="4.5" fill="none" stroke="#fff" stroke-opacity=".12"/>
  </g>`),
  bin: svg(`<g filter="url(#f-ic)">
    <path d="M12.5 15h23l-2.6 24.4A3.2 3.2 0 0 1 29.7 42H18.3a3.2 3.2 0 0 1-3.2-2.6z" fill="url(#g-bin)"/>
    <path d="M17 19l1.2 19M24 19v19M31 19l-1.2 19" stroke="#6F86A8" stroke-opacity=".7" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M12.5 15h23l-.3 3H12.8z" fill="#8499B8" fill-opacity=".45"/>
    <rect x="10" y="10" width="28" height="5.5" rx="2.4" fill="url(#g-bin-lid)"/>
    <path d="M20 10V8.6A1.6 1.6 0 0 1 21.6 7h4.8A1.6 1.6 0 0 1 28 8.6V10" stroke="#B9C8DC" stroke-width="1.8" fill="none"/>
  </g>`),
  pc: svg(`<g filter="url(#f-ic)">
    <path d="M20 33h8l1 6h-10z" fill="url(#g-pc-stand)"/>
    <rect x="14" y="38.5" width="20" height="3" rx="1.5" fill="url(#g-pc-stand)"/>
    <rect x="4.5" y="7" width="39" height="26" rx="3.5" fill="url(#g-pc)"/>
    <rect x="7" y="9.5" width="34" height="21" rx="2" fill="url(#g-pc-wall)"/>
    <g clip-path="url(#c-pc)">
      <path d="M12 33c4-9 9-13 12-13s8 4 12 13z" fill="#7FD3FF" fill-opacity=".55"/>
      <path d="M16 33c3-6 6-9 8-9s5 3 8 9z" fill="#DDF4FF" fill-opacity=".7"/>
    </g>
  </g>`),
} as const;

export type AppId = keyof typeof appIcons;

export interface AppDef {
  id: AppId;
  name: string;
}

export const dockApps: AppDef[] = [
  { id: 'explorer', name: 'File Explorer' },
  { id: 'browser', name: 'Browser' },
  { id: 'terminal', name: 'Terminal' },
  { id: 'notepad', name: 'Notepad' },
  { id: 'music', name: 'Media Player' },
];

export const appNames: Record<AppId, string> = {
  explorer: 'File Explorer',
  browser: 'Browser',
  terminal: 'Terminal',
  notepad: 'Notepad',
  photos: 'Photos',
  music: 'Media Player',
  settings: 'Settings',
  calculator: 'Calculator',
  bin: 'Recycle Bin',
  pc: 'This PC',
};
