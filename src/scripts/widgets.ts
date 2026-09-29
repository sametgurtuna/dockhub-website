import { icons, deviceGlyph } from '../lib/icons';
import {
  sim,
  tracks,
  onFrame,
  hhmm,
  mmss,
  pad,
  fmt1,
  TR_DAYS,
  TR_MONTHS,
  TR_MONTHS_LONG,
  type WeatherCode,
} from './sim';

/* ------------------------------------------------------------------ DOM */

type Kid = Node | string | number | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, any> = {},
  ...kids: Kid[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style') el.setAttribute('style', v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

/* ---------------------------------------------------------------- parts */

export function ring(size: number, sw: number, color: string, track: string) {
  const r = (size - sw) / 2;
  const el = h('div', { class: 'ring', style: `--size:${size}px` });
  el.innerHTML = `<svg viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${sw}" style="stroke:${track}"/>
    <circle class="ring-fill" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${sw}" pathLength="100" stroke-dasharray="100 100" stroke-dashoffset="100" stroke-linecap="round" style="stroke:${color}"/>
  </svg>`;
  const inner = h('span', { class: 'ring-inner' });
  el.append(inner);
  const fill = el.querySelector('.ring-fill') as SVGCircleElement;
  let lastV = -1;
  return {
    el,
    inner,
    set(v: number) {
      const c = Math.max(0, Math.min(100, v));
      if (Math.abs(c - lastV) < 0.05) return;
      lastV = c;
      fill.setAttribute('stroke-dashoffset', String(100 - c));
      fill.style.opacity = c < 0.3 ? '0' : '1';
    },
    color(c: string) {
      fill.style.stroke = c;
    },
  };
}

export function analog(size: number) {
  const el = h('div', { class: 'analog', style: `--size:${size}px` });
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const long = i % 3 === 0;
    return `<line x1="50" y1="${long ? 7 : 8}" x2="50" y2="${long ? 15 : 12}" stroke-width="${long ? 3.4 : 2}" transform="rotate(${i * 30} 50 50)"/>`;
  }).join('');
  el.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true">
    <circle class="an-face" cx="50" cy="50" r="48"/>
    <g class="an-ticks" stroke-linecap="round">${ticks}</g>
    <line class="an-h" x1="50" y1="50" x2="50" y2="27" stroke-width="6" stroke-linecap="round"/>
    <line class="an-m" x1="50" y1="50" x2="50" y2="15" stroke-width="4.2" stroke-linecap="round"/>
    <line class="an-s" x1="50" y1="58" x2="50" y2="12" stroke-width="1.8" stroke-linecap="round"/>
    <circle class="an-pin" cx="50" cy="50" r="3.6"/>
  </svg>`;
  const hH = el.querySelector('.an-h')!;
  const hM = el.querySelector('.an-m')!;
  const hS = el.querySelector('.an-s')!;
  return {
    el,
    set(d: Date, offsetH = 0) {
      const hours = (d.getHours() + offsetH + 24) % 24;
      const m = d.getMinutes();
      const s = d.getSeconds();
      el.classList.toggle('is-night', hours < 7 || hours >= 19);
      hH.setAttribute('transform', `rotate(${(hours % 12) * 30 + m * 0.5} 50 50)`);
      hM.setAttribute('transform', `rotate(${m * 6 + s * 0.1} 50 50)`);
      hS.setAttribute('transform', `rotate(${s * 6} 50 50)`);
    },
  };
}

export function weatherIcon(code: WeatherCode, size = 28) {
  const sun = (cx: number, cy: number, r: number) =>
    `<g><circle cx="${cx}" cy="${cy}" r="${r}" fill="#FFD60A"/>${Array.from({ length: 8 }, (_, i) => {
      const a = (i * Math.PI) / 4;
      return `<line x1="${cx + Math.cos(a) * (r + 2.4)}" y1="${cy + Math.sin(a) * (r + 2.4)}" x2="${cx + Math.cos(a) * (r + 4.6)}" y2="${cy + Math.sin(a) * (r + 4.6)}" stroke="#FFD60A" stroke-width="1.8" stroke-linecap="round"/>`;
    }).join('')}</g>`;
  const cloud = (dx: number, dy: number, s: number, fill = 'var(--cloud, #D9DCE3)') =>
    `<path transform="translate(${dx} ${dy}) scale(${s})" d="M17.5 19H8a5 5 0 1 1 1.6-9.7A6 6 0 0 1 20.8 11.6 3.8 3.8 0 0 1 17.5 19Z" fill="${fill}"/>`;
  let body = '';
  switch (code) {
    case 'sun':
      body = sun(16, 16, 6.5);
      break;
    case 'moon':
      body = `<path d="M22 19.5A9 9 0 0 1 12.5 8a9 9 0 1 0 9.5 11.5Z" fill="#F2E7B6"/>`;
      break;
    case 'partly':
      body = `${sun(12, 11, 5)}${cloud(5, 5, 1.05)}`;
      break;
    case 'cloud':
      body = `${cloud(1, 3, 1.25, '#AEB5C2')}${cloud(5, 6, 1.05)}`;
      break;
    case 'rain':
      body = `${cloud(2, 0, 1.2)}<g stroke="#5AC8FA" stroke-width="2" stroke-linecap="round"><line x1="11" y1="25" x2="9.5" y2="29"/><line x1="16.5" y1="25" x2="15" y2="29"/><line x1="22" y1="25" x2="20.5" y2="29"/></g>`;
      break;
  }
  return `<svg class="wx" viewBox="0 0 32 32" width="${size}" height="${size}" aria-hidden="true">${body}</svg>`;
}

export function albumArt(index: number) {
  const [a, b, c] = tracks[index].art;
  const id = `art${index}`;
  return `<svg viewBox="0 0 60 60" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs>
    <rect width="60" height="60" fill="url(#${id})"/>
    <circle cx="${18 + index * 9}" cy="${22 + index * 4}" r="${20 - index * 2}" fill="${b}" opacity=".85"/>
    <circle cx="${44 - index * 6}" cy="${40 - index * 3}" r="${12 + index * 2}" fill="${a}" opacity=".55"/>
    <path d="M0 ${46 - index * 4} Q30 ${34 + index * 3} 60 ${44 - index * 2} V60 H0Z" fill="${c}" opacity=".6"/>
  </svg>`;
}

function sparkline(values: number[], w: number, hgt: number, max?: number) {
  const m = max ?? Math.max(...values) * 1.15;
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(hgt - (v / m) * hgt).toFixed(1)}`);
  return { line: `M${pts.join(' L')}`, area: `M0,${hgt} L${pts.join(' L')} L${w},${hgt} Z` };
}

function tickBar(count: number) {
  const el = h('div', { class: 'tickbar' });
  const ticks = Array.from({ length: count }, () => h('i'));
  el.append(...ticks);
  return {
    el,
    set(pct: number) {
      const on = Math.round((pct / 100) * count);
      ticks.forEach((t, i) => t.classList.toggle('on', i < on));
    },
  };
}

/* ------------------------------------------------------------ registry */

export type Category = 'Clocks' | 'Reminders' | 'Notes' | 'Productivity' | 'Media' | 'System' | 'Weather' | 'AI';

export interface Instance {
  uid: string;
  id: string;
  variant: string;
  state: Record<string, any>;
}

export interface View {
  el: HTMLElement;
  tick?(now: Date): void;
  frame?(dt: number): void;
  refresh?(): void;
}

export interface Env {
  refreshAll(): void;
  toast?(title: string, body: string): void;
}

export interface WidgetDef {
  id: string;
  name: string;
  category: Category;
  description: string;
  icon: string;
  accent: string;
  variants: { id: string; name: string }[];
  init?(): Record<string, any>;
  card(i: Instance, env: Env): View;
  compact(i: Instance, env: Env): View;
  panel(i: Instance, env: Env): View;
  primary?(i: Instance, env: Env): void;
}

const card = (cls: string, ...kids: Kid[]) => h('div', { class: `wc ${cls}` }, ...kids);
const compactTile = (...kids: Kid[]) => h('div', { class: 'wt' }, ...kids);
const glyph = (path: string, color: string) =>
  h('span', {
    class: 'wt-glyph',
    style: `color:${color}`,
    html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`,
  });
const panelShell = (title: string, ...kids: Kid[]) => h('div', { class: 'wp' }, h('div', { class: 'wp-title', text: title }), ...kids);
const monthGrid = (d: Date) => {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const grid = h('div', { class: 'cal' }, ...['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((x) => h('b', { text: x })));
  for (let i = 0; i < lead; i++) grid.append(h('span'));
  for (let day = 1; day <= days; day++) grid.append(h('span', { class: day === d.getDate() ? 'today' : '', text: day }));
  return grid;
};

const ACCENT = {
  green: 'var(--c-green)',
  orange: 'var(--c-orange)',
  blue: 'var(--c-blue)',
  cyan: 'var(--c-cyan)',
  magenta: 'var(--c-magenta)',
  pink: 'var(--c-pink)',
  purple: 'var(--c-purple)',
  yellow: 'var(--c-yellow)',
  red: 'var(--c-red)',
};
const TRACK = {
  green: 'var(--t-green)',
  orange: 'var(--t-orange)',
  blue: 'var(--t-blue)',
  magenta: 'var(--t-magenta)',
  neutral: 'var(--w-track)',
};

const ICON = {
  clock: 'M12,3 A9,9 0 1 1 11.99,3 Z M12,7 V12 L15,14',
  world: 'M12,3 A9,9 0 1 1 11.99,3 Z M3,12 H21 M12,3 C15,6 15,18 12,21 C9,18 9,6 12,3 Z',
  stopwatch: 'M12,5 A8,8 0 1 1 11.99,5 Z M12,9 V13 M10,2 H14 M19,6 L20.5,4.5',
  focus: 'M12,3 A9,9 0 1 1 11.99,3 Z M12,6 A6,6 0 0 1 18,12',
  countdown: 'M12,5 A8,8 0 1 1 11.99,5 Z M12,13 L15,10 M10,2 H14',
  alarm: 'M12,6 A7,7 0 1 1 11.99,6 Z M12,9 V13 L14,14 M4,5 L7,2.5 M20,5 L17,2.5',
  progress: 'M3,8 H21 V16 H3 Z M6,8 V16 M9,8 V16 M12,8 V16',
  drop: 'M12,3 C12,3 5.5,10 5.5,14.5 A6.5,6.5 0 0 0 18.5,14.5 C18.5,10 12,3 12,3 Z',
  list: 'M8,6 H20 M8,12 H20 M8,18 H20 M4,6 H4.5 M4,12 H4.5 M4,18 H4.5',
  note: 'M5,4 H19 V14 L14,20 H5 Z M14,20 V14 H19',
  music: 'M9,17 V5 L20,3 V15 M9,17 A2.5,2.5 0 1 1 4,17 A2.5,2.5 0 1 1 9,17 Z M20,15 A2.5,2.5 0 1 1 15,15 A2.5,2.5 0 1 1 20,15 Z',
  pulse: 'M3,12 H7 L10,4 L14,20 L17,12 H21',
  network: 'M8,4 V20 M4,16 L8,20 L12,16 M16,20 V4 M12,8 L16,4 L20,8',
  status: 'M12,4 A8,8 0 1 1 11.99,4 Z M12,8 A4,4 0 1 1 11.99,8 Z',
  weather: 'M17.5,19 H8 A5,5 0 1 1 9.6,9.3 A6,6 0 0 1 20.8,11.6 A3.8,3.8 0 0 1 17.5,19 Z',
  audio: 'M11,4 L6,8 H3 A1,1 0 0 0 2,9 V15 A1,1 0 0 0 3,16 H6 L11,20 A1,1 0 0 0 12.5,19.2 V4.8 A1,1 0 0 0 11,4 Z M16,8 A5,5 0 0 1 16,16 M19,5 A9,9 0 0 1 19,19',
  batteryDevices: 'M4,7 H18 A2,2 0 0 1 20,9 V15 A2,2 0 0 1 18,17 H4 A2,2 0 0 1 2,15 V9 A2,2 0 0 1 4,7 Z M20,11 H22 V13 H20 Z',
  recycleBin: 'M3,6 H21 M8,6 V4 A2,2 0 0 1 10,2 H14 A2,2 0 0 1 16,4 V6 M19,6 V20 A2,2 0 0 1 17,22 H7 A2,2 0 0 1 5,20 V6 Z M10,11 V17 M14,11 V17',
  group: 'M3,7 H21 V19 A2,2 0 0 1 19,21 H5 A2,2 0 0 1 3,19 Z M3,7 L7,3 H13 L15,5',
  calendar: 'M4,6 H20 V20 H4 Z M4,10 H20 M8,3 V7 M16,3 V7 M8,14 H10 M14,14 H16',
  clipboard: 'M8,4 H6 A2,2 0 0 0 4,6 V20 A2,2 0 0 0 6,22 H18 A2,2 0 0 0 20,20 V6 A2,2 0 0 0 18,4 H16 M9,2 H15 V6 H9 Z M8,12 H16 M8,16 H13',
  stack: 'M4,8 L12,4 L20,8 L12,12 Z M4,12 L12,16 L20,12 M4,16 L12,20 L20,16',
  currency: 'M12,3 A9,9 0 1 1 11.99,3 Z M15,8.5 C14,7.5 13,7.2 12,7.2 C10.2,7.2 9,8.2 9,9.6 C9,12.8 15,11.4 15,14.4 C15,15.8 13.8,16.8 12,16.8 C10.8,16.8 9.7,16.3 9,15.4 M12,5.5 V7.2 M12,16.8 V18.5',
  ai: 'M12,3 L14.2,9.2 L20.8,9.2 L15.5,13.1 L17.5,19.3 L12,15.6 L6.5,19.3 L8.5,13.1 L3.2,9.2 L9.8,9.2 Z',
  gpu: 'M4,7 H20 V17 H4 Z M8,17 V20 M16,17 V20 M8,10 H10 V14 H8 Z M13,10 H16 V14 H13 Z M2,10 H4 M2,14 H4',
  sun: 'M12,8 A4,4 0 1 1 11.99,8 Z M12,2 V4 M12,20 V22 M4.9,4.9 L6.3,6.3 M17.7,17.7 L19.1,19.1 M2,12 H4 M20,12 H22 M4.9,19.1 L6.3,17.7 M17.7,6.3 L19.1,4.9',
  radios: 'M5,12.5 A10,10 0 0 1 19,12.5 M8,15.5 A5.5,5.5 0 0 1 16,15.5 M12,19 H12.01 M2,9.5 A14,14 0 0 1 22,9.5',
  camera: 'M4,8 A2,2 0 0 1 6,6 H8 L9.5,4 H14.5 L16,6 H18 A2,2 0 0 1 20,8 V17 A2,2 0 0 1 18,19 H6 A2,2 0 0 1 4,17 Z M12,9.5 A3.2,3.2 0 1 1 11.99,9.5 Z',
  todo: 'M4,6.5 L5.5,8 L8,5 M4,12.5 L5.5,14 L8,11 M4,18.5 L5.5,20 L8,17 M11,7 H20 M11,13 H20 M11,19 H17',
  bluetooth: 'M7,7 L17,16 L12,20.5 V3.5 L17,8 L7,17',
  scissors: 'M6,6 A2.5,2.5 0 1 1 5.99,6 Z M6,18 A2.5,2.5 0 1 1 5.99,18 Z M8,7.5 L20,17 M8,16.5 L20,7',
  folder: 'M4,7.5 A1.5,1.5 0 0 1 5.5,6 H9.5 L11.5,8 H18.5 A1.5,1.5 0 0 1 20,9.5 V18 A1.5,1.5 0 0 1 18.5,19.5 H5.5 A1.5,1.5 0 0 1 4,18 Z',
};

/* 0.8.0 widgets share a little state so the dock, the gallery and the panels stay in sync. */
const display = { level: 70, night: false };
const radios = { wifi: true, bt: false };
interface Todo {
  id: number;
  text: string;
  when?: string;
  overdue?: boolean;
}
let todoSeq = 10;
const todos: Todo[] = [
  { id: 1, text: 'Reply to Deniz', when: '10:00' },
  { id: 2, text: 'Book the dentist', overdue: true },
  { id: 3, text: 'Review the release notes' },
  { id: 4, text: 'Buy milk' },
];
const svgIcon = (path: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;
const iconBtn = (path: string, label: string, onclick: (e: Event) => void, cls = '') =>
  h('button', { class: `mc-btn ${cls}`, type: 'button', 'aria-label': label, title: label, html: svgIcon(path), onclick });

const cities = [
  { name: 'Istanbul', short: 'IST', off: 0 },
  { name: 'Tokyo', short: 'TYO', off: 6 },
  { name: 'New York', short: 'NYC', off: -7 },
];

const noteColors: Record<string, string> = {
  yellow: '#F3CD5B',
  orange: '#F5A55B',
  red: '#F2848F',
  purple: '#D59BEA',
  blue: '#86BBF2',
  green: '#A3D48A',
};
const noteColorNames: Record<string, string> = {
  yellow: 'Yellow',
  orange: 'Orange',
  red: 'Red',
  purple: 'Purple',
  blue: 'Blue',
  green: 'Green',
};

function timerToggle(st: Record<string, any>) {
  st.running = !st.running;
}

function mediaControls(env: Env, size: 'sm' | 'lg') {
  const m = sim.media;
  const btn = (name: 'prev' | 'play' | 'next', label: string, fn: () => void) =>
    h('button', {
      class: `mc-btn mc-${name}`,
      'aria-label': label,
      html: icons[name],
      onclick: (e: Event) => {
        e.stopPropagation();
        fn();
        env.refreshAll();
      },
    });
  const play = btn('play', 'Play', () => (m.playing = !m.playing));
  const el = h(
    'div',
    { class: `mc mc-${size}` },
    btn('prev', 'Previous', () => {
      if (m.pos > 3) m.pos = 0;
      else {
        m.index = (m.index + tracks.length - 1) % tracks.length;
        m.pos = 0;
      }
    }),
    play,
    btn('next', 'Next', () => {
      m.index = (m.index + 1) % tracks.length;
      m.pos = 0;
    }),
  );
  return {
    el,
    sync() {
      play.innerHTML = m.playing ? icons.pause : icons.play;
      play.setAttribute('aria-label', m.playing ? 'Pause' : 'Play');
    },
  };
}

/* ------------------------------------------------- productivity data */

type Meeting = { title: string; where: string; online: boolean; color: string; start: Date; end: Date };
function meetingsFrom(d: Date): Meeting[] {
  // Anchored to the current time so the demo always has something coming up.
  const base = new Date(d);
  base.setSeconds(0, 0);
  base.setMinutes(Math.floor(base.getMinutes() / 15) * 15);
  const at = (mins: number, len: number, title: string, where: string, online: boolean, color: string): Meeting => {
    const start = new Date(base.getTime() + mins * 60000);
    return { title, where, online, color, start, end: new Date(start.getTime() + len * 60000) };
  };
  return [
    at(-75, 30, 'Standup', 'Teams', true, '#5B8CFF'),
    at(15, 30, 'Design review', 'Teams', true, '#5B8CFF'),
    at(90, 60, 'Lunch with Deniz', 'Kadıköy', false, '#F5A55B'),
    at(210, 45, '1:1 with Alex', 'Google Meet', true, '#34C759'),
  ];
}

type Clip = { kind: 'text' | 'link' | 'image'; text: string; when: string; pinned?: boolean; art?: number };
const clips: Clip[] = [
  { kind: 'text', text: 'git push origin v0.9.2', when: 'Just now' },
  { kind: 'link', text: 'github.com/sametgurtuna/DockHub', when: '2 min ago' },
  { kind: 'image', text: 'Screenshot 1280 × 720', when: '9 min ago', art: 1 },
  { kind: 'text', text: 'Ship the new widgets on Friday', when: '24 min ago', pinned: true },
  { kind: 'text', text: 'Kadıköy, Moda Cd. No: 12', when: '1 hour ago' },
];

type DlFile = { name: string; ext: string; size: string; when: string };
const files: DlFile[] = [
  { name: 'Quarterly report.pdf', ext: 'pdf', size: '2.4 MB', when: '3 min ago' },
  { name: 'Holiday photo.jpg', ext: 'jpg', size: '4.1 MB', when: '18 min ago' },
  { name: 'Budget 2027.xlsx', ext: 'xlsx', size: '86 KB', when: '1 hour ago' },
  { name: 'DockHub-Setup-0.9.2-x64.exe', ext: 'exe', size: '59.5 MB', when: '2 hours ago' },
  { name: 'Slides.pptx', ext: 'pptx', size: '12 MB', when: 'Yesterday' },
  { name: 'Assets.zip', ext: 'zip', size: '31 MB', when: 'Yesterday' },
];
const EXT_COLORS: Record<string, string> = { pdf: '#E5484D', jpg: '#30A46C', xlsx: '#1F7A45', exe: '#5B8CFF', pptx: '#E5702A', zip: '#8E7CC3' };
function fileBadge(ext: string, big = false) {
  return h('span', { class: `file-badge${big ? ' big' : ''}`, style: `--fc:${EXT_COLORS[ext] ?? '#8A94A6'}` }, h('b', { text: ext.toUpperCase() }));
}

type Rate = { base: string; quote: string; rate: number; change: number; trend: number[] };
const rates: Rate[] = [
  { base: 'USD', quote: 'TRY', rate: 41.37, change: 0.18, trend: [40.9, 40.95, 41.0, 41.02, 41.08, 41.05, 41.12, 41.18, 41.2, 41.22, 41.27, 41.3, 41.3, 41.37] },
  { base: 'EUR', quote: 'TRY', rate: 48.62, change: -0.07, trend: [48.1, 48.3, 48.2, 48.4, 48.5, 48.45, 48.6, 48.7, 48.66, 48.72, 48.8, 48.7, 48.65, 48.62] },
  { base: 'EUR', quote: 'USD', rate: 1.1752, change: -0.25, trend: [1.169, 1.171, 1.174, 1.173, 1.176, 1.179, 1.18, 1.178, 1.181, 1.183, 1.182, 1.179, 1.178, 1.1752] },
];
const fxSpark = (r: Rate, w: number, hgt: number) => {
  const lo = Math.min(...r.trend);
  const sp = sparkline(r.trend.map((v) => v - lo + (Math.max(...r.trend) - lo) * 0.15), w, hgt);
  return `<svg viewBox="0 0 ${w} ${hgt}" width="${w}" height="${hgt}" aria-hidden="true"><path d="${sp.area}" class="fx-area"/><path d="${sp.line}" class="fx-line"/></svg>`;
};

export const widgets: WidgetDef[] = [
  /* ----------------------------------------------------------- Clock */
  {
    id: 'clock',
    name: 'Clock',
    category: 'Clocks',
    description: 'Analog, digital, or calendar view. Calendar displays your next upcoming reminder.',
    icon: ICON.clock,
    accent: ACCENT.orange,
    variants: [
      { id: 'analog', name: 'Analog' },
      { id: 'digital', name: 'Digital' },
      { id: 'calendar', name: 'Calendar' },
    ],
    card(i) {
      if (i.variant === 'analog') {
        const a = analog(40);
        return { el: card('wc-square', a.el), tick: (d) => a.set(d) };
      }
      if (i.variant === 'digital') {
        const t = h('div', { class: 'wc-big num' });
        const s = h('div', { class: 'wc-sub' });
        return {
          el: card('wc-stack wc-digital', t, s),
          tick: (d) => {
            t.textContent = hhmm(d);
            s.textContent = `${TR_DAYS[d.getDay()]}, ${TR_MONTHS[d.getMonth()]} ${d.getDate()}`;
          },
        };
      }
      const dow = h('div', { class: 'cal-dow' });
      const day = h('div', { class: 'cal-day num' });
      const next = sim.reminders.find((r) => !r.done);
      return {
        el: card(
          'wc-calendar',
          h('div', { class: 'cal-date' }, dow, day),
          h('div', { class: 'wc-stack' }, h('div', { class: 'wc-title', text: next?.title ?? 'No events today' }), h('div', { class: 'wc-sub', text: next?.time ?? 'No reminders' })),
        ),
        tick: (d) => {
          dow.textContent = TR_DAYS[d.getDay()].toUpperCase();
          day.textContent = String(d.getDate());
        },
      };
    },
    compact(i) {
      if (i.variant === 'analog') {
        const a = analog(26);
        return { el: compactTile(a.el), tick: (d) => a.set(d) };
      }
      const t = h('div', { class: 'wt-label num' });
      return {
        el: compactTile(t),
        tick: (d) => {
          t.innerHTML = i.variant === 'calendar' ? `<small>${TR_DAYS[d.getDay()]}</small>${d.getDate()}` : `${pad(d.getHours())}<br>${pad(d.getMinutes())}`;
        },
      };
    },
    panel() {
      const a = analog(120);
      const date = h('div', { class: 'wp-hero-sub' });
      const time = h('div', { class: 'wp-hero num' });
      const grid = h('div');
      let lastDay = -1;
      return {
        el: panelShell('Clock', h('div', { class: 'wp-row wp-clock' }, a.el, h('div', {}, time, date)), grid),
        tick: (d) => {
          a.set(d);
          time.textContent = `${hhmm(d)}:${pad(d.getSeconds())}`;
          date.textContent = d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
          if (d.getDate() !== lastDay) {
            lastDay = d.getDate();
            grid.replaceChildren(h('div', { class: 'wp-label', text: `${TR_MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}` }), monthGrid(d));
          }
        },
      };
    },
  },
  /* ----------------------------------------------------- World Clock */
  {
    id: 'world-clock',
    name: 'World Clock',
    category: 'Clocks',
    description: 'Track single or multiple timezones with day and night dial indicators.',
    icon: ICON.world,
    accent: ACCENT.blue,
    variants: [
      { id: 'single', name: 'Single city' },
      { id: 'multi', name: 'Multiple cities' },
    ],
    card(i) {
      const list = i.variant === 'single' ? [cities[1]] : cities;
      const cells = list.map((c) => {
        const a = analog(i.variant === 'single' ? 30 : 22);
        const t = h('div', { class: 'wc-title num' });
        return { c, a, t, el: h('div', { class: 'wc-city' }, a.el, h('div', { class: 'wc-stack' }, h('div', { class: 'wc-sub', text: i.variant === 'single' ? c.name : c.short }), t)) };
      });
      return {
        el: card('wc-world', ...cells.map((x) => x.el)),
        tick: (d) =>
          cells.forEach(({ c, a, t }) => {
            a.set(d, c.off);
            t.textContent = `${pad((d.getHours() + c.off + 24) % 24)}:${pad(d.getMinutes())}`;
          }),
      };
    },
    compact() {
      const t = h('div', { class: 'wt-text num' });
      return {
        el: compactTile(glyph(ICON.world, ACCENT.blue), t),
        tick: (d) => (t.textContent = `${pad((d.getHours() + 6) % 24)}:${pad(d.getMinutes())}`),
      };
    },
    panel() {
      const rows = cities.map((c) => {
        const a = analog(40);
        const t = h('div', { class: 'wp-num num' });
        return { c, a, t, el: h('div', { class: 'wp-list-row' }, a.el, h('div', { class: 'grow' }, h('div', { class: 'wp-strong', text: c.name }), h('div', { class: 'wp-muted', text: c.off === 0 ? 'Local time' : `${c.off > 0 ? '+' : ''}${c.off} hrs` })), t) };
      });
      return {
        el: panelShell('World Clock', h('div', { class: 'wp-list' }, ...rows.map((r) => r.el))),
        tick: (d) =>
          rows.forEach(({ c, a, t }) => {
            a.set(d, c.off);
            t.textContent = `${pad((d.getHours() + c.off + 24) % 24)}:${pad(d.getMinutes())}`;
          }),
      };
    },
  },
  /* ------------------------------------------------------ Stopwatch */
  {
    id: 'stopwatch',
    name: 'Stopwatch',
    category: 'Clocks',
    description: 'Click to start, click again to pause. Reset anytime from the right-click menu.',
    icon: ICON.stopwatch,
    accent: ACCENT.orange,
    variants: [{ id: 'default', name: 'Standard' }],
    init: () => ({ elapsed: 0, running: false }),
    primary(i, env) {
      timerToggle(i.state);
      env.refreshAll();
    },
    card(i) {
      const t = h('div', { class: 'wc-big num' });
      const dot = h('span', { class: 'live-dot' });
      const s = h('div', { class: 'wc-sub' }, dot, h('span'));
      const view: View = {
        el: card('wc-stack wc-stopwatch', t, s),
        frame: () => {
          const e = i.state.elapsed;
          t.textContent = `${pad(Math.floor(e / 60))}:${pad(Math.floor(e % 60))},${Math.floor((e * 10) % 10)}`;
        },
        refresh: () => {
          dot.classList.toggle('on', i.state.running);
          (s.lastChild as HTMLElement).textContent = i.state.running ? 'Running' : i.state.elapsed > 0 ? 'Paused' : 'Click to start';
        },
      };
      return view;
    },
    compact(i) {
      const t = h('div', { class: 'wt-text num' });
      return {
        el: compactTile(glyph(ICON.stopwatch, ACCENT.orange), t),
        frame: () => (t.textContent = `${Math.floor(i.state.elapsed / 60)}:${pad(Math.floor(i.state.elapsed % 60))}`),
      };
    },
    panel(i, env) {
      const t = h('div', { class: 'wp-hero num' });
      const go = h('button', { class: 'wp-btn accent', onclick: () => { timerToggle(i.state); env.refreshAll(); } });
      const reset = h('button', { class: 'wp-btn', text: 'Reset', onclick: () => { i.state.elapsed = 0; i.state.running = false; env.refreshAll(); } });
      return {
        el: panelShell('Stopwatch', t, h('div', { class: 'wp-actions' }, go, reset)),
        frame: () => {
          const e = i.state.elapsed;
          t.textContent = `${pad(Math.floor(e / 60))}:${pad(Math.floor(e % 60))},${pad(Math.floor((e * 100) % 100))}`;
        },
        refresh: () => (go.textContent = i.state.running ? 'Pause' : 'Start'),
      };
    },
  },
  /* ------------------------------------------------ Focus Timer */
  {
    id: 'focus',
    name: 'Focus Timer',
    category: 'Clocks',
    description: 'Pomodoro technique: focused sprints and short breaks with completion notifications.',
    icon: ICON.focus,
    accent: ACCENT.orange,
    variants: [{ id: 'default', name: 'Standard' }],
    init: () => ({ total: 25 * 60, left: 25 * 60, running: false, phase: 'Focus' }),
    primary(i, env) {
      timerToggle(i.state);
      env.refreshAll();
    },
    card(i, env) {
      const r = ring(30, 3.2, ACCENT.orange, TRACK.orange);
      const t = h('div', { class: 'wc-title num' });
      const s = h('div', { class: 'wc-sub' });
      return {
        el: card('wc-focus', r.el, h('div', { class: 'wc-stack' }, t, s)),
        tick: () => {
          r.set((1 - i.state.left / i.state.total) * 100);
          t.textContent = mmss(i.state.left);
        },
        refresh: () => {
          s.textContent = i.state.running ? i.state.phase : `${i.state.phase} · start`;
          r.set((1 - i.state.left / i.state.total) * 100);
          t.textContent = mmss(i.state.left);
        },
      };
    },
    compact(i) {
      const r = ring(26, 2.6, ACCENT.orange, TRACK.orange);
      return {
        el: compactTile(r.el),
        tick: () => {
          r.set((1 - i.state.left / i.state.total) * 100);
          r.inner.textContent = String(Math.ceil(i.state.left / 60));
        },
      };
    },
    panel(i, env) {
      const r = ring(132, 8, ACCENT.orange, TRACK.orange);
      r.inner.classList.add('ring-inner-lg', 'num');
      const go = h('button', { class: 'wp-btn accent', onclick: () => { timerToggle(i.state); env.refreshAll(); } });
      const reset = h('button', {
        class: 'wp-btn',
        text: 'Reset',
        onclick: () => {
          Object.assign(i.state, { left: i.state.total, running: false });
          env.refreshAll();
        },
      });
      const phase = h('div', { class: 'wp-muted center' });
      return {
        el: panelShell('Focus Timer', h('div', { class: 'center' }, r.el), phase, h('div', { class: 'wp-actions' }, go, reset)),
        tick: () => {
          r.set((1 - i.state.left / i.state.total) * 100);
          r.inner.textContent = mmss(i.state.left);
        },
        refresh: () => {
          go.textContent = i.state.running ? 'Pause' : 'Start';
          phase.textContent = `${i.state.phase} · 25 min focus, 5 min break`;
          r.set((1 - i.state.left / i.state.total) * 100);
          r.inner.textContent = mmss(i.state.left);
        },
      };
    },
  },
  /* ------------------------------------------------------ Countdown */
  {
    id: 'countdown',
    name: 'Countdown Timer',
    category: 'Clocks',
    description: 'Quick duration presets with customizable labels and desktop alerts when done.',
    icon: ICON.countdown,
    accent: ACCENT.yellow,
    variants: [{ id: 'default', name: 'Standard' }],
    init: () => ({ total: 5 * 60, left: 5 * 60, running: false, label: 'Tea' }),
    primary(i, env) {
      if (i.state.left <= 0) i.state.left = i.state.total;
      timerToggle(i.state);
      env.refreshAll();
    },
    card(i, env) {
      const r = ring(30, 3.2, ACCENT.yellow, 'var(--t-yellow)');
      const t = h('div', { class: 'wc-title num' });
      const s = h('div', { class: 'wc-sub' });
      return {
        el: card('wc-focus', r.el, h('div', { class: 'wc-stack' }, t, s)),
        tick: () => {
          t.textContent = mmss(i.state.left);
          r.set((i.state.left / i.state.total) * 100);
        },
        refresh: () => {
          t.textContent = mmss(i.state.left);
          r.set((i.state.left / i.state.total) * 100);
          s.textContent = i.state.running ? i.state.label : `${i.state.label} · start`;
        },
      };
    },
    compact(i) {
      const r = ring(26, 2.6, ACCENT.yellow, 'var(--t-yellow)');
      return {
        el: compactTile(r.el),
        tick: () => {
          r.set((i.state.left / i.state.total) * 100);
          r.inner.textContent = String(Math.ceil(i.state.left / 60));
        },
      };
    },
    panel(i, env) {
      const t = h('div', { class: 'wp-hero num' });
      const go = h('button', { class: 'wp-btn accent', onclick: () => { if (i.state.left <= 0) i.state.left = i.state.total; timerToggle(i.state); env.refreshAll(); } });
      const presets = h(
        'div',
        { class: 'wp-chips' },
        ...[1, 3, 5, 10, 25].map((m) =>
          h('button', {
            class: 'wp-chip',
            text: `${m} min`,
            onclick: () => {
              Object.assign(i.state, { total: m * 60, left: m * 60, running: true });
              env.refreshAll();
            },
          }),
        ),
      );
      return {
        el: panelShell('Countdown Timer', t, h('div', { class: 'wp-label', text: 'Presets' }), presets, h('div', { class: 'wp-actions' }, go)),
        tick: () => (t.textContent = mmss(i.state.left)),
        refresh: () => {
          t.textContent = mmss(i.state.left);
          go.textContent = i.state.running ? 'Pause' : 'Start';
          presets.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.textContent === `${i.state.total / 60} min`));
        },
      };
    },
  },
  /* ----------------------------------------------------------- Alarm */
  {
    id: 'alarm',
    name: 'Alarm',
    category: 'Clocks',
    description: 'Time, custom label, and daily repetition with persistent chime notifications.',
    icon: ICON.alarm,
    accent: ACCENT.red,
    variants: [{ id: 'default', name: 'Standard' }],
    init: () => ({ time: '07:30', on: true, label: 'Wake up' }),
    card(i) {
      const s = h('div', { class: 'wc-sub' });
      return {
        el: card('wc-alarm', glyph(ICON.alarm, ACCENT.red), h('div', { class: 'wc-stack' }, h('div', { class: 'wc-title num', text: i.state.time }), s)),
        refresh: () => {
          s.textContent = i.state.on ? 'Every day' : 'Off';
          s.parentElement!.parentElement!.classList.toggle('is-off', !i.state.on);
        },
      };
    },
    compact(i) {
      return { el: compactTile(glyph(ICON.alarm, ACCENT.red), h('div', { class: 'wt-text num', text: i.state.time })) };
    },
    panel(i, env) {
      const sw = h('button', { class: 'switch', role: 'switch', 'aria-label': 'Alarm enabled', onclick: () => { i.state.on = !i.state.on; env.refreshAll(); } });
      return {
        el: panelShell('Alarm', h('div', { class: 'wp-list-row' }, h('div', { class: 'grow' }, h('div', { class: 'wp-hero num', text: i.state.time }), h('div', { class: 'wp-muted', text: `${i.state.label} · every day` })), sw)),
        refresh: () => sw.setAttribute('aria-checked', String(i.state.on)),
      };
    },
  },
  /* ----------------------------------------------- Time Progress */
  {
    id: 'time-progress',
    name: 'Time Progress',
    category: 'Clocks',
    description: 'Visualize how much of the day, week, month, or year has elapsed.',
    icon: ICON.progress,
    accent: ACCENT.purple,
    variants: [
      { id: 'bar', name: 'Bar' },
      { id: 'ring', name: 'Ring' },
    ],
    card(i) {
      if (i.variant === 'ring') {
        const r = ring(30, 3.2, ACCENT.purple, 'var(--t-purple)');
        r.inner.classList.add('num');
        return {
          el: card('wc-focus', r.el, h('div', { class: 'wc-stack' }, h('div', { class: 'wc-title', text: 'Day' }), h('div', { class: 'wc-sub', text: 'elapsed' }))),
          tick: (d) => {
            const p = dayPct(d);
            r.set(p);
            r.inner.textContent = String(Math.floor(p));
          },
        };
      }
      const tb = tickBar(16);
      const v = h('span', { class: 'num' });
      return {
        el: card('wc-stack wc-progress', h('div', { class: 'wc-row' }, h('span', { class: 'wc-title', text: 'Day' }), v), tb.el),
        tick: (d) => {
          const p = dayPct(d);
          tb.set(p);
          v.textContent = `${Math.floor(p)}%`;
        },
      };
    },
    compact() {
      const r = ring(26, 2.6, ACCENT.purple, 'var(--t-purple)');
      return {
        el: compactTile(r.el),
        tick: (d) => {
          r.set(dayPct(d));
          r.inner.textContent = String(Math.floor(dayPct(d)));
        },
      };
    },
    panel() {
      const rows = ['Day', 'Week', 'Month', 'Year'].map((name) => {
        const tb = tickBar(24);
        const v = h('span', { class: 'num' });
        return { name, tb, v, el: h('div', { class: 'wp-progress' }, h('div', { class: 'wc-row' }, h('span', { class: 'wp-strong', text: name }), v), tb.el) };
      });
      return {
        el: panelShell('Time Progress', ...rows.map((r) => r.el)),
        tick: (d) =>
          rows.forEach((r) => {
            const p = periodPct(d, r.name);
            r.tb.set(p);
            r.v.textContent = `${Math.floor(p)}%`;
          }),
      };
    },
  },
  /* -------------------------------------------------------- Hydration */
  {
    id: 'hydration',
    name: 'Hydration Tracker',
    category: 'Reminders',
    description: 'Click to log a glass of water. Timed reminders include a quick "Drank" button.',
    icon: ICON.drop,
    accent: ACCENT.cyan,
    variants: [
      { id: 'timer', name: 'Timer' },
      { id: 'goal', name: 'Daily goal' },
    ],
    primary(_i, env) {
      const hy = sim.hydration;
      hy.count = hy.count >= hy.goal ? 0 : hy.count + 1;
      hy.next = 45 * 60;
      env.refreshAll();
      if (hy.count === hy.goal) env.toast?.('Daily goal reached', `You drank ${hy.goal} glasses of water. Keep it up!`);
    },
    card(i) {
      const hy = sim.hydration;
      if (i.variant === 'goal') {
        const drops = Array.from({ length: hy.goal }, () => h('i', { html: icons.drop }));
        const t = h('div', { class: 'wc-title num' });
        return {
          el: card('wc-hydration wc-stack', t, h('div', { class: 'drops' }, ...drops)),
          refresh: () => {
            t.textContent = `${hy.count} / ${hy.goal} glasses`;
            drops.forEach((d, k) => d.classList.toggle('on', k < hy.count));
          },
        };
      }
      const t = h('div', { class: 'wc-title num' });
      const s = h('div', { class: 'wc-sub num' });
      const el = card('wc-hydration', h('span', { class: 'wc-drop', html: icons.drop }), h('div', { class: 'wc-stack' }, t, s));
      return {
        el,
        tick: () => (s.textContent = hy.next > 0 ? `Next in ${Math.ceil(hy.next / 60)} min` : 'Time to hydrate'),
        refresh: () => {
          t.textContent = `${hy.count}/${hy.goal}`;
          el.classList.remove('splash');
          void el.offsetWidth;
          el.classList.add('splash');
        },
      };
    },
    compact() {
      const r = ring(26, 2.6, ACCENT.cyan, 'var(--t-cyan)');
      return {
        el: compactTile(r.el),
        refresh: () => {
          r.set((sim.hydration.count / sim.hydration.goal) * 100);
          r.inner.textContent = String(sim.hydration.count);
        },
      };
    },
    panel(_i, env) {
      const hy = sim.hydration;
      const drops = Array.from({ length: hy.goal }, () => h('i', { html: icons.drop }));
      const t = h('div', { class: 'wp-hero num' });
      return {
        el: panelShell(
          'Hydration Tracker',
          t,
          h('div', { class: 'drops drops-lg' }, ...drops),
          h('div', { class: 'wp-muted', text: 'Reminds you every 45 minutes. The "Drank" button in notifications also counts.' }),
          h('div', { class: 'wp-actions' }, h('button', { class: 'wp-btn accent', text: 'Drank', onclick: () => { hy.count = Math.min(hy.goal, hy.count + 1); hy.next = 45 * 60; env.refreshAll(); } }), h('button', { class: 'wp-btn', text: 'Reset', onclick: () => { hy.count = 0; env.refreshAll(); } })),
        ),
        refresh: () => {
          t.textContent = `${hy.count} / ${hy.goal} glasses`;
          drops.forEach((d, k) => d.classList.toggle('on', k < hy.count));
        },
      };
    },
  },
  /* -------------------------------------------------- Reminders */
  {
    id: 'reminders',
    name: 'Reminders',
    category: 'Reminders',
    description: 'Full list, next upcoming reminder, or count. Notification includes a "Snooze 10m" action.',
    icon: ICON.list,
    accent: ACCENT.blue,
    variants: [
      { id: 'next', name: 'Next' },
      { id: 'list', name: 'List' },
      { id: 'count', name: 'Count' },
    ],
    card(i) {
      const box = card(i.variant === 'count' ? 'wc-count' : 'wc-stack wc-reminders');
      return {
        el: box,
        refresh: () => {
          const open = sim.reminders.filter((r) => !r.done);
          if (i.variant === 'count') {
            box.replaceChildren(h('div', { class: 'wc-big num', text: open.length }), h('div', { class: 'wc-sub', html: 'pending<br>reminders' }));
          } else if (i.variant === 'list') {
            box.replaceChildren(...(open.length ? open.slice(0, 2).map((r) => h('div', { class: 'wc-li' }, h('i'), h('span', { text: r.title }))) : [h('div', { class: 'wc-sub', text: 'All done' })]));
          } else {
            const n = open[0];
            box.replaceChildren(h('div', { class: 'wc-li' }, h('i'), h('span', { class: 'wc-title', text: n?.title ?? 'All done' })), h('div', { class: 'wc-sub', text: n?.time ?? 'No upcoming reminders' }));
          }
        },
      };
    },
    compact() {
      const t = h('div', { class: 'wt-text num' });
      return {
        el: compactTile(glyph(ICON.list, ACCENT.blue), t),
        refresh: () => (t.textContent = String(sim.reminders.filter((r) => !r.done).length)),
      };
    },
    panel(_i, env) {
      const list = h('div', { class: 'wp-list' });
      return {
        el: panelShell('Reminders', list),
        refresh: () =>
          list.replaceChildren(
            ...sim.reminders.map((r) =>
              h(
                'div',
                { class: `wp-list-row ${r.done ? 'is-done' : ''}` },
                h('button', { class: 'check', role: 'checkbox', 'aria-checked': String(r.done), 'aria-label': r.title, html: icons.check, onclick: () => { r.done = !r.done; env.refreshAll(); } }),
                h('div', { class: 'grow' }, h('div', { class: 'wp-strong', text: r.title }), h('div', { class: 'wp-muted', text: r.time })),
                h('button', { class: 'wp-chip', text: 'Snooze 10m', onclick: () => env.toast?.('Snoozed', `"${r.title}" will remind you again in 10 minutes.`) }),
              ),
            ),
          ),
      };
    },
  },
  /* --------------------------------------------------- Sticky Notes */
  {
    id: 'notes',
    name: 'Sticky Notes',
    category: 'Notes',
    description: 'Dock preview for your quick notes. Click to expand full notepad; auto-saves instantly.',
    icon: ICON.note,
    accent: ACCENT.yellow,
    variants: [{ id: 'default', name: 'Standard' }],
    init: () => ({ text: 'Groceries: milk, olive oil, coffee\nMonday team sync', color: 'yellow', size: 15 }),
    card(i) {
      const p = h('div', { class: 'note-preview' });
      const el = card('wc-note', p);
      return {
        el,
        refresh: () => {
          el.style.setProperty('--note', noteColors[i.state.color]);
          p.textContent = i.state.text || 'Empty note';
        },
      };
    },
    compact(i) {
      const n = h('div', { class: 'wt-note' });
      return {
        el: compactTile(n),
        refresh: () => {
          n.style.background = noteColors[i.state.color];
          n.textContent = (i.state.text || '').slice(0, 2);
        },
      };
    },
    panel(i, env) {
      const ta = h('textarea', { class: 'note-paper', 'aria-label': 'Note text', spellcheck: 'false' }) as HTMLTextAreaElement;
      ta.value = i.state.text;
      ta.addEventListener('input', () => {
        i.state.text = ta.value;
        env.refreshAll();
      });
      const chips = h(
        'div',
        { class: 'note-colors', role: 'radiogroup', 'aria-label': 'Paper color' },
        ...Object.keys(noteColors).map((k) =>
          h('button', {
            class: 'note-color',
            role: 'radio',
            'aria-label': noteColorNames[k],
            style: `--c:${noteColors[k]}`,
            'data-color': k,
            onclick: () => {
              i.state.color = k;
              env.refreshAll();
            },
          }),
        ),
      );
      const wrap = h('div', { class: 'wp wp-note' }, ta, h('div', { class: 'note-foot' }, chips, h('span', { class: 'wp-muted', text: 'Auto-saves automatically' })));
      return {
        el: wrap,
        refresh: () => {
          wrap.style.setProperty('--note', noteColors[i.state.color]);
          chips.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.color === i.state.color)));
        },
      };
    },
  },
  /* ------------------------------------------------------- Calendar */
  {
    id: 'calendar',
    name: 'Calendar',
    category: 'Productivity',
    description: 'Your next meeting from any iCal (.ics) link, with a Join button for Teams, Meet and Zoom. No sign-in needed.',
    icon: ICON.calendar,
    accent: ACCENT.red,
    variants: [
      { id: 'next', name: 'Next event' },
      { id: 'agenda', name: "Today's agenda" },
    ],
    card(i, env) {
      const bar = h('i', { class: 'meet-bar' });
      const title = h('div', { class: 'wc-title' });
      const sub = h('div', { class: 'wc-sub num' });
      const join = h('span', {
        class: 'meet-join',
        text: 'Join',
        onclick: (e: Event) => {
          e.stopPropagation();
          env.toast?.('Joining meeting', 'DockHub opens the Teams, Meet or Zoom link from the invite.');
        },
      });
      const box = card('wc-meet', bar, h('div', { class: 'wc-stack grow' }, title, sub));
      return {
        el: box,
        tick: (d) => {
          const upcoming = meetingsFrom(d).filter((m) => m.end > d);
          const n = upcoming[0];
          if (!n) {
            title.textContent = 'No more events';
            sub.textContent = 'Enjoy the rest of the day';
            join.remove();
            return;
          }
          bar.style.background = n.color;
          if (i.variant === 'agenda') {
            title.textContent = `${upcoming.length} events left today`;
            sub.textContent = `Next ${hhmm(n.start)} · ${n.title}`;
            join.remove();
            return;
          }
          const mins = Math.ceil((n.start.getTime() - d.getTime()) / 60000);
          title.textContent = n.title;
          sub.textContent = mins <= 0 ? `Now · until ${hhmm(n.end)}` : mins < 60 ? `in ${mins} min · ${n.where}` : `${hhmm(n.start)} · ${n.where}`;
          if (n.online && mins <= 20) box.append(join);
          else join.remove();
        },
      };
    },
    compact() {
      const t = h('div', { class: 'wt-text num' });
      return {
        el: compactTile(glyph(ICON.calendar, ACCENT.red), t),
        tick: (d) => {
          const n = meetingsFrom(d).find((m) => m.end > d);
          t.textContent = n ? hhmm(n.start) : '–';
        },
      };
    },
    panel(_i, env) {
      const list = h('div', { class: 'wp-list' });
      return {
        el: panelShell("Today's agenda", list, h('div', { class: 'wp-foot', text: 'Sample events. The app reads any iCal (.ics) link and reminds you 5 minutes before each event.' })),
        tick: (d) =>
          list.replaceChildren(
            ...meetingsFrom(d).map((m) =>
              h(
                'div',
                { class: `wp-list-row ${m.end <= d ? 'is-done' : ''}` },
                h('i', { class: 'meet-dot', style: `background:${m.color}` }),
                h('div', { class: 'grow' }, h('div', { class: 'wp-strong', text: m.title }), h('div', { class: 'wp-muted num', text: `${hhmm(m.start)} – ${hhmm(m.end)} · ${m.where}` })),
                m.online && m.end > d ? h('button', { class: 'wp-chip on', text: 'Join', onclick: () => env.toast?.('Joining meeting', `DockHub opens the ${m.where} link from the invite.`) }) : null,
              ),
            ),
          ),
      };
    },
  },
  /* ------------------------------------------------ Clipboard history */
  {
    id: 'clipboard',
    name: 'Clipboard History',
    category: 'Productivity',
    description: 'The last 25 texts and images you copied. Click to copy again, pin what you need. Password managers are never recorded.',
    icon: ICON.clipboard,
    accent: ACCENT.purple,
    variants: [{ id: 'default', name: 'Standard' }],
    card() {
      const title = h('div', { class: 'wc-title' });
      const sub = h('div', { class: 'wc-sub' });
      return {
        el: card('wc-clip', glyph(ICON.clipboard, ACCENT.purple), h('div', { class: 'wc-stack' }, title, sub)),
        refresh: () => {
          title.textContent = clips[0].text;
          sub.textContent = `${clips.length} items · ${clips.filter((c) => c.pinned).length} pinned`;
        },
      };
    },
    compact() {
      const t = h('div', { class: 'wt-text num' });
      return { el: compactTile(glyph(ICON.clipboard, ACCENT.purple), t), refresh: () => (t.textContent = String(clips.length)) };
    },
    panel(_i, env) {
      const list = h('div', { class: 'wp-list' });
      const render = () =>
        list.replaceChildren(
          ...[...clips.filter((c) => c.pinned), ...clips.filter((c) => !c.pinned)].map((c) =>
            h(
              'div',
              { class: 'wp-list-row clip-row' },
              c.kind === 'image' ? h('span', { class: 'clip-thumb', html: albumArt(c.art ?? 0) }) : h('span', { class: 'clip-kind', text: c.kind === 'link' ? 'URL' : 'Aa' }),
              h(
                'button',
                {
                  class: 'grow clip-copy',
                  type: 'button',
                  onclick: () => {
                    clips.splice(clips.indexOf(c), 1);
                    clips.unshift(c);
                    env.toast?.('Copied to clipboard', c.text);
                    env.refreshAll();
                  },
                },
                h('div', { class: 'wp-strong', text: c.text }),
                h('div', { class: 'wp-muted', text: c.when }),
              ),
              h('button', {
                class: `wp-chip ${c.pinned ? 'on' : ''}`,
                type: 'button',
                text: c.pinned ? 'Pinned' : 'Pin',
                onclick: () => {
                  c.pinned = !c.pinned;
                  env.refreshAll();
                },
              }),
            ),
          ),
        );
      return { el: panelShell('Clipboard history', list, h('div', { class: 'wp-foot', text: 'Kept in memory only. Give it a shortcut in Settings › Keyboard shortcuts.' })), refresh: render };
    },
  },
  /* ----------------------------------------------------- Folder stack */
  {
    id: 'stack',
    name: 'Folder Stack',
    category: 'Productivity',
    description: 'The newest files in Downloads or any folder. Drag them straight into other apps.',
    icon: ICON.stack,
    accent: ACCENT.orange,
    variants: [
      { id: 'fan', name: 'Fan' },
      { id: 'newest', name: 'Newest file' },
    ],
    card(i) {
      if (i.variant === 'newest') {
        return { el: card('wc-files', fileBadge(files[0].ext), h('div', { class: 'wc-stack' }, h('div', { class: 'wc-title', text: files[0].name }), h('div', { class: 'wc-sub', text: `Downloads · ${files[0].when}` }))) };
      }
      const fan = h('div', { class: 'stack-fan' }, ...files.slice(0, 3).reverse().map((f) => fileBadge(f.ext)));
      return { el: card('wc-files', fan, h('div', { class: 'wc-stack' }, h('div', { class: 'wc-title', text: 'Downloads' }), h('div', { class: 'wc-sub', text: `${files.length} new files` }))) };
    },
    compact() {
      return { el: compactTile(h('div', { class: 'stack-fan sm' }, ...files.slice(0, 3).reverse().map((f) => fileBadge(f.ext)))) };
    },
    panel(_i, env) {
      return {
        el: panelShell(
          'Downloads',
          h(
            'div',
            { class: 'stack-grid' },
            ...files.map((f) =>
              h(
                'button',
                { class: 'stack-file', type: 'button', draggable: 'true', title: `${f.name} · ${f.size}`, onclick: () => env.toast?.('Opening file', `${f.name} opens in its default app.`) },
                fileBadge(f.ext, true),
                h('span', { text: f.name }),
              ),
            ),
          ),
          h('div', { class: 'wp-foot', text: 'Sample files. In the app, drag a file out of the stack into Explorer, a browser or a chat.' }),
        ),
      };
    },
  },
  /* --------------------------------------------------- Exchange rates */
  {
    id: 'currency',
    name: 'Exchange Rates',
    category: 'Productivity',
    description: 'Daily European Central Bank rates with the change since yesterday and a two-week trend.',
    icon: ICON.currency,
    accent: ACCENT.green,
    variants: [
      { id: 'trend', name: 'With trend' },
      { id: 'pair', name: 'One pair' },
    ],
    card(i) {
      const r = rates[0];
      const up = r.change >= 0;
      return {
        el: card(
          'wc-fx',
          h('div', { class: 'wc-stack' }, h('div', { class: 'wc-cap', text: `${r.base} → ${r.quote}` }), h('div', { class: 'wc-big num', text: r.rate.toFixed(2) })),
          h('div', { class: 'wc-stack fx-side' }, i.variant === 'trend' ? h('span', { class: `fx-spark ${up ? 'up' : 'down'}`, html: fxSpark(r, 46, 16) }) : null, h('span', { class: `fx-chg num ${up ? 'up' : 'down'}`, text: `${up ? '▲' : '▼'} ${Math.abs(r.change).toFixed(2)}%` })),
        ),
      };
    },
    compact() {
      return { el: compactTile(h('div', { class: 'wt-text num fx-mini', html: `<small>${rates[0].base}</small>${rates[0].rate.toFixed(1)}` })) };
    },
    panel() {
      return {
        el: panelShell(
          'Exchange rates',
          h(
            'div',
            { class: 'wp-list' },
            ...rates.map((r) => {
              const up = r.change >= 0;
              return h(
                'div',
                { class: 'wp-list-row fx-row' },
                h('div', { class: 'grow' }, h('div', { class: 'wp-strong', text: `${r.base} → ${r.quote}` }), h('div', { class: `wp-muted num fx-chg ${up ? 'up' : 'down'}`, text: `${up ? '▲' : '▼'} ${Math.abs(r.change).toFixed(2)}% since yesterday` })),
                h('span', { class: `fx-spark ${up ? 'up' : 'down'}`, html: fxSpark(r, 90, 26) }),
                h('div', { class: 'wp-strong num fx-rate', text: r.rate.toFixed(r.rate < 2 ? 4 : 2) }),
              );
            }),
          ),
          h('div', { class: 'wp-foot', text: 'Sample rates. The app uses the free Frankfurter API (ECB reference rates), updated once a day.' }),
        ),
      };
    },
  },
  /* ------------------------------------------------------------ To do */
  {
    id: 'todo',
    name: 'To Do',
    category: 'Productivity',
    description: "Today's tasks: a simple list kept on your PC, or today's and overdue tasks from Todoist. Tick to complete, type to add.",
    icon: ICON.todo,
    accent: ACCENT.green,
    variants: [
      { id: 'list', name: 'List' },
      { id: 'count', name: 'Count' },
    ],
    card(i, env) {
      if (i.variant === 'count') {
        const n = h('div', { class: 'wc-big num' });
        const next = h('div', { class: 'wc-sub' });
        return {
          el: card('wc-clip wc-todo', glyph(ICON.todo, ACCENT.green), h('div', { class: 'wc-stack' }, h('div', { class: 'wc-title', text: 'To do' }), next), n),
          refresh: () => {
            n.textContent = String(todos.length);
            next.textContent = todos[0]?.text ?? 'All done for today';
          },
        };
      }
      const rows = h('div', { class: 'wc-stack todo-rows' });
      return {
        el: card('wc-todo', rows),
        refresh: () =>
          rows.replaceChildren(
            ...(todos.length
              ? todos.slice(0, 2).map((t) =>
                  h(
                    'div',
                    { class: 'todo-row' },
                    h('button', {
                      class: `mc-btn todo-check ${t.overdue ? 'late' : ''}`,
                      type: 'button',
                      'aria-label': `Mark "${t.text}" as done`,
                      onclick: () => {
                        todos.splice(todos.indexOf(t), 1);
                        env.refreshAll();
                      },
                    }),
                    h('span', { text: t.text }),
                  ),
                )
              : [h('div', { class: 'wc-sub', text: 'All done for today' })]),
            todos.length > 2 ? h('div', { class: 'wc-sub', text: `+${todos.length - 2} more` }) : null,
          ),
      };
    },
    compact() {
      const t = h('div', { class: 'wt-text num' });
      return { el: compactTile(glyph(ICON.todo, ACCENT.green), t), refresh: () => (t.textContent = todos.length ? String(todos.length) : '') };
    },
    panel(_i, env) {
      const list = h('div', { class: 'wp-list' });
      const input = h('input', { class: 'todo-input', type: 'text', placeholder: 'Type a task and press Enter', 'aria-label': 'New task' }) as HTMLInputElement;
      input.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || !input.value.trim()) return;
        todos.push({ id: ++todoSeq, text: input.value.trim() });
        input.value = '';
        env.refreshAll();
      });
      const render = () =>
        list.replaceChildren(
          ...(todos.length
            ? todos.map((t) =>
                h(
                  'div',
                  { class: 'wp-list-row todo-prow' },
                  h('button', {
                    class: `mc-btn todo-check ${t.overdue ? 'late' : ''}`,
                    type: 'button',
                    'aria-label': `Mark "${t.text}" as done`,
                    onclick: () => {
                      todos.splice(todos.indexOf(t), 1);
                      env.toast?.('Task completed', t.text);
                      env.refreshAll();
                    },
                  }),
                  h('div', { class: 'grow wp-strong', text: t.text }),
                  t.overdue ? h('span', { class: 'wp-muted todo-late', text: 'Overdue' }) : t.when ? h('span', { class: 'wp-muted num', text: t.when }) : null,
                ),
              )
            : [h('div', { class: 'wp-muted', text: 'All done for today' })]),
        );
      return {
        el: panelShell('Today', list, input, h('div', { class: 'wp-foot', text: 'Sample tasks. In the app the list lives on your PC, or comes from Todoist with your API token.' })),
        refresh: render,
      };
    },
  },
  /* ------------------------------------------------------- Screenshot */
  {
    id: 'screenshot',
    name: 'Screenshot',
    category: 'Productivity',
    description: 'One click opens the Windows snipping overlay; the other saves every screen to Pictures › Screenshots and copies it.',
    icon: ICON.camera,
    accent: ACCENT.pink,
    variants: [
      { id: 'buttons', name: 'Buttons' },
      { id: 'icon', name: 'Icon only' },
    ],
    card(i, env) {
      if (i.variant === 'icon') return { el: card('wc-square', glyph(ICON.camera, ACCENT.pink)) };
      return {
        el: card(
          'wc-shot',
          iconBtn(ICON.scissors, 'Snip an area, a window or the screen', () => env.toast?.('Snipping', 'In the app this opens the Windows snipping overlay.')),
          iconBtn(ICON.gpu, 'Capture all screens now', () => env.toast?.('Screenshot saved', 'Screenshot 2026-09-26 101542.png · copied to the clipboard')),
          iconBtn(ICON.folder, 'Open the Screenshots folder', () => env.toast?.('Screenshots', 'Opens Pictures › Screenshots.')),
        ),
      };
    },
    compact() {
      return { el: compactTile(glyph(ICON.camera, ACCENT.pink)) };
    },
    primary(_i, env) {
      env.toast?.('Snipping', 'In the app this opens the Windows snipping overlay.');
    },
    panel(_i, env) {
      return {
        el: panelShell(
          'Screenshot',
          h(
            'div',
            { class: 'wp-chips' },
            h('button', { class: 'wp-chip on', type: 'button', text: 'Snip', onclick: () => env.toast?.('Snipping', 'In the app this opens the Windows snipping overlay.') }),
            h('button', { class: 'wp-chip', type: 'button', text: 'All screens', onclick: () => env.toast?.('Screenshot saved', 'Saved to Pictures › Screenshots and copied.') }),
            h('button', { class: 'wp-chip', type: 'button', text: 'In 5 seconds', onclick: () => env.toast?.('Countdown', 'The widget counts down 5, 4, 3… before capturing.') }),
          ),
          h('div', { class: 'wp-foot', text: 'Optional delay with a countdown on the widget. Saved captures come with Open and Show in folder buttons.' }),
        ),
      };
    },
  },
  /* -------------------------------------------------- Now Playing */
  {
    id: 'media',
    name: 'Now Playing',
    category: 'Media',
    description: 'Spotify, web browsers, VLC, and any player supporting Windows Media controls.',
    icon: ICON.music,
    accent: ACCENT.pink,
    variants: [
      { id: 'full', name: 'Full' },
      { id: 'compact', name: 'Compact' },
      { id: 'mini', name: 'Mini' },
    ],
    card(i, env) {
      const m = sim.media;
      const art = h('div', { class: 'art' });
      const title = h('div', { class: 'wc-title' });
      const artist = h('div', { class: 'wc-sub' });
      const bar = h('div', { class: 'mbar' }, h('i'));
      const ctl = mediaControls(env, 'sm');
      let shown = -1;
      const parts: Kid[] =
        i.variant === 'mini'
          ? [art, ctl.el.children[1] as HTMLElement]
          : i.variant === 'compact'
            ? [art, h('div', { class: 'wc-stack grow' }, title, artist), ctl.el.children[1] as HTMLElement]
            : [art, h('div', { class: 'wc-stack grow' }, title, artist, bar), ctl.el];
      const el = card(`wc-media wc-media-${i.variant}`, ...parts);
      return {
        el,
        frame: () => {
          (bar.firstChild as HTMLElement).style.transform = `scaleX(${m.pos / tracks[m.index].length})`;
        },
        refresh: () => {
          if (shown !== m.index) {
            shown = m.index;
            art.innerHTML = albumArt(m.index);
            title.textContent = tracks[m.index].title;
            artist.textContent = tracks[m.index].artist;
          }
          el.classList.toggle('is-playing', m.playing);
          ctl.sync();
        },
      };
    },
    compact() {
      const art = h('div', { class: 'art art-sm' });
      return { el: compactTile(art), refresh: () => (art.innerHTML = albumArt(sim.media.index)) };
    },
    panel(_i, env) {
      const m = sim.media;
      const art = h('div', { class: 'art art-lg' });
      const title = h('div', { class: 'wp-strong wp-lg' });
      const artist = h('div', { class: 'wp-muted' });
      const bar = h('div', { class: 'mbar mbar-lg' }, h('i'));
      const a = h('span', { class: 'num' });
      const b = h('span', { class: 'num' });
      const ctl = mediaControls(env, 'lg');
      return {
        el: h('div', { class: 'wp wp-media' }, art, title, artist, bar, h('div', { class: 'wc-row wp-muted' }, a, b), ctl.el, h('div', { class: 'wp-foot', text: 'Player: Media Player · Public domain classical tracks' })),
        frame: () => {
          const len = tracks[m.index].length;
          (bar.firstChild as HTMLElement).style.transform = `scaleX(${m.pos / len})`;
          a.textContent = mmss(m.pos).replace(/^0/, '');
          b.textContent = mmss(len).replace(/^0/, '');
        },
        refresh: () => {
          art.innerHTML = albumArt(m.index);
          title.textContent = tracks[m.index].title;
          artist.textContent = tracks[m.index].artist;
          ctl.sync();
        },
      };
    },
  },
  /* -------------------------------------------------- CPU & Memory */
  {
    id: 'system',
    name: 'CPU & Memory',
    category: 'System',
    description: 'Processor and memory utilization shown as rings, numbers, or activity bars.',
    icon: ICON.pulse,
    accent: ACCENT.magenta,
    variants: [
      { id: 'rings', name: 'Rings' },
      { id: 'numbers', name: 'Numbers' },
      { id: 'bars', name: 'Bars' },
    ],
    card(i) {
      const rows = [
        { label: 'CPU', spring: sim.cpu, color: ACCENT.magenta, track: TRACK.magenta },
        { label: 'RAM', spring: sim.ram, color: ACCENT.blue, track: TRACK.blue },
      ];
      if (i.variant === 'rings') {
        const rs = rows.map((r) => {
          const g = ring(32, 3.2, r.color, r.track);
          g.inner.classList.add('num');
          return { r, g, el: h('div', { class: 'wc-ringcell' }, g.el, h('div', { class: 'wc-cap', text: r.label })) };
        });
        return {
          el: card('wc-rings', ...rs.map((x) => x.el)),
          frame: () =>
            rs.forEach(({ r, g }) => {
              g.set(r.spring.value);
              g.inner.textContent = String(Math.round(r.spring.value));
            }),
        };
      }
      if (i.variant === 'bars') {
        const bs = rows.map((r) => {
          const fill = h('i', { style: `background:${r.color}` });
          const v = h('span', { class: 'num' });
          return { r, fill, v, el: h('div', { class: 'wc-barrow' }, h('span', { class: 'wc-cap', text: r.label }), h('div', { class: 'hbar', style: `background:${r.track}` }, fill), v) };
        });
        return {
          el: card('wc-stack wc-bars', ...bs.map((x) => x.el)),
          frame: () =>
            bs.forEach(({ r, fill, v }) => {
              fill.style.transform = `scaleX(${r.spring.value / 100})`;
              v.textContent = `${Math.round(r.spring.value)}%`;
            }),
        };
      }
      const ns = rows.map((r) => {
        const v = h('span', { class: 'num' });
        return { r, v, el: h('div', { class: 'wc-numrow' }, h('span', { class: 'wc-cap', style: `color:${r.color}`, text: r.label }), v) };
      });
      return {
        el: card('wc-stack wc-numbers', ...ns.map((x) => x.el)),
        frame: () => ns.forEach(({ r, v }) => (v.textContent = `${Math.round(r.spring.value)}%`)),
      };
    },
    compact() {
      const r = ring(26, 2.6, ACCENT.magenta, TRACK.magenta);
      return {
        el: compactTile(r.el, h('div', { class: 'wt-text', text: 'CPU' })),
        frame: () => {
          r.set(sim.cpu.value);
          r.inner.textContent = String(Math.round(sim.cpu.value));
        },
      };
    },
    panel() {
      const svgWrap = h('div', { class: 'spark' });
      const cpu = h('span', { class: 'wp-hero num' });
      const ram = h('span', { class: 'wp-hero num' });
      const trend = h('span', { class: 'wp-muted' });
      let t = 0;
      return {
        el: panelShell(
          'CPU & Memory',
          h('div', { class: 'wp-duo' }, h('div', {}, h('div', { class: 'wp-label', style: `color:${ACCENT.magenta}`, text: 'Processor' }), cpu), h('div', {}, h('div', { class: 'wp-label', style: `color:${ACCENT.blue}`, text: 'Memory' }), ram)),
          svgWrap,
          trend,
          h('div', { class: 'wp-foot', text: 'Update interval selectable from 1 to 10 seconds.' }),
        ),
        frame: (dt) => {
          cpu.textContent = `${Math.round(sim.cpu.value)}%`;
          ram.textContent = `${Math.round(sim.ram.value)}%`;
          t += dt;
          if (t < 0.5 && svgWrap.firstChild) return;
          t = 0;
          const s = sparkline([...sim.cpuHistory, sim.cpu.value], 260, 64, 100);
          svgWrap.innerHTML = `<svg viewBox="0 0 260 64" preserveAspectRatio="none"><path d="${s.area}" fill="var(--t-magenta)"/><path d="${s.line}" fill="none" stroke="var(--c-magenta)" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>`;
          const h8 = sim.cpuHistory.slice(-8);
          const diff = h8[h8.length - 1] - h8[0];
          trend.textContent = `Last 15 seconds: ${Math.abs(diff) < 4 ? 'steady' : diff > 0 ? 'rising' : 'falling'}`;
        },
      };
    },
  },
  /* ------------------------------------------------------------- Network */
  {
    id: 'network',
    name: 'Network Speed',
    category: 'System',
    description: 'Real-time download and upload speeds, with an optional history graph.',
    icon: ICON.network,
    accent: ACCENT.blue,
    variants: [
      { id: 'numbers', name: 'Numbers only' },
      { id: 'graph', name: 'With graph' },
    ],
    card(i) {
      const d = h('span', { class: 'num' });
      const u = h('span', { class: 'num' });
      const graph = h('div', { class: 'wc-graph' });
      const el = card(
        `wc-stack wc-net ${i.variant === 'graph' ? 'has-graph' : ''}`,
        i.variant === 'graph' ? graph : null,
        h('div', { class: 'wc-netrow' }, h('span', { class: 'ic-sm down', html: icons.arrowDown }), d),
        h('div', { class: 'wc-netrow' }, h('span', { class: 'ic-sm up', html: icons.arrowUp }), u),
      );
      let t = 1;
      return {
        el,
        frame: (dt) => {
          d.textContent = `${fmt1(sim.down.value)} MB/s`;
          u.textContent = `${Math.round(sim.up.value * 1000)} KB/s`;
          if (i.variant !== 'graph') return;
          t += dt;
          if (t < 0.5) return;
          t = 0;
          const s = sparkline([...sim.netHistory, sim.down.value], 100, 40);
          graph.innerHTML = `<svg viewBox="0 0 100 40" preserveAspectRatio="none"><path d="${s.area}" fill="var(--t-blue)"/></svg>`;
        },
      };
    },
    compact() {
      const t = h('div', { class: 'wt-text num' });
      return { el: compactTile(glyph(ICON.network, ACCENT.blue), t), frame: () => (t.textContent = fmt1(sim.down.value)) };
    },
    panel() {
      const d = h('div', { class: 'wp-hero num' });
      const u = h('div', { class: 'wp-hero num' });
      const g = h('div', { class: 'spark' });
      let t = 1;
      return {
        el: panelShell('Network Speed', h('div', { class: 'wp-duo' }, h('div', {}, h('div', { class: 'wp-label', text: 'Download' }), d), h('div', {}, h('div', { class: 'wp-label', text: 'Upload' }), u)), g, h('div', { class: 'wp-foot', text: 'Speed monitoring runs only while this widget is on the dock.' })),
        frame: (dt) => {
          d.textContent = `${fmt1(sim.down.value)} MB/s`;
          u.textContent = `${Math.round(sim.up.value * 1000)} KB/s`;
          t += dt;
          if (t < 0.5) return;
          t = 0;
          const s = sparkline([...sim.netHistory, sim.down.value], 260, 64);
          g.innerHTML = `<svg viewBox="0 0 260 64" preserveAspectRatio="none"><path d="${s.area}" fill="var(--t-blue)"/><path d="${s.line}" fill="none" stroke="var(--c-blue)" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>`;
        },
      };
    },
  },
  /* ---------------------------------------------------------- System Status */
  {
    id: 'status',
    name: 'System Status',
    category: 'System',
    description: 'Battery, disk, memory, and CPU utilization gauge rings.',
    icon: ICON.status,
    accent: ACCENT.green,
    variants: [
      { id: 'rings', name: 'Rings' },
      { id: 'percent', name: 'Percentage ring' },
      { id: 'icons', name: 'Icons only' },
    ],
    card(i) {
      const kinds = [
        { k: 'battery' as const, s: sim.battery, label: 'Battery', warn: (v: number) => v < 20 },
        { k: 'disk' as const, s: sim.disk, label: 'Disk', warn: (v: number) => v >= 90 },
        { k: 'memory' as const, s: sim.ram, label: 'Memory', warn: (v: number) => v >= 90 },
      ];
      const size = i.variant === 'icons' ? 32 : 26;
      const cells = kinds.map((x) => {
        const g = ring(size, i.variant === 'icons' ? 3.4 : 3, ACCENT.green, TRACK.green);
        if (i.variant === 'percent') g.inner.classList.add('num');
        else g.inner.innerHTML = `<span class="dg">${deviceGlyph(x.k)}</span>`;
        const cap = h('div', { class: 'wc-cap num' });
        return { x, g, cap, el: h('div', { class: 'wc-ringcell' }, g.el, i.variant === 'icons' ? null : cap) };
      });
      return {
        el: card('wc-rings wc-status', ...cells.map((c) => c.el)),
        frame: () =>
          cells.forEach(({ x, g, cap }) => {
            const v = x.s.value;
            g.set(v);
            g.color(x.warn(v) ? ACCENT.red : ACCENT.green);
            if (i.variant === 'percent') {
              g.inner.textContent = String(Math.round(v));
              cap.textContent = x.label;
            } else cap.textContent = `${Math.round(v)}%`;
          }),
      };
    },
    compact() {
      const r = ring(26, 2.6, ACCENT.green, TRACK.green);
      return {
        el: compactTile(r.el, h('div', { class: 'wt-text', text: 'Battery' })),
        frame: () => {
          r.set(sim.battery.value);
          r.inner.textContent = String(Math.round(sim.battery.value));
        },
      };
    },
    panel(_i, env) {
      const rows = [
        { k: 'battery' as const, s: sim.battery, label: 'Battery', sub: 'Approx. 4 hrs 20 min remaining' },
        { k: 'disk' as const, s: sim.disk, label: 'Disk (C:)', sub: '612 GB / 953 GB' },
        { k: 'memory' as const, s: sim.ram, label: 'Memory', sub: '16 GB' },
        { k: 'cpu' as const, s: sim.cpu, label: 'Processor', sub: '8 cores' },
      ].map((x) => {
        const g = ring(40, 4, ACCENT.green, TRACK.green);
        g.inner.innerHTML = `<span class="dg">${deviceGlyph(x.k)}</span>`;
        const v = h('div', { class: 'wp-num num' });
        return { x, g, v, el: h('div', { class: 'wp-list-row' }, g.el, h('div', { class: 'grow' }, h('div', { class: 'wp-strong', text: x.label }), h('div', { class: 'wp-muted', text: x.sub })), v) };
      });
      const drain = h('button', {
        class: 'wp-chip',
        text: 'Drain battery',
        onclick: () => {
          sim.battery.target = sim.battery.target > 30 ? 14 : 86;
          env.refreshAll();
        },
      });
      return {
        el: panelShell('System Status', h('div', { class: 'wp-list' }, ...rows.map((r) => r.el)), h('div', { class: 'wp-note-row' }, h('span', { class: 'wp-muted', text: 'Ring turns red when battery drops below 20%.' }), drain)),
        frame: () =>
          rows.forEach(({ x, g, v }) => {
            const val = x.s.value;
            g.set(val);
            g.color((x.k === 'battery' ? val < 20 : val >= 90) ? ACCENT.red : ACCENT.green);
            v.textContent = `${Math.round(val)}%`;
          }),
        refresh: () => (drain.textContent = sim.battery.target > 30 ? 'Drain battery' : 'Charge battery'),
      };
    },
  },
  /* --------------------------------------------------- Weather */
  {
    id: 'weather',
    name: 'Weather',
    category: 'Weather',
    description: 'Current weather and hourly forecast powered by Open-Meteo. No API key needed.',
    icon: ICON.weather,
    accent: ACCENT.cyan,
    variants: [
      { id: 'current', name: 'Current' },
      { id: 'condition', name: 'Condition' },
      { id: 'hourly', name: 'Hourly forecast' },
    ],
    card(i) {
      const w = sim.weather;
      if (i.variant === 'hourly') {
        const cols = w.hourly.slice(0, 5).map((x) => ({ x, t: h('div', { class: 'wc-cap num' }) }));
        return {
          el: card('wc-hourly', ...cols.map(({ x, t }) => h('div', { class: 'wc-hcol' }, t, h('span', { html: weatherIcon(x.c, 18) }), h('div', { class: 'wc-htemp num', text: `${x.t}°` })))),
          tick: (d) => cols.forEach(({ x, t }) => (t.textContent = pad((d.getHours() + x.h) % 24))),
        };
      }
      if (i.variant === 'condition') {
        return {
          el: card('wc-weather', h('span', { html: weatherIcon(w.code, 30) }), h('div', { class: 'wc-stack' }, h('div', { class: 'wc-title', html: `<span class="num">${w.temp}°</span> ${w.text}` }), h('div', { class: 'wc-sub num', text: `H ${w.hi}° L ${w.lo}° · ${w.city}` }))),
        };
      }
      return {
        el: card('wc-weather', h('span', { html: weatherIcon(w.code, 30) }), h('div', { class: 'wc-stack' }, h('div', { class: 'wc-big num', text: `${w.temp}°` }), h('div', { class: 'wc-sub', text: w.city }))),
      };
    },
    compact() {
      return { el: compactTile(h('span', { class: 'wt-wx', html: weatherIcon(sim.weather.code, 22) }), h('div', { class: 'wt-text num', text: `${sim.weather.temp}°` })) };
    },
    panel() {
      const w = sim.weather;
      const hours = h('div', { class: 'wp-hours' });
      return {
        el: panelShell(
          w.city,
          h('div', { class: 'wp-row' }, h('span', { html: weatherIcon(w.code, 56) }), h('div', {}, h('div', { class: 'wp-hero num', text: `${w.temp}°` }), h('div', { class: 'wp-muted num', text: `${w.text} · H ${w.hi}° L ${w.lo}°` }))),
          hours,
          h('div', { class: 'wp-days' }, ...w.daily.map((x) => h('div', { class: 'wp-day' }, h('span', { class: 'wp-strong', text: x.d }), h('span', { html: weatherIcon(x.c, 22) }), h('span', { class: 'num wp-muted', text: `${x.lo}°` }), h('span', { class: 'tempbar' }, h('i', { style: `left:${(x.lo - 10) * 6}%;right:${100 - (x.hi - 10) * 6}%` })), h('span', { class: 'num', text: `${x.hi}°` })))),
          h('div', { class: 'wp-foot', text: 'Sample data. The desktop app uses Open-Meteo, refreshed every 30 minutes.' }),
        ),
        tick: (d) =>
          hours.replaceChildren(
            ...w.hourly.map((x) => h('div', { class: 'wp-hour' }, h('span', { class: 'wp-muted num', text: pad((d.getHours() + x.h) % 24) }), h('span', { html: weatherIcon(x.c, 24) }), h('span', { class: 'num', text: `${x.t}°` }))),
          ),
      };
    },
  },
  /* --------------------------------------------------- Audio & Mixer */
  {
    id: 'audio',
    name: 'Audio Device & Mixer',
    category: 'Media',
    description: 'Switch between headphones and speakers with a click, adjust volume via scroll wheel, plus app mixer.',
    icon: ICON.audio,
    accent: ACCENT.cyan,
    variants: [
      { id: 'compact', name: 'Compact' },
      { id: 'slider', name: 'Slider' },
    ],
    card(i) {
      if (i.variant === 'slider') {
        return {
          el: card(
            'wc-audio',
            glyph(ICON.audio, ACCENT.cyan),
            h('div', { class: 'wc-stack', style: 'min-width:70px' },
              h('div', { class: 'wc-title', text: 'Headphones' }),
              h('div', { class: 'hbar', style: 'background:var(--w-track);margin-top:2px' }, h('i', { style: 'width:62%;background:var(--c-cyan)' }))
            ),
            h('div', { class: 'num', style: 'font-size:11px;color:var(--text-2);margin-left:4px', text: '62%' })
          ),
        };
      }
      return {
        el: card(
          'wc-audio',
          glyph(ICON.audio, ACCENT.cyan),
          h('div', { class: 'wc-stack' },
            h('div', { class: 'wc-title', text: 'Headphones' }),
            h('div', { class: 'wc-sub num', style: 'color:var(--c-cyan)', text: '62%' })
          )
        ),
      };
    },
    compact() {
      return {
        el: compactTile(glyph(ICON.audio, ACCENT.cyan), h('div', { class: 'wt-text num', text: '62%' })),
      };
    },
    panel() {
      const apps = [
        { name: 'Spotify', vol: 75, icon: 'S' },
        { name: 'Discord', vol: 90, icon: 'D' },
        { name: 'Google Chrome', vol: 50, icon: 'C' },
      ];
      const rows = apps.map((a) =>
        h(
          'div',
          { class: 'wp-list-row' },
          h('div', { class: 'wp-strong', style: 'width:24px;height:24px;border-radius:12px;background:var(--surface);display:grid;place-items:center;font-size:11px', text: a.icon }),
          h('div', { class: 'grow' },
            h('div', { class: 'wp-strong', text: a.name }),
            h('div', { class: 'hbar', style: 'background:var(--w-track);margin-top:4px' }, h('i', { style: `width:${a.vol}%;background:var(--c-cyan)` }))
          ),
          h('div', { class: 'wp-num num', text: `${a.vol}%` })
        )
      );
      return {
        el: panelShell(
          'Audio Mixer',
          h('div', { class: 'wp-hero-sub', text: 'Default: Headphones (HyperX Cloud II Wireless)' }),
          h('div', { class: 'wp-list' }, ...rows),
          h('div', { class: 'wp-foot', text: 'Click on the dock to open the mixer; mouse wheel adjusts volume directly.' })
        ),
      };
    },
  },
  /* --------------------------------------------------- Device Batteries */
  {
    id: 'battery-devices',
    name: 'Device Batteries',
    category: 'System',
    description: 'Real-time battery status for Bluetooth and 2.4 GHz wireless headphones, mice, and keyboards.',
    icon: ICON.batteryDevices,
    accent: ACCENT.green,
    variants: [
      { id: 'single', name: 'Single' },
      { id: 'multi', name: 'Multiple' },
    ],
    card(i) {
      if (i.variant === 'multi') {
        const devs = [
          { p: 62 },
          { p: 85 },
        ];
        const cells = devs.map((d) => {
          const r = ring(28, 2.8, ACCENT.green, TRACK.green);
          r.set(d.p);
          r.inner.classList.add('num');
          r.inner.textContent = String(d.p);
          return h('div', { style: 'display:flex;align-items:center;gap:4px' }, r.el);
        });
        return {
          el: card('wc-rings', ...cells),
        };
      }
      const r = ring(32, 3.2, ACCENT.green, TRACK.green);
      r.set(62);
      r.inner.classList.add('num');
      r.inner.textContent = '62';
      return {
        el: card(
          'wc-battery-single',
          r.el,
          h('div', { class: 'wc-stack' },
            h('div', { class: 'wc-title', text: 'Cloud II Wireless' }),
            h('div', { class: 'wc-sub num', text: '62%' })
          )
        ),
      };
    },
    compact() {
      const r = ring(26, 2.6, ACCENT.green, TRACK.green);
      r.set(62);
      r.inner.classList.add('num');
      r.inner.textContent = '62';
      return {
        el: compactTile(r.el, h('div', { class: 'wt-text', text: 'Headphones' })),
      };
    },
    panel() {
      const devs = [
        { name: 'HyperX Cloud II Wireless', p: 62, type: '2.4 GHz Headphones' },
        { name: 'Logitech G PRO X Superlight', p: 85, type: 'Wireless Mouse' },
      ];
      const rows = devs.map((d) => {
        const r = ring(34, 3.4, ACCENT.green, TRACK.green);
        r.set(d.p);
        r.inner.classList.add('num');
        r.inner.textContent = String(d.p);
        return h(
          'div',
          { class: 'wp-list-row' },
          r.el,
          h('div', { class: 'grow' },
            h('div', { class: 'wp-strong', text: d.name }),
            h('div', { class: 'wp-muted', text: d.type })
          ),
          h('div', { class: 'wp-num num', text: `${d.p}%` })
        );
      });
      return {
        el: panelShell('Connected Device Batteries', h('div', { class: 'wp-list' }, ...rows)),
      };
    },
  },
  /* --------------------------------------------------- Recycle Bin */
  {
    id: 'recycle-bin',
    name: 'Recycle Bin',
    category: 'System',
    description: 'macOS-style trash can. Drag-and-drop file deletion, fullness indicator, and right-click to empty.',
    icon: ICON.recycleBin,
    accent: ACCENT.blue,
    variants: [
      { id: 'icon', name: 'Icon' },
      { id: 'details', name: 'Detailed' },
    ],
    card(i) {
      if (i.variant === 'details') {
        return {
          el: card(
            'wc-recycle-bin',
            glyph(ICON.recycleBin, ACCENT.blue),
            h('div', { class: 'wc-stack' },
              h('div', { class: 'wc-title', text: 'Recycle Bin' }),
              h('div', { class: 'wc-sub num', text: '3 items · 142 MB' })
            )
          ),
        };
      }
      return {
        el: card(
          'wc-square',
          glyph(ICON.recycleBin, ACCENT.blue)
        ),
      };
    },
    compact() {
      return {
        el: compactTile(glyph(ICON.recycleBin, ACCENT.blue), h('div', { class: 'wt-text', text: 'Trash' })),
      };
    },
    panel() {
      return {
        el: panelShell(
          'Recycle Bin',
          h('div', { class: 'wp-hero-sub', text: '3 items · 142 MB' }),
          h('div', { class: 'wp-foot', text: 'Drag and drop files onto the dock icon to delete them.' })
        ),
      };
    },
  },
  /* --------------------------------------------------------------- GPU */
  {
    id: 'gpu',
    name: 'GPU',
    category: 'System',
    description: 'Graphics card load and video memory, from the same counters Task Manager uses.',
    icon: ICON.gpu,
    accent: ACCENT.green,
    variants: [
      { id: 'rings', name: 'Rings' },
      { id: 'numbers', name: 'Numbers' },
      { id: 'bars', name: 'Bars' },
    ],
    card(i) {
      const total = 8;
      const rows = [
        { label: 'GPU', value: () => sim.gpu.value, text: () => `${Math.round(sim.gpu.value)}%`, short: () => String(Math.round(sim.gpu.value)), color: ACCENT.green, track: TRACK.green },
        { label: 'VRAM', value: () => (sim.vram.value / total) * 100, text: () => `${fmt1(sim.vram.value)} GB`, short: () => fmt1(sim.vram.value), color: ACCENT.purple, track: TRACK.blue },
      ];
      if (i.variant === 'rings') {
        const rs = rows.map((r) => {
          const g = ring(32, 3.2, r.color, r.track);
          g.inner.classList.add('num');
          return { r, g, el: h('div', { class: 'wc-ringcell' }, g.el, h('div', { class: 'wc-cap', text: r.label })) };
        });
        return {
          el: card('wc-rings', ...rs.map((x) => x.el)),
          frame: () =>
            rs.forEach(({ r, g }) => {
              g.set(r.value());
              g.inner.textContent = r.short();
            }),
        };
      }
      if (i.variant === 'bars') {
        const bs = rows.map((r) => {
          const fill = h('i', { style: `background:${r.color}` });
          const v = h('span', { class: 'num' });
          return { r, fill, v, el: h('div', { class: 'wc-barrow' }, h('span', { class: 'wc-cap', text: r.label }), h('div', { class: 'hbar', style: `background:${r.track}` }, fill), v) };
        });
        return {
          el: card('wc-stack wc-bars', ...bs.map((x) => x.el)),
          frame: () =>
            bs.forEach(({ r, fill, v }) => {
              fill.style.transform = `scaleX(${r.value() / 100})`;
              v.textContent = r.text();
            }),
        };
      }
      const ns = rows.map((r) => {
        const v = h('span', { class: 'num' });
        return { r, v, el: h('div', { class: 'wc-numrow' }, h('span', { class: 'wc-cap', style: `color:${r.color}`, text: r.label }), v) };
      });
      return {
        el: card('wc-stack wc-numbers', ...ns.map((x) => x.el)),
        frame: () => ns.forEach(({ r, v }) => (v.textContent = r.text())),
      };
    },
    compact() {
      const r = ring(26, 2.6, ACCENT.green, TRACK.green);
      return {
        el: compactTile(r.el, h('div', { class: 'wt-text', text: 'GPU' })),
        frame: () => {
          r.set(sim.gpu.value);
          r.inner.textContent = String(Math.round(sim.gpu.value));
        },
      };
    },
    panel() {
      const load = h('span', { class: 'wp-hero num' });
      const mem = h('span', { class: 'wp-hero num' });
      return {
        el: panelShell(
          'GPU',
          h('div', { class: 'wp-duo' }, h('div', {}, h('div', { class: 'wp-label', style: `color:${ACCENT.green}`, text: 'Load' }), load), h('div', {}, h('div', { class: 'wp-label', style: `color:${ACCENT.purple}`, text: 'Video memory' }), mem)),
          h('div', { class: 'wp-muted', text: 'Sample graphics card · 8 GB' }),
          h('div', { class: 'wp-foot', text: 'The busiest engine (3D, video, copy) counts as the load, like in Task Manager.' }),
        ),
        frame: () => {
          load.textContent = `${Math.round(sim.gpu.value)}%`;
          mem.textContent = `${fmt1(sim.vram.value)} GB`;
        },
      };
    },
  },
  /* -------------------------------------------------------- Brightness */
  {
    id: 'display',
    name: 'Brightness',
    category: 'System',
    description: 'Scroll to change the brightness of laptop screens and DDC/CI monitors, and see when night light is on.',
    icon: ICON.sun,
    accent: ACCENT.yellow,
    variants: [
      { id: 'slider', name: 'Slider' },
      { id: 'icon', name: 'Icon only' },
    ],
    card(i, env) {
      const fill = h('i', { style: `background:${ACCENT.yellow}` });
      const v = h('span', { class: 'num' });
      const moon = h('span', { class: 'ic-sm br-moon', html: icons.moon });
      const el =
        i.variant === 'icon'
          ? card('wc-square wc-bright', glyph(ICON.sun, ACCENT.yellow), v)
          : card('wc-bright', glyph(ICON.sun, ACCENT.yellow), h('div', { class: 'hbar', style: `background:${TRACK.orange}` }, fill), v, moon);
      el.addEventListener(
        'wheel',
        (e) => {
          e.preventDefault();
          display.level = Math.max(0, Math.min(100, display.level + (e.deltaY < 0 ? 5 : -5)));
          env.refreshAll();
        },
        { passive: false },
      );
      el.title = 'Scroll to change, click for more';
      return {
        el,
        refresh: () => {
          fill.style.transform = `scaleX(${display.level / 100})`;
          v.textContent = i.variant === 'icon' ? String(display.level) : `${display.level}%`;
          moon.hidden = !display.night;
        },
      };
    },
    compact() {
      const r = ring(26, 2.6, ACCENT.yellow, TRACK.orange);
      return {
        el: compactTile(r.el),
        refresh: () => {
          r.set(display.level);
          r.inner.textContent = String(display.level);
        },
      };
    },
    panel(_i, env) {
      const value = h('span', { class: 'wp-strong num' });
      const slider = h('input', { type: 'range', min: '0', max: '100', 'aria-label': 'Brightness' }) as HTMLInputElement;
      slider.addEventListener('input', () => {
        display.level = +slider.value;
        env.refreshAll();
      });
      const night = h('button', {
        class: 'wp-chip',
        type: 'button',
        onclick: () => {
          display.night = !display.night;
          env.refreshAll();
        },
      });
      return {
        el: panelShell('Brightness', h('div', { class: 'wp-row br-row' }, h('span', { class: 'ic-sm', html: icons.sun }), slider, value), h('div', { class: 'wp-chips' }, night), h('div', { class: 'wp-foot', text: 'External monitors need DDC/CI turned on in their own menu.' })),
        refresh: () => {
          slider.value = String(display.level);
          value.textContent = `${display.level}%`;
          night.textContent = display.night ? 'Night light: on' : 'Night light: off';
          night.classList.toggle('on', display.night);
        },
      };
    },
  },
  /* ----------------------------------------------- Wi-Fi and Bluetooth */
  {
    id: 'radios',
    name: 'Wi-Fi & Bluetooth',
    category: 'System',
    description: 'Turn Wi-Fi and Bluetooth on or off in one click, like Quick Settings.',
    icon: ICON.radios,
    accent: ACCENT.blue,
    variants: [
      { id: 'buttons', name: 'Buttons' },
      { id: 'icons', name: 'Icon only' },
    ],
    card(i, env) {
      const make = (key: 'wifi' | 'bt', path: string, name: string) => {
        const b = iconBtn(path, name, () => {
          radios[key] = !radios[key];
          env.refreshAll();
        });
        const label = h('span', { class: 'wc-sub' });
        return { key, b, label, name, el: i.variant === 'icons' ? b : h('div', { class: 'radio-cell' }, b, h('div', { class: 'wc-stack' }, h('div', { class: 'wc-title', text: name }), label)) };
      };
      const items = [make('wifi', ICON.radios, 'Wi-Fi'), make('bt', ICON.bluetooth, 'Bluetooth')];
      return {
        el: card('wc-radios', ...items.map((x) => x.el)),
        refresh: () =>
          items.forEach(({ key, b, label, name }) => {
            b.classList.toggle('rd-on', radios[key]);
            b.setAttribute('aria-pressed', String(radios[key]));
            b.title = `${name}: ${radios[key] ? 'On' : 'Off'}`;
            label.textContent = radios[key] ? 'On' : 'Off';
          }),
      };
    },
    compact() {
      const t = h('div', { class: 'wt-text' });
      return { el: compactTile(glyph(ICON.radios, ACCENT.blue), t), refresh: () => (t.textContent = radios.bt ? 'BT' : '') };
    },
    panel(_i, env) {
      const chip = (key: 'wifi' | 'bt', name: string) =>
        h('button', {
          class: 'wp-chip',
          type: 'button',
          onclick: () => {
            radios[key] = !radios[key];
            env.refreshAll();
          },
        });
      const wifi = chip('wifi', 'Wi-Fi');
      const bt = chip('bt', 'Bluetooth');
      return {
        el: panelShell('Wi-Fi & Bluetooth', h('div', { class: 'wp-chips' }, wifi, bt), h('div', { class: 'wp-foot', text: 'Uses the Windows radio API. If Windows says no, the buttons open the matching Settings page.' })),
        refresh: () => {
          wifi.textContent = `Wi-Fi: ${radios.wifi ? 'on' : 'off'}`;
          bt.textContent = `Bluetooth: ${radios.bt ? 'on' : 'off'}`;
          wifi.classList.toggle('on', radios.wifi);
          bt.classList.toggle('on', radios.bt);
        },
      };
    },
  },
  /* --------------------------------------------------- AI Usage */
  {
    id: 'ai-usage',
    name: 'AI Usage',
    category: 'AI',
    description: 'Limits of your AI coding assistant: Claude Code or OpenAI Codex (5-hour and weekly), or Gemini CLI requests today.',
    icon: ICON.ai,
    accent: ACCENT.orange,
    variants: [
      { id: 'rings', name: 'Rings' },
      { id: 'numbers', name: 'Numbers' },
      { id: 'bars', name: 'Bars' },
    ],
    init() {
      return { hour: 34, week: 58, provider: 'Claude Code' };
    },
    card(i) {
      const metrics = [
        { key: 'hour' as const, label: '5-hour' },
        { key: 'week' as const, label: 'Weekly' },
      ];
      if (i.variant === 'bars') {
        const bs = metrics.map((m) => {
          const fill = h('i', { style: `background:${ACCENT.orange}` });
          const v = h('span', { class: 'num' });
          return { m, fill, v, el: h('div', { class: 'wc-barrow' }, h('span', { class: 'wc-cap', text: m.label }), h('div', { class: 'hbar', style: `background:${TRACK.orange}` }, fill), v) };
        });
        return {
          el: card('wc-stack wc-bars', ...bs.map((x) => x.el)),
          refresh: () =>
            bs.forEach(({ m, fill, v }) => {
              fill.style.transform = `scaleX(${i.state[m.key] / 100})`;
              v.textContent = `${Math.round(i.state[m.key])}%`;
            }),
        };
      }
      if (i.variant === 'numbers') {
        const nums = metrics.map((m) => h('div', { class: 'wc-stack' }, h('div', { class: 'wc-title num' }), h('div', { class: 'wc-sub', text: m.label })));
        return {
          el: card('wc-ai-numbers', glyph(ICON.ai, ACCENT.orange), ...nums),
          refresh: () => nums.forEach((n, idx) => (n.firstElementChild!.textContent = `${Math.round(i.state[metrics[idx].key])}%`)),
        };
      }
      const rings = metrics.map((m) => {
        const g = ring(26, 3, ACCENT.orange, TRACK.orange);
        g.inner.classList.add('num');
        const cap = h('div', { class: 'wc-cap', text: m.label });
        return { m, g, cap, el: h('div', { class: 'wc-ringcell' }, g.el, cap) };
      });
      return {
        el: card('wc-rings wc-ai', ...rings.map((r) => r.el)),
        refresh: () =>
          rings.forEach(({ m, g }) => {
            g.set(i.state[m.key]);
            g.inner.textContent = String(Math.round(i.state[m.key]));
          }),
      };
    },
    compact(i) {
      const g = ring(26, 2.6, ACCENT.orange, TRACK.orange);
      return {
        el: compactTile(g.el, h('div', { class: 'wt-text', text: '5h' })),
        refresh: () => {
          g.set(i.state.hour);
          g.inner.textContent = String(Math.round(i.state.hour));
        },
      };
    },
    panel(i, env) {
      const metrics = [
        { key: 'hour' as const, label: '5-hour limit', sub: 'Resets a few hours after your first message in the window' },
        { key: 'week' as const, label: 'Weekly limit', sub: 'Resets every 7 days' },
      ];
      const rows = metrics.map((m) => {
        const g = ring(40, 4, ACCENT.orange, TRACK.orange);
        g.inner.classList.add('num');
        const v = h('div', { class: 'wp-num num' });
        return { m, g, v, el: h('div', { class: 'wp-list-row' }, g.el, h('div', { class: 'grow' }, h('div', { class: 'wp-strong', text: m.label }), h('div', { class: 'wp-muted', text: m.sub })), v) };
      });
      const providers: Record<string, { hour: number; week: number; note: string }> = {
        'Claude Code': { hour: 34, week: 58, note: "Reads Claude Code's own usage via 'claude -p /usage'." },
        Codex: { hour: 12, week: 41, note: 'Read from the session logs the Codex CLI keeps in ~/.codex. No extra process.' },
        'Gemini CLI': { hour: 23, week: 23, note: 'Requests today against your daily limit, read from ~/.gemini. No extra process.' },
      };
      const note = h('span', { class: 'wp-muted' });
      const chips = Object.keys(providers).map((name) =>
        h('button', {
          class: 'wp-chip',
          type: 'button',
          text: name,
          onclick: () => {
            i.state.provider = name;
            i.state.hour = providers[name].hour;
            i.state.week = providers[name].week;
            env.refreshAll();
          },
        }),
      );
      const refreshBtn = h('button', {
        class: 'wp-chip',
        text: 'Refresh now',
        onclick: () => {
          i.state.hour = Math.min(100, Math.round(i.state.hour + 6 + Math.random() * 10));
          i.state.week = Math.min(100, Math.round(i.state.week + 2 + Math.random() * 6));
          env.refreshAll();
        },
      });
      return {
        el: panelShell('AI Usage', h('div', { class: 'wp-chips' }, ...chips), h('div', { class: 'wp-list' }, ...rows.map((r) => r.el)), h('div', { class: 'wp-note-row' }, note, refreshBtn)),
        refresh: () => {
          const gemini = i.state.provider === 'Gemini CLI';
          chips.forEach((c) => c.classList.toggle('on', c.textContent === i.state.provider));
          note.textContent = providers[i.state.provider]?.note ?? '';
          rows.forEach(({ m, g, v, el }, idx) => {
            el.hidden = gemini && idx === 1;
            (el.querySelector('.wp-strong') as HTMLElement).textContent = gemini ? 'Requests today' : m.label;
            (el.querySelector('.wp-muted') as HTMLElement).textContent = gemini ? '230 of 1,000 requests' : m.sub;
            g.set(i.state[m.key]);
            g.inner.textContent = String(Math.round(i.state[m.key]));
            v.textContent = `${Math.round(i.state[m.key])}%`;
          });
        },
      };
    },
  },
];

export const widgetById = Object.fromEntries(widgets.map((w) => [w.id, w])) as Record<string, WidgetDef>;

function dayPct(d: Date) {
  return ((d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400) * 100;
}

function periodPct(d: Date, name: string) {
  if (name === 'Day' || name === 'Gün') return dayPct(d);
  if (name === 'Week' || name === 'Hafta') return ((((d.getDay() + 6) % 7) + dayPct(d) / 100) / 7) * 100;
  if (name === 'Month' || name === 'Ay') {
    const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return ((d.getDate() - 1 + dayPct(d) / 100) / days) * 100;
  }
  const start = new Date(d.getFullYear(), 0, 1).getTime();
  const end = new Date(d.getFullYear() + 1, 0, 1).getTime();
  return ((d.getTime() - start) / (end - start)) * 100;
}

function focusStep(i: Instance, dt: number, env: Env) {
  const st = i.state;
  if (!st.running) return;
  st.left -= dt;
  if (st.left <= 0) {
    const toBreak = st.phase === 'Focus' || st.phase === 'Odak';
    st.phase = toBreak ? 'Break' : 'Focus';
    st.total = toBreak ? 5 * 60 : 25 * 60;
    st.left = st.total;
    st.running = false;
    env.toast?.(toBreak ? 'Focus session ended' : 'Break ended', toBreak ? 'Time for a 5-minute break.' : 'Ready for a new focus sprint.');
    env.refreshAll();
  }
}

function countdownStep(i: Instance, dt: number, env: Env) {
  const st = i.state;
  if (!st.running) return;
  st.left -= dt;
  if (st.left <= 0) {
    st.left = 0;
    st.running = false;
    env.toast?.('Countdown finished', `${st.label} is ready.`);
    env.refreshAll();
  }
}

const live = new Map<Instance, Env>();
export const track = (i: Instance, env: Env) => live.set(i, env);
export const untrack = (i: Instance) => live.delete(i);

onFrame((dt) =>
  live.forEach((env, i) => {
    if (i.id === 'focus') focusStep(i, dt, env);
    else if (i.id === 'countdown') countdownStep(i, dt, env);
    else if (i.id === 'stopwatch' && i.state.running) i.state.elapsed += dt;
  }),
);

let uidSeq = 0;
export function makeInstance(id: string, variant?: string): Instance {
  const def = widgetById[id];
  return { uid: `w${++uidSeq}`, id, variant: variant ?? def.variants[0].id, state: def.init?.() ?? {} };
}
