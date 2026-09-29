import { h, widgets, widgetById, makeInstance, track, untrack, albumArt, type Instance, type View, type Env, type Category } from './widgets';
import { mount, unmount, refreshAll } from './views';
import { icons, windowsLogo, dockLogo } from '../lib/icons';
import { appIcons, appNames, type AppId } from '../lib/apps';
import { onSecond, setVisible, pad, sim, tracks } from './sim';

type Edge = 'bottom' | 'top' | 'left' | 'right';
type GroupChild = { key: string; kind: 'app'; app: AppId } | { key: string; kind: 'widget'; inst: Instance };
type Item =
  | { key: string; kind: 'app'; app: AppId }
  | { key: string; kind: 'sep' }
  | { key: string; kind: 'widget'; inst: Instance }
  | { key: string; kind: 'group'; name: string; accent: string; children: GroupChild[] };

const GROUP_ACCENTS = ['var(--c-blue)', 'var(--c-green)', 'var(--c-orange)', 'var(--c-pink)', 'var(--c-purple)', 'var(--c-cyan)'];

function childName(c: GroupChild): string {
  return c.kind === 'app' ? appNames[c.app] : widgetById[c.inst.id].name;
}
function childAccent(c: GroupChild): string {
  return c.kind === 'app' ? 'var(--c-blue)' : widgetById[c.inst.id].accent;
}
function childGlyphHtml(c: GroupChild): string {
  if (c.kind === 'app') return `<span class="grp-mini-app">${appIcons[c.app]}</span>`;
  const def = widgetById[c.inst.id];
  return `<svg viewBox="0 0 24 24" fill="none" stroke="${def.accent}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${def.icon}"/></svg>`;
}

type Entry =
  | 'sep'
  | { head: string }
  | { label: string; icon?: keyof typeof icons; run?: () => void; checked?: boolean; danger?: boolean; sub?: Entry[] };

type WinKey = AppId | 'dock-settings';

const PRIMARY_ON_CARD = new Set(['hydration', 'stopwatch']);
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('static');

let keySeq = 0;
const nextKey = () => `k${++keySeq}`;

export function initDemo() {
  const stage = document.querySelector<HTMLElement>('[data-stage]');
  if (!stage || stage.dataset.ready) return;
  stage.dataset.ready = '1';

  const $ = <T extends HTMLElement>(sel: string) => stage.querySelector<T>(sel)!;
  const dock = $('[data-dock]');
  const itemsEl = $('[data-dock-items]');
  const scroller = $('[data-dock-scroll]');
  const center = dock.querySelector<HTMLElement>('.dock-center')!;
  const layer = $('[data-layer]');
  const toasts = $('[data-toasts]');
  const winLayer = $('[data-windows]');
  const bar = document.querySelector<HTMLElement>('[data-demo-bar]');

  const state = {
    edge: 'bottom' as Edge,
    layout: 'floating',
    theme: 'dark',
    size: stage.dataset.size || 'small',
    mode: 'replace',
    backdrop: 'blur',
    autohide: false,
    fullscreenHide: true,
  };

  const env: Env = { refreshAll, toast: (t, b) => toast(t, b) };

  const w = (id: string, variant?: string): Item => {
    const inst = makeInstance(id, variant);
    track(inst, env);
    return { key: nextKey(), kind: 'widget', inst };
  };
  const app = (id: AppId): Item => ({ key: nextKey(), kind: 'app', app: id });

  const apps = () => [app('explorer'), app('browser'), app('terminal'), app('notepad')];
  const sep = (): Item => ({ key: nextKey(), kind: 'sep' });
  const wc = (id: string, variant?: string): GroupChild => w(id, variant) as GroupChild;
  const group = (name: string, accent: string, children: GroupChild[]): Item => ({ key: nextKey(), kind: 'group', name, accent, children });
  let items: Item[] =
    stage.offsetWidth < 600
      ? [w('clock', 'analog'), w('weather', 'current'), w('system', 'rings'), w('hydration', 'timer'), w('media', 'compact'), sep(), ...apps(), group('Extras', GROUP_ACCENTS[2], [wc('ai-usage', 'rings'), wc('recycle-bin', 'icon')])]
      : [
          ...apps(),
          sep(),
          w('clock', 'analog'),
          w('media', 'full'),
          w('weather', 'current'),
          w('system', 'rings'),
          w('calendar', 'next'),
          w('hydration', 'timer'),
          group('Extras', GROUP_ACCENTS[2], [wc('clipboard'), wc('stack', 'fan'), wc('currency', 'trend'), wc('notes'), wc('ai-usage', 'rings'), wc('recycle-bin', 'icon')]),
        ];

  const shell = stage.closest<HTMLElement>('[data-stage-shell]');
  const syncEngaged = () => {
    const engaged = !!fly || [...wins.values()].some((x) => !x.min);
    shell?.classList.toggle('is-engaged', engaged);
  };

  const vertical = () => state.edge === 'left' || state.edge === 'right';

  /* ------------------------------------------------------------ items */

  interface Rec {
    el: HTMLElement;
    btn: HTMLElement;
    view?: View;
    mode?: 'card' | 'compact';
  }
  const recs = new Map<string, Rec>();

  function buildWidget(rec: Rec, it: Extract<Item, { kind: 'widget' }>, mode: 'card' | 'compact') {
    unmount(rec.view);
    const def = widgetById[it.inst.id];
    const view = mode === 'card' ? def.card(it.inst, env) : def.compact(it.inst, env);
    rec.btn.replaceChildren(view.el);
    rec.view = mount(view);
    rec.mode = mode;
  }

  function createRec(it: Item): Rec {
    if (it.kind === 'sep') {
      const el = h('div', { class: 'dock-item dock-sep', role: 'separator', 'data-key': it.key });
      return { el, btn: el };
    }
    if (it.kind === 'app') {
      const btn = h(
        'button',
        { class: 'db app-btn', type: 'button', 'aria-label': appNames[it.app], title: appNames[it.app], 'data-app': it.app },
        h('span', { class: 'app-ico', html: appIcons[it.app] }),
      );
      btn.addEventListener('click', () => toggleApp(it.app, btn));
      btn.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && previewHover(it.app, btn, true));
      btn.addEventListener('pointerleave', () => previewHover(it.app, btn, false));
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        hidePreview(true);
        appMenu(it, e);
      });
      return { el: h('div', { class: 'dock-item', 'data-key': it.key }, btn), btn };
    }
    if (it.kind === 'group') {
      const btn = h('button', {
        class: 'db group-btn',
        type: 'button',
        'aria-label': `${it.name} folder, ${it.children.length} items`,
        style: `--group-accent:${it.accent}`,
      });
      renderGroupTile(btn, it);
      btn.addEventListener('click', () => toggleGroupFan(it, btn));
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        groupMenu(it, btn, e);
      });
      return { el: h('div', { class: 'dock-item', 'data-key': it.key }, btn), btn };
    }
    const def = widgetById[it.inst.id];
    const btn = h('div', { class: 'widget-btn', role: 'button', tabindex: '0', 'aria-label': `${def.name} widget`, 'data-widget': def.id });
    const rec: Rec = { el: h('div', { class: 'dock-item', 'data-key': it.key }, btn), btn };
    const activate = () => {
      const compact = rec.mode === 'compact';
      if (def.primary && (compact || PRIMARY_ON_CARD.has(def.id))) def.primary(it.inst, env);
      else openWidgetPanel(it, btn);
    };
    btn.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.mc-btn')) return;
      activate();
    });
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activate();
      }
    });
    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      widgetMenu(it, btn, e);
    });
    return rec;
  }

  function render(newKey?: string) {
    const mode = vertical() ? 'compact' : 'card';
    const nodes: HTMLElement[] = [];
    items.forEach((it, idx) => {
      let rec = recs.get(it.key);
      if (!rec) {
        rec = createRec(it);
        recs.set(it.key, rec);
      }
      if (it.kind === 'widget' && rec.mode !== mode) buildWidget(rec, it, mode);
      rec.el.style.setProperty('--i', String(idx + 2));
      rec.el.classList.toggle('is-new', it.key === newKey);
      nodes.push(rec.el);
    });
    recs.forEach((rec, key) => {
      if (!items.some((i) => i.key === key)) {
        unmount(rec.view);
        rec.el.remove();
        recs.delete(key);
      }
    });
    itemsEl.replaceChildren(...nodes);
    updateRunning();
    requestAnimationFrame(updateFades);
  }

  function removeItem(key: string) {
    const rec = recs.get(key);
    const index = items.findIndex((i) => i.key === key);
    const it = items[index];
    if (it?.kind === 'widget') untrack(it.inst);
    const done = () => {
      items = items.filter((i) => i.key !== key);
      render();
      if (it && it.kind !== 'sep') offerUndo(it, index);
    };
    if (!rec || reduced()) return done();
    rec.el.classList.add('is-leaving');
    setTimeout(done, 220);
  }

  /** Like the app's undo toast: removed items come back in place, widget data included. */
  function offerUndo(it: Item, index: number) {
    const name = it.kind === 'app' ? appNames[it.app] : it.kind === 'group' ? `${it.name} folder` : it.kind === 'widget' ? widgetById[it.inst.id].name : 'Item';
    toast(`${name} removed`, it.kind === 'widget' || it.kind === 'group' ? 'Its settings and data are kept for 7 days.' : 'You can pin it again at any time.', {
      actions: [
        {
          label: 'Undo',
          accent: true,
          run: () => {
            if (items.some((x) => x.key === it.key)) return;
            if (it.kind === 'widget') track(it.inst, env);
            if (it.kind === 'group') it.children.forEach((c) => c.kind === 'widget' && track(c.inst, env));
            items.splice(Math.min(index, items.length), 0, it);
            render(it.key);
            setTimeout(() => recs.get(it.key)?.el.classList.remove('is-new'), 700);
          },
        },
      ],
      timeout: 8000,
    });
  }

  function insertIndex() {
    return items.length;
  }

  function addWidget(id: string, variant?: string) {
    const it = w(id, variant);
    items.splice(insertIndex(), 0, it);
    render(it.key);
    const rec = recs.get(it.key)!;
    requestAnimationFrame(() => rec.el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'nearest', inline: 'nearest' }));
    setTimeout(() => rec.el.classList.remove('is-new'), 700);
    if (stage!.dataset.phase === 'exited') startDock();
    return it;
  }

  function pinApp(id: AppId) {
    if (items.some((i) => i.kind === 'app' && i.app === id)) {
      toast('Already pinned', `${appNames[id]} is already on the dock.`);
      return;
    }
    const lastApp = items.map((i) => i.kind).lastIndexOf('app');
    const it = app(id);
    items.splice(lastApp + 1, 0, it);
    render(it.key);
    setTimeout(() => recs.get(it.key)?.el.classList.remove('is-new'), 700);
    toast('Pinned to DockHub', `${appNames[id]} added to pinned apps.`);
  }

  /* ----------------------------------------------------------- fades */

  function updateFades() {
    const v = vertical();
    const pos = v ? scroller.scrollTop : scroller.scrollLeft;
    const max = v ? scroller.scrollHeight - scroller.clientHeight : scroller.scrollWidth - scroller.clientWidth;
    center.classList.toggle('fade-start', pos > 2);
    center.classList.toggle('fade-end', pos < max - 2);
  }
  scroller.addEventListener('scroll', updateFades, { passive: true });
  new ResizeObserver(updateFades).observe(scroller);
  new ResizeObserver(updateFades).observe(itemsEl);
  center.querySelectorAll<HTMLElement>('[data-scroll]').forEach((b) =>
    b.addEventListener('click', () => {
      const dir = Number(b.dataset.scroll);
      const amount = (vertical() ? scroller.clientHeight : scroller.clientWidth) * 0.6 * dir;
      scroller.scrollBy(vertical() ? { top: amount } : { left: amount });
    }),
  );
  scroller.addEventListener(
    'wheel',
    (e) => {
      if (vertical()) return;
      const max = scroller.scrollWidth - scroller.clientWidth;
      if (max <= 0 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      scroller.scrollBy({ left: e.deltaY });
    },
    { passive: false },
  );

  /* ------------------------------------------------------------ drag */

  let suppressClick = false;
  itemsEl.addEventListener(
    'click',
    (e) => {
      if (suppressClick) {
        e.stopPropagation();
        e.preventDefault();
        suppressClick = false;
      }
    },
    true,
  );

  itemsEl.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    const dragEl = target.closest<HTMLElement>('.dock-item');
    if (!dragEl || target.closest('.mc-btn')) return;
    const axisX = !vertical();
    const pos = (el: HTMLElement) => (axisX ? el.offsetLeft + el.offsetWidth / 2 : el.offsetTop + el.offsetHeight / 2);
    const pointer = (ev: PointerEvent) => (axisX ? ev.clientX : ev.clientY);
    const scrollPos = () => (axisX ? scroller.scrollLeft : scroller.scrollTop);
    const start = pointer(e);
    const startScroll = scrollPos();
    let startCenter = 0;
    let dragging = false;
    let longPress = 0;
    const touch = e.pointerType !== 'mouse';
    const pointerId = e.pointerId;
    let mergeTarget: HTMLElement | null = null;
    const clearMergeTarget = () => {
      mergeTarget?.classList.remove('is-group-target');
      mergeTarget = null;
    };

    const begin = () => {
      dragging = true;
      startCenter = pos(dragEl);
      dragEl.classList.add('is-dragging');
      closeFlyout();
      try {
        itemsEl.setPointerCapture(pointerId);
      } catch {
        /* pointer may be gone */
      }
      if (touch && navigator.vibrate) navigator.vibrate(8);
    };
    if (touch) longPress = window.setTimeout(begin, 380);

    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const delta = pointer(ev) - start;
      if (!dragging) {
        if (touch) {
          if (Math.abs(delta) > 8) cleanup();
          return;
        }
        if (Math.abs(delta) < 6) return;
        begin();
      }
      ev.preventDefault();
      const canGroup = !dragEl.classList.contains('dock-sep');
      let candidate: HTMLElement | null = null;
      let overTarget: HTMLElement | null = null;
      if (canGroup) {
        const prevPointerEvents = dragEl.style.pointerEvents;
        dragEl.style.pointerEvents = 'none';
        const stack = document.elementsFromPoint(ev.clientX, ev.clientY) as HTMLElement[];
        dragEl.style.pointerEvents = prevPointerEvents;
        const cand = stack.map((el) => el.closest<HTMLElement>('.dock-item')).find((el) => el && itemsEl.contains(el)) ?? null;
        if (cand && cand !== dragEl && !cand.classList.contains('dock-sep')) {
          candidate = cand;
          const r = cand.getBoundingClientRect();
          const pad = axisX ? r.width * 0.28 : r.height * 0.28;
          const inner = axisX ? ev.clientX > r.left + pad && ev.clientX < r.right - pad : ev.clientY > r.top + pad && ev.clientY < r.bottom - pad;
          if (inner) overTarget = cand;
        }
      }
      if (overTarget !== mergeTarget) {
        clearMergeTarget();
        mergeTarget = overTarget;
        mergeTarget?.classList.add('is-group-target');
      }
      const desired = startCenter + delta + (scrollPos() - startScroll);
      // Reordering is paused while hovering anywhere over another item (not just the
      // inner merge zone) so the DOM doesn't shuffle out from under a merge attempt.
      if (!mergeTarget && !candidate) {
        const kids = [...itemsEl.children] as HTMLElement[];
        const others = kids.filter((k) => k !== dragEl);
        let idx = others.findIndex((k) => pos(k) > desired);
        if (idx < 0) idx = others.length;
        if (kids.indexOf(dragEl) !== idx) {
          const before = new Map(others.map((k) => [k, pos(k)]));
          itemsEl.insertBefore(dragEl, others[idx] ?? null);
          others.forEach((k) => {
            const d = before.get(k)! - pos(k);
            if (d) k.animate([{ transform: axisX ? `translateX(${d}px)` : `translateY(${d}px)` }, { transform: 'none' }], { duration: 220, easing: 'cubic-bezier(0.1,0.9,0.2,1)' });
          });
        }
      }
      const off = desired - pos(dragEl);
      dragEl.style.transform = axisX ? `translateX(${off}px)` : `translateY(${off}px)`;
    };

    const cleanup = () => {
      clearTimeout(longPress);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };

    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      cleanup();
      if (!dragging) return;
      suppressClick = true;
      setTimeout(() => (suppressClick = false), 50);
      const t = dragEl.style.transform;
      dragEl.style.transform = '';
      dragEl.classList.remove('is-dragging');
      const dropTarget = mergeTarget;
      clearMergeTarget();
      if (dropTarget) {
        mergeIntoGroup(dropTarget.dataset.key!, dragEl.dataset.key!);
        evalHide();
        return;
      }
      if (t) dragEl.animate([{ transform: t }, { transform: 'none' }], { duration: 250, easing: 'cubic-bezier(0.1,0.9,0.2,1)' });
      const order = [...itemsEl.children].map((k) => (k as HTMLElement).dataset.key);
      items = order.map((k) => items.find((i) => i.key === k)!).filter(Boolean);
      items.forEach((it, i) => recs.get(it.key)?.el.style.setProperty('--i', String(i + 2)));
      evalHide();
    };

    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  });

  /* --------------------------------------------------------- flyouts */

  interface Fly {
    el: HTMLElement;
    kind: string;
    anchor: HTMLElement | null;
    views: View[];
    onClose?: () => void;
  }
  let fly: Fly | null = null;
  let sub: HTMLElement | null = null;

  function stageScale() {
    const r = stage!.getBoundingClientRect();
    return { r, s: r.width / stage!.offsetWidth || 1 };
  }

  function place(el: HTMLElement, anchor: HTMLElement | null, point?: { x: number; y: number }, side?: Edge) {
    const { r, s } = stageScale();
    const sw = stage!.offsetWidth;
    const sh = stage!.offsetHeight;
    const fw = el.offsetWidth;
    const fh = el.offsetHeight;
    const gap = 10;
    let left: number;
    let top: number;
    let origin = '50% 100%';
    let fx = '0px';
    let fy = '12px';
    if (point) {
      left = point.x;
      top = point.y;
      if (left + fw > sw - 8) left = Math.max(8, left - fw);
      if (top + fh > sh - 8) top = Math.max(8, top - fh);
      origin = 'top left';
      fy = '-4px';
    } else if (anchor) {
      const a = anchor.getBoundingClientRect();
      const ax = (a.left - r.left) / s;
      const ay = (a.top - r.top) / s;
      const aw = a.width / s;
      const ah = a.height / s;
      const e = side ?? state.edge;
      if (e === 'bottom') {
        left = ax + aw / 2 - fw / 2;
        top = ay - fh - gap;
      } else if (e === 'top') {
        left = ax + aw / 2 - fw / 2;
        top = ay + ah + gap;
        origin = '50% 0%';
        fy = '-12px';
      } else if (e === 'left') {
        left = ax + aw + gap;
        top = ay + ah / 2 - fh / 2;
        origin = '0% 50%';
        fx = '-12px';
        fy = '0px';
      } else {
        left = ax - fw - gap;
        top = ay + ah / 2 - fh / 2;
        origin = '100% 50%';
        fx = '12px';
        fy = '0px';
      }
    } else {
      const d = dock.getBoundingClientRect();
      const dl = (d.left - r.left) / s;
      const dt = (d.top - r.top) / s;
      left = sw / 2 - fw / 2;
      top = sh / 2 - fh / 2;
      if (state.edge === 'bottom') top = dt - fh - 12;
      else if (state.edge === 'top') top = dt + d.height / s + 12;
      else if (state.edge === 'left') left = dl + d.width / s + 12;
      else left = dl - fw - 12;
    }
    left = Math.min(Math.max(10, left), sw - fw - 10);
    top = Math.min(Math.max(10, top), sh - fh - 10);
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.setProperty('--origin', origin);
    el.style.setProperty('--fx', fx);
    el.style.setProperty('--fy', fy);
  }

  function openFlyout(content: HTMLElement, opts: { kind: string; anchor?: HTMLElement | null; views?: View[]; cls?: string; point?: { x: number; y: number }; onClose?: () => void; focus?: string }) {
    const anchor = opts.anchor ?? null;
    if (fly && fly.kind === opts.kind && fly.anchor === anchor && !opts.point) {
      closeFlyout();
      return null;
    }
    closeFlyout(true);
    hidePreview(true);
    const el = h('div', { class: `flyout ${opts.cls ?? ''}`, role: 'dialog' }, content);
    el.style.visibility = 'hidden';
    layer.append(el);
    place(el, anchor, opts.point);
    el.style.visibility = '';
    anchor?.classList.add('is-open');
    fly = { el, kind: opts.kind, anchor, views: opts.views ?? [], onClose: opts.onClose };
    fly.views.forEach(mount);
    const f = opts.focus ? el.querySelector<HTMLElement>(opts.focus) : null;
    if (f) f.focus({ preventScroll: true });
    evalHide();
    syncEngaged();
    return el;
  }

  function closeFlyout(immediate = false) {
    closeSub();
    if (!fly) return;
    const f = fly;
    fly = null;
    f.views.forEach(unmount);
    f.anchor?.classList.remove('is-open');
    f.onClose?.();
    if (immediate || reduced()) f.el.remove();
    else {
      f.el.classList.add('is-closing');
      setTimeout(() => f.el.remove(), 150);
    }
    evalHide();
    syncEngaged();
  }

  function closeSub() {
    sub?.remove();
    sub = null;
    layer.querySelectorAll('.menu-item.is-open').forEach((x) => x.classList.remove('is-open'));
  }

  stage.addEventListener('pointerdown', (e) => {
    const t = e.target as HTMLElement;
    if (!fly) return;
    if (t.closest('.flyout') || (fly.anchor && fly.anchor.contains(t))) return;
    closeFlyout();
  });
  document.addEventListener('pointerdown', (e) => {
    if (fly && !stage!.contains(e.target as Node) && !(e.target as HTMLElement).closest('[data-demo-bar]')) closeFlyout();
  });
  stage.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && fly) {
      const a = fly.anchor;
      closeFlyout();
      a?.focus({ preventScroll: true });
    }
  });

  /* ------------------------------------------------------------ menus */

  function menuEl(entries: Entry[], isSub = false): HTMLElement {
    const m = h('div', { class: 'menu', role: 'menu' });
    for (const en of entries) {
      if (en === 'sep') {
        m.append(h('div', { class: 'menu-sep', role: 'separator' }));
        continue;
      }
      if ('head' in en) {
        m.append(h('div', { class: 'menu-head', text: en.head }));
        continue;
      }
      const b = h(
        'button',
        {
          class: `menu-item ${en.danger ? 'is-danger' : ''}`,
          type: 'button',
          role: en.checked === undefined ? 'menuitem' : 'menuitemradio',
          'aria-checked': en.checked === undefined ? null : String(en.checked),
          'aria-haspopup': en.sub ? 'menu' : null,
        },
        h('span', { class: 'mi-ic', html: en.icon ? icons[en.icon] : '' }),
        h('span', { class: 'mi-label', text: en.label }),
        en.sub ? h('span', { class: 'mi-end', html: icons.chevronRight }) : null,
      );
      if (en.sub) {
        const openSub = () => {
          if (b.classList.contains('is-open')) return;
          closeSub();
          b.classList.add('is-open');
          const sm = menuEl(en.sub!, true);
          const wrap = h('div', { class: 'flyout menu-flyout' }, sm);
          wrap.style.visibility = 'hidden';
          layer.append(wrap);
          const { r, s } = stageScale();
          const br = b.getBoundingClientRect();
          let x = (br.right - r.left) / s + 2;
          if (x + wrap.offsetWidth > stage!.offsetWidth - 8) x = (br.left - r.left) / s - wrap.offsetWidth - 2;
          const y = Math.min((br.top - r.top) / s - 4, stage!.offsetHeight - wrap.offsetHeight - 8);
          wrap.style.left = `${Math.max(8, x)}px`;
          wrap.style.top = `${Math.max(8, y)}px`;
          wrap.style.setProperty('--fy', '0px');
          wrap.style.setProperty('--fx', '-6px');
          wrap.style.visibility = '';
          sub = wrap;
        };
        b.addEventListener('pointerenter', openSub);
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          openSub();
          sub?.querySelector<HTMLElement>('.menu-item')?.focus();
        });
        b.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowRight') {
            openSub();
            sub?.querySelector<HTMLElement>('.menu-item')?.focus();
          }
        });
      } else {
        if (!isSub) b.addEventListener('pointerenter', closeSub);
        b.addEventListener('click', () => {
          closeFlyout();
          en.run?.();
        });
      }
      m.append(b);
    }
    m.addEventListener('keydown', (e) => {
      const list = [...m.querySelectorAll<HTMLElement>(':scope > .menu-item')];
      const i = list.indexOf(document.activeElement as HTMLElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const n = (i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length;
        list[n]?.focus();
      } else if (e.key === 'ArrowLeft' && isSub) {
        const opener = layer.querySelector<HTMLElement>('.menu-item.is-open');
        closeSub();
        opener?.focus();
      }
    });
    return m;
  }

  function openMenu(entries: Entry[], e: MouseEvent | null, anchor?: HTMLElement) {
    let point: { x: number; y: number } | undefined;
    if (e && e.clientX) {
      const { r, s } = stageScale();
      point = { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s };
    }
    const el = openFlyout(menuEl(entries), { kind: 'menu', anchor: point ? null : anchor, point, cls: 'menu-flyout' });
    el?.querySelector<HTMLElement>('.menu-item')?.focus({ preventScroll: true });
  }

  function variantsEntry(it: Extract<Item, { kind: 'widget' }>): Entry | null {
    const def = widgetById[it.inst.id];
    if (def.variants.length < 2) return null;
    return {
      label: 'Appearance',
      icon: 'widgets',
      sub: def.variants.map((v) => ({
        label: v.name,
        checked: it.inst.variant === v.id,
        run: () => {
          it.inst.variant = v.id;
          const rec = recs.get(it.key)!;
          rec.mode = undefined;
          render();
          rec.el.classList.add('is-new');
          setTimeout(() => rec.el.classList.remove('is-new'), 600);
        },
      })),
    };
  }

  function widgetMenu(it: Extract<Item, { kind: 'widget' }>, btn: HTMLElement, e: MouseEvent | null) {
    const def = widgetById[it.inst.id];
    const entries: Entry[] = [{ head: def.name }];
    const v = variantsEntry(it);
    if (v) entries.push(v);
    entries.push({ label: 'Widget settings…', icon: 'settings', run: () => openWidgetPanel(it, btn) });
    if (def.id === 'stopwatch')
      entries.push({
        label: 'Reset',
        icon: 'restore',
        run: () => {
          it.inst.state.elapsed = 0;
          it.inst.state.running = false;
          refreshAll();
        },
      });
    entries.push('sep', { label: 'Remove from dock', icon: 'close', danger: true, run: () => removeItem(it.key) });
    openMenu(entries, e, btn);
  }

  function appMenu(it: Extract<Item, { kind: 'app' }>, e: MouseEvent | null) {
    const open = wins.get(it.app);
    const btn = recs.get(it.key)?.btn;
    const entries: Entry[] = [
      { head: appNames[it.app] },
      { label: open ? 'Switch to window' : 'Open', icon: 'external', run: () => openApp(it.app) },
      { label: 'Run as administrator', icon: 'shield', run: () => { openApp(it.app); toast('Run as administrator', `${appNames[it.app]} opened with elevated privileges. DockHub itself does not require admin privileges.`); } },
      { label: 'Open file location', icon: 'pin', run: () => openApp('explorer') },
      'sep',
      { label: 'Remove from DockHub', icon: 'close', run: () => removeItem(it.key) },
    ];
    if (open) entries.push({ label: 'Close all windows', icon: 'close', danger: true, run: () => closeWin(it.app) });
    openMenu(entries, e, btn);
  }

  function dockMenu(e: MouseEvent | null) {
    const pick = <T extends string>(label: string, icon: keyof typeof icons, key: 'edge' | 'size' | 'backdrop', opts: [T, string][]): Entry => ({
      label,
      icon,
      sub: opts.map(([v, l]) => ({ label: l, checked: state[key] === v, run: () => set(key, v) })),
    });
    openMenu(
      [
        { label: 'Add widget', icon: 'widgets', run: () => openGallery() },
        { label: 'Pin app', icon: 'pin', run: () => openApp('explorer') },
        {
          label: 'Add separator',
          icon: 'minus',
          run: () => {
            const it: Item = { key: nextKey(), kind: 'sep' };
            items.push(it);
            render(it.key);
          },
        },
        'sep',
        { label: 'Auto-hide', icon: 'autohide', checked: state.autohide, run: () => set('autohide', !state.autohide) },
        pick('Position', 'monitor', 'edge', [
          ['bottom', 'Bottom'],
          ['top', 'Top'],
          ['left', 'Left'],
          ['right', 'Right'],
        ]),
        pick('Size', 'grip', 'size', [
          ['small', 'Small (48)'],
          ['medium', 'Medium (56)'],
          ['large', 'Large (66)'],
        ]),
        pick('Backdrop', 'sparkle', 'backdrop', [
          ['blur', 'Blurred glass'],
          ['acrylic', 'Acrylic'],
          ['transparent', 'Transparent'],
          ['solid', 'Solid'],
        ]),
        'sep',
        { label: 'Settings', icon: 'settings', run: () => openApp('dock-settings') },
        { label: 'Exit', icon: 'power', danger: true, run: () => exitDock() },
      ],
      e,
    );
  }

  dock.addEventListener('contextmenu', (e) => {
    if ((e.target as HTMLElement).closest('.dock-item, [data-start]')) return;
    e.preventDefault();
    dockMenu(e);
  });

  $('[data-start]').addEventListener('contextmenu', (e) => {
    e.preventDefault();
    openMenu(
      [
        { label: 'Terminal', icon: 'terminal', run: () => openApp('terminal') },
        { label: 'File Explorer', icon: 'monitor', run: () => openApp('explorer') },
        { label: 'Settings', icon: 'settings', run: () => openApp('dock-settings') },
        { label: 'Desktop', icon: 'monitor', run: () => showDesktop() },
        'sep',
        { label: 'Shut down or sign out', icon: 'power', sub: [{ label: 'Sign out', run: () => toast('Signing out', 'DockHub restores the Windows taskbar before signing out.') }] },
      ],
      e,
    );
  });

  /* ------------------------------------------------------ widget panel */

  function openWidgetPanel(it: Extract<Item, { kind: 'widget' }>, anchor: HTMLElement) {
    const def = widgetById[it.inst.id];
    const view = def.panel(it.inst, env);
    openFlyout(view.el, { kind: `w-${it.key}`, anchor, views: [view], cls: def.id === 'notes' ? 'note-fly' : '', focus: def.id === 'notes' ? 'textarea' : undefined });
  }

  /* ------------------------------------------------------------ groups */

  function renderGroupTile(btn: HTMLElement, it: Extract<Item, { kind: 'group' }>) {
    const shown = it.children.slice(0, 4);
    btn.replaceChildren(
      h('span', {
        class: `group-grid group-grid-${Math.min(shown.length, 4) || 1}`,
        html: shown.length ? shown.map((c) => `<span class="group-mini">${childGlyphHtml(c)}</span>`).join('') : '<span class="group-mini group-mini-empty"></span>',
      }),
    );
  }

  function findGroup(key: string) {
    const it = items.find((i) => i.key === key);
    return it && it.kind === 'group' ? it : undefined;
  }

  function mergeIntoGroup(targetKey: string, draggedKey: string) {
    const targetIdx = items.findIndex((i) => i.key === targetKey);
    const draggedIdx = items.findIndex((i) => i.key === draggedKey);
    if (targetIdx < 0 || draggedIdx < 0 || targetKey === draggedKey) return;
    const target = items[targetIdx];
    const dragged = items[draggedIdx];
    if (dragged.kind === 'sep' || dragged.kind === 'group') return;

    unmount(recs.get(draggedKey)?.view);
    recs.get(draggedKey)?.el.remove();
    recs.delete(draggedKey);

    if (target.kind === 'group') {
      items.splice(draggedIdx, 1);
      target.children.push(dragged);
      const rec = recs.get(targetKey);
      if (rec) renderGroupTile(rec.btn, target);
      toast('Added to folder', `${childName(dragged)} was added to “${target.name}”.`);
    } else if (target.kind === 'app' || target.kind === 'widget') {
      const group: Item = { key: nextKey(), kind: 'group', name: 'Folder', accent: GROUP_ACCENTS[Math.floor(Math.random() * GROUP_ACCENTS.length)], children: [target, dragged] };
      unmount(recs.get(targetKey)?.view);
      recs.get(targetKey)?.el.remove();
      recs.delete(targetKey);
      const insertAt = Math.min(targetIdx, draggedIdx);
      items = items.filter((i) => i.key !== targetKey && i.key !== draggedKey);
      items.splice(Math.min(insertAt, items.length), 0, group);
      toast('Folder created', `“${childName(target)}” and “${childName(dragged)}” grouped together.`);
    } else return;
    render();
  }

  function toggleGroupFan(it: Extract<Item, { kind: 'group' }>, anchor: HTMLElement) {
    if (fly && fly.kind === `group-${it.key}`) {
      closeFlyout();
      return;
    }
    const draw = () => {
      const tiles = it.children.map((c, idx) => {
        const mini = h('button', {
          class: c.kind === 'app' ? 'db app-btn group-fan-item' : 'widget-btn group-fan-item',
          type: 'button',
          'aria-label': childName(c),
          title: childName(c),
          style: `--fan-i:${idx}`,
        });
        if (c.kind === 'app') {
          mini.append(h('span', { class: 'app-ico', html: appIcons[c.app] }));
          mini.addEventListener('click', () => {
            toggleApp(c.app, mini);
            closeFlyout();
          });
        } else {
          const def = widgetById[c.inst.id];
          const view = def.compact(c.inst, env);
          mini.append(view.el);
          mount(view);
          mini.addEventListener('click', () => openWidgetPanel(c, mini));
        }
        mini.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          openMenu(
            [{ head: childName(c) }, { label: 'Remove from folder', icon: 'close', run: () => removeFromGroup(it.key, c.key) }],
            e,
          );
        });
        return mini;
      });
      return h('div', { class: 'group-fan', style: `--n:${tiles.length}` }, ...tiles);
    };
    const content = draw();
    openFlyout(content, { kind: `group-${it.key}`, anchor, cls: 'group-fan-fly' });
  }

  function removeFromGroup(groupKey: string, childKey: string) {
    const group = findGroup(groupKey);
    if (!group) return;
    const idx = group.children.findIndex((c) => c.key === childKey);
    if (idx < 0) return;
    const [child] = group.children.splice(idx, 1);
    const groupIdx = items.findIndex((i) => i.key === groupKey);
    if (group.children.length === 0) {
      items.splice(groupIdx, 1, child);
    } else {
      items.splice(groupIdx + 1, 0, child);
    }
    if (child.kind === 'widget') track(child.inst, env);
    closeFlyout();
    render(child.key);
    toast('Removed from folder', `${childName(child)} moved back to the dock.`);
  }

  function groupMenu(it: Extract<Item, { kind: 'group' }>, btn: HTMLElement, e: MouseEvent | null) {
    const entries: Entry[] = [
      { head: it.name },
      {
        label: 'Color',
        icon: 'sparkle',
        sub: GROUP_ACCENTS.map((c, idx) => ({ label: `Color ${idx + 1}`, checked: it.accent === c, run: () => { it.accent = c; btn.style.setProperty('--group-accent', c); } })),
      },
      { label: 'Rename…', icon: 'settings', run: () => openRenameGroup(it, btn) },
      'sep',
      {
        label: 'Ungroup',
        icon: 'widgets',
        run: () => {
          const idx = items.findIndex((i) => i.key === it.key);
          if (idx < 0) return;
          items.splice(idx, 1, ...it.children);
          it.children.forEach((c) => { if (c.kind === 'widget') track(c.inst, env); });
          render();
          toast('Ungrouped', `“${it.name}” was dissolved.`);
        },
      },
      { label: 'Remove from dock', icon: 'close', danger: true, run: () => { it.children.forEach((c) => c.kind === 'widget' && untrack(c.inst)); removeItem(it.key); } },
    ];
    openMenu(entries, e, btn);
  }

  function openRenameGroup(it: Extract<Item, { kind: 'group' }>, anchor: HTMLElement) {
    const input = h('input', { class: 'grp-rename-input', type: 'text', value: it.name, maxlength: '24' }) as HTMLInputElement;
    const save = () => {
      it.name = input.value.trim() || 'Folder';
      const rec = recs.get(it.key);
      if (rec) rec.btn.setAttribute('aria-label', `${it.name} folder, ${it.children.length} items`);
      closeFlyout();
    };
    const content = h(
      'div',
      { class: 'grp-rename' },
      h('div', { class: 'grp-rename-title', text: 'Rename folder' }),
      input,
      h('button', { class: 'wp-chip', text: 'Save', onclick: save }),
    );
    input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') save(); });
    openFlyout(content, { kind: `rename-${it.key}`, anchor, cls: 'grp-rename-fly', focus: 'input' });
  }

  /* ------------------------------------------------------------ start */

  function startMenu(anchor: HTMLElement, focusSearch = false) {
    const pinned: [AppId | 'dock-settings', string, string][] = [
      ['explorer', appNames.explorer, appIcons.explorer],
      ['browser', appNames.browser, appIcons.browser],
      ['terminal', appNames.terminal, appIcons.terminal],
      ['notepad', appNames.notepad, appIcons.notepad],
      ['music', appNames.music, appIcons.music],
      ['photos', appNames.photos, appIcons.photos],
      ['calculator', appNames.calculator, appIcons.calculator],
      ['dock-settings', 'DockHub', dockLogo('dl-start')],
      ['settings', appNames.settings, appIcons.settings],
      ['pc', appNames.pc, appIcons.pc],
      ['bin', 'Recycle Bin', appIcons.bin],
    ];
    const grid = h(
      'div',
      { class: 'start-grid' },
      ...pinned.map(([id, name, ic]) =>
        h('button', { class: 'start-app', type: 'button', onclick: () => { closeFlyout(); openApp(id); } }, h('span', { html: ic }), h('span', { text: name })),
      ),
    );
    const input = h('input', { type: 'search', placeholder: 'Search apps, settings and documents', 'aria-label': 'Search' }) as HTMLInputElement;
    input.addEventListener('input', () => {
      const q = input.value.toLowerCase();
      grid.querySelectorAll<HTMLElement>('.start-app').forEach((b) => (b.hidden = !!q && !b.textContent!.toLowerCase().includes(q)));
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') grid.querySelector<HTMLElement>('.start-app:not([hidden])')?.click();
    });
    const rec = (ic: string, title: string, subText: string, run: () => void) =>
      h('button', { type: 'button', onclick: () => { closeFlyout(); run(); } }, h('span', { class: 'rec-ic', html: ic }), h('span', {}, title, h('small', { text: subText })));
    const content = h(
      'div',
      { class: 'start' },
      h(
        'div',
        { class: 'start-body' },
        h('label', { class: 'start-search' }, h('span', { html: icons.search }), input),
        h('div', { class: 'start-head' }, 'Pinned', h('span', { text: 'All apps' })),
        grid,
        h('div', { class: 'start-head' }, 'Recommended'),
        h(
          'div',
          { class: 'start-rec' },
          rec(dockLogo('dl-rec'), 'DockHub', 'Recently added', () => openApp('dock-settings')),
          rec(appIcons.notepad, 'config.json', '%AppData%\\DockHub', () => openApp('notepad')),
          rec(appIcons.terminal, 'Restore taskbar', 'DockHub.exe --restore-taskbar', () => openApp('terminal')),
          rec(appIcons.photos, 'Desktop Layout.png', 'Pictures', () => openApp('photos')),
        ),
      ),
      h(
        'div',
        { class: 'start-foot' },
        h('span', { class: 'start-user' }, h('span', { class: 'avatar', html: icons.user }), 'User'),
        h('button', { class: 'start-power', type: 'button', 'aria-label': 'Power', html: icons.power, onclick: () => { closeFlyout(); exitDock(); } }),
      ),
    );
    openFlyout(content, { kind: 'start', anchor, cls: 'start-fly', focus: focusSearch ? 'input' : undefined });
  }

  $('[data-start]').addEventListener('click', (e) => startMenu(e.currentTarget as HTMLElement));
  /* ---------------------------------------------------------- launcher (0.8) */

  /** Quick math like the app: + - * / ^ %, parentheses, decimal comma or point. */
  function calc(text: string): number | null {
    const src = text.replace(/\s+/g, '').replace(/^=/, '').replace(/,/g, '.').replace(/×/g, '*').replace(/÷/g, '/');
    if (!/\d/.test(src) || !/[-+*/^%(]/.test(src) || !/^[\d.+\-*/^%()]+$/.test(src)) return null;
    let i = 0;
    const peek = () => src[i];
    const num = (): number => {
      if (peek() === '(') {
        i++;
        const v = expr();
        if (peek() !== ')') throw 0;
        i++;
        return v;
      }
      if (peek() === '-') {
        i++;
        return -unary();
      }
      const m = /^\d+(\.\d+)?/.exec(src.slice(i));
      if (!m) throw 0;
      i += m[0].length;
      return +m[0];
    };
    const unary = (): number => {
      let v = num();
      while (peek() === '%') {
        i++;
        v /= 100;
      }
      return v;
    };
    const pow = (): number => {
      const b = unary();
      if (peek() === '^') {
        i++;
        return Math.pow(b, pow());
      }
      return b;
    };
    const term = (): number => {
      let v = pow();
      while (peek() === '*' || peek() === '/') {
        const op = src[i++];
        const r = pow();
        if (op === '/' && r === 0) throw 0;
        v = op === '*' ? v * r : v / r;
      }
      return v;
    };
    const expr = (): number => {
      let v = term();
      while (peek() === '+' || peek() === '-') {
        const op = src[i++];
        const r = term();
        v = op === '+' ? v + r : v - r;
      }
      return v;
    };
    try {
      const v = expr();
      return i === src.length && Number.isFinite(v) ? v : null;
    } catch {
      return null;
    }
  }

  function launcher(anchor: HTMLElement) {
    type Entry = { title: string; sub: string; ic: string; keys?: string; run: () => void };
    const appEntries: Entry[] = (['explorer', 'browser', 'terminal', 'notepad', 'music', 'photos', 'calculator', 'settings', 'pc'] as AppId[]).map((id) => ({
      title: appNames[id],
      sub: 'App',
      ic: appIcons[id],
      run: () => openApp(id),
    }));
    const cmd = (title: string, keys: string, run: () => void): Entry => ({ title, sub: 'DockHub command', ic: dockLogo(`dl-l-${keys.length}`), keys, run });
    const settingsPage = (title: string, keys: string): Entry => ({ title, sub: 'DockHub settings', ic: icons.settings, keys, run: () => openApp('dock-settings') });
    const winSetting = (title: string, keys: string): Entry => ({ title, sub: 'Windows settings', ic: icons.monitor, keys, run: () => toast('Windows settings', `${title} opens in the Settings app.`) });
    const entries: Entry[] = [
      ...appEntries,
      cmd(state.autohide ? 'Turn off auto-hide' : 'Turn on auto-hide', 'hide', () => set('autohide', !state.autohide)),
      cmd('Show desktop', 'minimize desktop', showDesktop),
      cmd('Mute sound', 'volume audio', () => toast('Sound muted', 'Press the volume icon with the middle button to unmute.')),
      cmd('New virtual desktop', 'desktop', () => toast('Desktop 2', 'A new virtual desktop was created.')),
      cmd('Switch to the Gaming profile', 'profile', () => toast('Gaming profile', 'Your gaming dock is active.')),
      settingsPage('Appearance', 'theme glass size text'),
      settingsPage('Profiles', 'work gaming rules'),
      settingsPage('Widget gallery', 'add widgets'),
      winSetting('Display', 'brightness resolution scale'),
      winSetting('Night light', 'blue light'),
      winSetting('Bluetooth and devices', 'bluetooth'),
    ];
    const score = (e: Entry, q: string) => {
      const t = e.title.toLowerCase();
      if (t.startsWith(q)) return 100;
      if (t.includes(` ${q}`)) return 80;
      if (t.includes(q)) return 60;
      if (e.keys?.includes(q)) return 45;
      let at = 0;
      for (const ch of q.replace(/\s/g, '')) {
        at = t.indexOf(ch, at) + 1;
        if (!at) return 0;
      }
      return q.length > 1 ? 30 : 0;
    };

    const input = h('input', { type: 'search', placeholder: 'Search apps, settings and commands, or calculate', 'aria-label': 'Quick launcher' }) as HTMLInputElement;
    const list = h('div', { class: 'ql-list', role: 'listbox' });
    let shown: Entry[] = [];
    let sel = 0;
    const draw = () => {
      const q = input.value.trim().toLowerCase();
      const math = calc(q);
      shown = [];
      if (math !== null) {
        const out = Math.round(math * 1e10) / 1e10;
        const text = out.toLocaleString('en-US', { maximumFractionDigits: 10 });
        shown.push({ title: `= ${text}`, sub: 'Press Enter to copy the result', ic: icons.copy, run: () => { navigator.clipboard?.writeText(String(out)).catch(() => {}); toast('Copied', text); } });
      }
      shown.push(
        ...(q ? entries.map((e) => ({ e, s: score(e, q) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.e) : entries.slice(0, 6)),
      );
      if (q && math === null) shown.push({ title: `Search the web for “${input.value.trim()}”`, sub: 'Opens your browser', ic: icons.search, run: () => openApp('browser') });
      shown = shown.slice(0, 8);
      sel = Math.min(sel, Math.max(0, shown.length - 1));
      list.replaceChildren(
        ...shown.map((e, idx) =>
          h(
            'button',
            { class: `ql-row ${idx === sel ? 'on' : ''}`, type: 'button', role: 'option', 'aria-selected': String(idx === sel), onclick: () => { closeFlyout(); e.run(); } },
            h('span', { class: 'ql-ic', html: e.ic }),
            h('span', { class: 'ql-text' }, h('b', { text: e.title }), h('small', { text: e.sub })),
          ),
        ),
      );
    };
    input.addEventListener('input', () => {
      sel = 0;
      draw();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!shown.length) return;
        sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length;
        draw();
      } else if (e.key === 'Enter' && shown[sel]) {
        const entry = shown[sel];
        closeFlyout();
        entry.run();
      }
    });
    draw();
    const content = h(
      'div',
      { class: 'ql' },
      h('label', { class: 'start-search' }, h('span', { html: icons.search }), input),
      list,
      h('div', { class: 'ql-foot' }, h('span', { text: 'Try “term”, “200*15%” or “hide”' }), h('span', {}, h('kbd', { text: 'Win' }), ' + ', h('kbd', { text: 'Alt' }), ' + ', h('kbd', { text: 'Space' }), ' in the app')),
    );
    openFlyout(content, { kind: 'launcher', anchor, cls: 'ql-fly', focus: 'input' });
  }

  $('[data-search]').addEventListener('click', (e) => launcher(e.currentTarget as HTMLElement));

  /* ------------------------------------------------------------- tray */

  $('[data-tray-more]').addEventListener('click', (e) => {
    const trayApps: [AppId, string][] = [
      ['music', 'Media Player: playing'],
      ['photos', 'Photos: syncing'],
      ['calculator', 'Calculator'],
    ];
    const grid = h(
      'div',
      { class: 'tray-grid' },
      h('button', { type: 'button', title: 'DockHub', 'aria-label': 'DockHub', onclick: (ev: MouseEvent) => dockMenu(ev) }, h('span', { html: dockLogo('dl-tray') })),
      ...trayApps.map(([id, t]) => h('button', { type: 'button', title: t, 'aria-label': t, onclick: () => { closeFlyout(); openApp(id); } }, h('span', { html: appIcons[id] }))),
    );
    openFlyout(grid, { kind: 'tray', anchor: e.currentTarget as HTMLElement });
  });

  /* Volume on the dock (0.7): scroll to change, middle-click to mute. */
  const vol = { level: 45, muted: false };
  const quickBtn = $('[data-quick]');
  const volIc = quickBtn.querySelector<HTMLElement>('[data-vol-ic]');
  let volTip: HTMLElement | null = null;
  let volTipTimer = 0;
  function showVolume() {
    if (volIc) volIc.innerHTML = vol.muted || vol.level === 0 ? icons.volumeMute : icons.volume;
    quickBtn.setAttribute('aria-label', `Network, sound (${vol.muted ? 'muted' : `${vol.level}%`}) and battery`);
    if (fly) return;
    volTip?.remove();
    volTip = h('div', { class: 'flyout vol-tip', role: 'status' }, h('b', { text: vol.muted ? 'Speakers · muted' : `Speakers · ${vol.level}%` }), h('span', { class: 'vol-bar' }, h('i', { style: `width:${vol.muted ? 0 : vol.level}%` })), h('small', { text: 'Scroll to change · middle-click to mute' }));
    layer.append(volTip);
    place(volTip, quickBtn);
    clearTimeout(volTipTimer);
    volTipTimer = window.setTimeout(() => {
      volTip?.remove();
      volTip = null;
    }, 1400);
  }
  quickBtn.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      vol.muted = false;
      vol.level = Math.max(0, Math.min(100, vol.level + (e.deltaY < 0 ? 2 : -2)));
      showVolume();
    },
    { passive: false },
  );
  quickBtn.addEventListener('mousedown', (e) => e.button === 1 && e.preventDefault());
  quickBtn.addEventListener('auxclick', (e) => {
    if (e.button !== 1) return;
    e.preventDefault();
    vol.muted = !vol.muted;
    showVolume();
  });

  $('[data-quick]').addEventListener('click', (e) => {
    volTip?.remove();
    volTip = null;
    const tile = (ic: keyof typeof icons, label: string, on: boolean) => {
      const b = h('button', { class: `qt ${on ? 'on' : ''}`, type: 'button', 'aria-pressed': String(on) }, h('span', { html: icons[ic] }), label);
      b.addEventListener('click', () => {
        const v = !b.classList.contains('on');
        b.classList.toggle('on', v);
        b.setAttribute('aria-pressed', String(v));
      });
      return b;
    };
    const batt = h('span', { class: 'num' });
    const view: View = { el: batt, frame: () => (batt.textContent = `%${Math.round(sim.battery.value)}`) };
    const content = h(
      'div',
      { class: 'quick' },
      h('div', { class: 'quick-tiles' }, tile('wifi', 'Wi-Fi', true), tile('moon', 'Focus', false), tile('battery', 'Battery saver', false), tile('sun', 'Night light', false), tile('shield', 'Security', true), tile('monitor', 'Cast', false)),
      h('label', { class: 'quick-slider' }, h('span', { html: icons.sun }), h('input', { type: 'range', min: '0', max: '100', value: '70', 'aria-label': 'Brightness' })),
      h('label', { class: 'quick-slider' }, h('span', { html: vol.muted ? icons.volumeMute : icons.volume }), h('input', { type: 'range', min: '0', max: '100', value: String(vol.muted ? 0 : vol.level), 'aria-label': 'Volume', oninput: (ev: Event) => { vol.level = +(ev.target as HTMLInputElement).value; vol.muted = false; if (volIc) volIc.innerHTML = vol.level === 0 ? icons.volumeMute : icons.volume; } })),
      h('div', { class: 'quick-foot' }, h('span', {}, h('span', { html: icons.battery }), batt), h('button', { class: 'gallery-close', type: 'button', 'aria-label': 'Settings', html: icons.settings, onclick: () => { closeFlyout(); openApp('dock-settings'); } })),
    );
    openFlyout(content, { kind: 'quick', anchor: e.currentTarget as HTMLElement, views: [view] });
  });

  /* Input language (0.8): click or scroll to switch between installed keyboard languages. */
  const langBtn = $('[data-lang]');
  const langs = [
    ['ENG', 'English (United States)'],
    ['TUR', 'Türkçe (Q klavye)'],
  ];
  let lang = 0;
  const switchLang = (step: number) => {
    lang = (lang + step + langs.length) % langs.length;
    langBtn.textContent = langs[lang][0];
    langBtn.setAttribute('aria-label', `Input language: ${langs[lang][1]}. Click to switch`);
    langBtn.title = `${langs[lang][1]}\nClick to switch, right-click for all languages`;
  };
  switchLang(0);
  langBtn.addEventListener('click', () => switchLang(1));
  langBtn.addEventListener('wheel', (e) => { e.preventDefault(); switchLang(e.deltaY < 0 ? -1 : 1); }, { passive: false });
  langBtn.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openMenu(langs.map(([, name], idx) => ({ label: name, checked: idx === lang, run: () => switchLang(idx - lang) })), e);
  });

  /* Notification count and Do Not Disturb next to the clock (0.8). */
  const notifBadge = $('[data-notif-count]');
  const notes = [
    { app: 'Calendar', title: 'Design review in 10 minutes', body: 'Room 4 · Teams link in the invite' },
    { app: 'DockHub', title: 'Screenshot saved', body: 'Pictures › Screenshots' },
  ];
  let dnd = false;
  const syncBadge = () => {
    notifBadge.innerHTML = dnd ? icons.moon : String(notes.length);
    notifBadge.hidden = !dnd && notes.length === 0;
    notifBadge.classList.toggle('dnd', dnd);
    clockBtn.setAttribute('aria-label', `Clock, ${dnd ? 'Do not disturb is on' : `${notes.length} notifications`}`);
  };
  const clockBtn = $('[data-clock]');
  clockBtn.addEventListener('click', () => {
    const cal = widgetById.clock.panel(makeInstance('clock'), env);
    const dndChip = h('button', {
      class: `wp-chip ${dnd ? 'on' : ''}`,
      type: 'button',
      text: 'Do not disturb',
      onclick: () => {
        dnd = !dnd;
        dndChip.classList.toggle('on', dnd);
        syncBadge();
      },
    });
    const list = h('div', { class: 'wp-list' });
    const drawNotes = () =>
      list.replaceChildren(
        ...(notes.length
          ? notes.map((n) => h('div', { class: 'wp-list-row notif-row' }, h('div', { class: 'grow' }, h('div', { class: 'wp-muted', text: n.app }), h('div', { class: 'wp-strong', text: n.title }), h('div', { class: 'wp-muted', text: n.body }))))
          : [h('div', { class: 'wp-muted', text: 'No new notifications' })]),
      );
    drawNotes();
    const clear = h('button', {
      class: 'wp-chip',
      type: 'button',
      text: 'Clear all',
      onclick: () => {
        notes.length = 0;
        drawNotes();
        syncBadge();
      },
    });
    const content = h(
      'div',
      { class: 'notif' },
      h('div', { class: 'notif-top' }, h('div', { class: 'start-head' }, 'Notifications', h('div', { class: 'notif-actions' }, dndChip, clear)), list),
      cal.el,
    );
    openFlyout(content, { kind: 'clock', anchor: clockBtn, views: [cal] });
  });
  syncBadge();
  clockBtn.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openMenu(
      [
        { label: 'Quick settings', icon: 'settings', run: () => $<HTMLElement>('[data-quick]').click() },
        { label: 'Adjust date and time', icon: 'monitor', run: () => openApp('dock-settings') },
        'sep',
        { label: 'Notification center', icon: 'bell', run: () => clockBtn.click() },
      ],
      e,
    );
  });

  const clockTime = $('[data-clock-time]');
  const clockDate = $('[data-clock-date]');
  const tbClock = stage.querySelector('[data-clock-tb]');
  const tickClock = (d: Date) => {
    const t = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const ds = `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
    clockTime.textContent = t;
    clockDate.textContent = ds;
    if (tbClock) tbClock.innerHTML = `<span>${t}</span><span>${ds}</span>`;
  };
  tickClock(new Date());
  onSecond(tickClock);

  $('[data-show-desktop]').addEventListener('click', showDesktop);

  /* ---------------------------------------------------------- gallery */

  function openGallery(anchor: HTMLElement | null = null) {
    const cats: (Category | 'All')[] = ['All', 'Clocks', 'Productivity', 'Reminders', 'Notes', 'Media', 'System', 'Weather', 'AI'];
    let cat: string = 'All';
    const list = h('div', { class: 'gallery-list' });
    const tabs = h('div', { class: 'gallery-tabs', role: 'tablist' });
    const draw = () => {
      tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.cat === cat)));
      list.replaceChildren(
        ...widgets
          .filter((d) => cat === 'All' || d.category === cat)
          .map((d) => {
            const sel = d.variants.length > 1 ? (h('select', { 'aria-label': `${d.name} view` }, ...d.variants.map((v) => h('option', { value: v.id, text: v.name }))) as HTMLSelectElement) : null;
            const add = h('button', { class: 'add-btn', type: 'button', 'aria-label': `Add ${d.name}`, html: icons.plus });
            add.addEventListener('click', () => {
              addWidget(d.id, sel?.value);
              add.innerHTML = icons.check;
              add.classList.add('is-done');
              setTimeout(() => {
                add.innerHTML = icons.plus;
                add.classList.remove('is-done');
              }, 1200);
            });
            return h(
              'div',
              { class: 'gallery-row' },
              h('span', { class: 'gallery-ic', style: `color:${d.accent}`, html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${d.icon}"/></svg>` }),
              h('div', {}, h('b', { text: d.name }), h('p', { text: d.description }), sel),
              add,
            );
          }),
      );
    };
    cats.forEach((c) =>
      tabs.append(
        h('button', {
          type: 'button',
          role: 'tab',
          'data-cat': c,
          text: c,
          onclick: () => {
            cat = c;
            draw();
          },
        }),
      ),
    );
    draw();
    const content = h(
      'div',
      { class: 'gallery' },
      h('div', { class: 'gallery-head' }, 'Widget Gallery', h('button', { class: 'gallery-close', type: 'button', 'aria-label': 'Close', html: icons.close, onclick: () => closeFlyout() })),
      tabs,
      list,
    );
    openFlyout(content, { kind: 'gallery', anchor, cls: 'gallery-fly' });
  }

  /* -------------------------------------------------- window previews */

  let pv: { el: HTMLElement; key: AppId } | null = null;
  let pvTimer = 0;

  function previewHover(key: AppId, btn: HTMLElement, enter: boolean) {
    clearTimeout(pvTimer);
    if (!enter) {
      pvTimer = window.setTimeout(() => hidePreview(), 260);
      return;
    }
    if (!wins.has(key) || fly || stage!.dataset.phase !== 'ready') return;
    if (pv?.key === key) return;
    pvTimer = window.setTimeout(() => showPreview(key, btn), pv ? 0 : 420);
  }

  function hidePreview(immediate = false) {
    clearTimeout(pvTimer);
    if (!pv) return;
    const el = pv.el;
    pv = null;
    if (immediate || reduced()) el.remove();
    else {
      el.classList.add('is-closing');
      setTimeout(() => el.remove(), 150);
    }
  }

  function showPreview(key: AppId, btn: HTMLElement) {
    hidePreview(true);
    const wv = wins.get(key);
    if (!wv) return;
    const ww = wv.el.offsetWidth;
    const wh = wv.el.offsetHeight;
    const k = Math.min(208 / ww, 128 / wh);
    const clone = wv.el.cloneNode(true) as HTMLElement;
    clone.classList.remove('is-min', 'is-inactive', 'is-closing', 'is-dragging');
    clone.removeAttribute('role');
    clone.removeAttribute('aria-label');
    clone.setAttribute('inert', '');
    Object.assign(clone.style, { left: '0px', top: '0px', transform: `scale(${k})`, transformOrigin: '0 0', zIndex: 'auto' });
    const close = () => {
      card.classList.add('is-closing');
      setTimeout(() => {
        closeWin(key);
        hidePreview(true);
      }, 150);
    };
    const card = h(
      'div',
      { class: 'pv-card', role: 'button', tabindex: '0', 'aria-label': `${appNames[key]}. Middle-click to close.` },
      h(
        'div',
        { class: 'pv-head' },
        h('span', { class: 'pv-ic', html: appIcons[key] }),
        h('span', { class: 'pv-title', text: appNames[key] }),
        h('button', { type: 'button', class: 'pv-close', 'aria-label': 'Close window', html: icons.close, onclick: (e: Event) => { e.stopPropagation(); close(); } }),
      ),
      h('div', { class: 'pv-thumb', style: `width:${Math.round(ww * k)}px;height:${Math.round(wh * k)}px` }, clone),
    );
    card.addEventListener('click', () => {
      hidePreview(true);
      openApp(key);
    });
    // Middle-click closes the window, as on the Windows taskbar (fixed in DockHub 0.7).
    card.addEventListener('mousedown', (e) => e.button === 1 && e.preventDefault());
    card.addEventListener('auxclick', (e) => {
      if (e.button !== 1) return;
      e.preventDefault();
      close();
    });
    const el = h('div', { class: 'flyout win-preview' }, card, h('div', { class: 'pv-hint', text: 'Middle-click to close' }));
    el.addEventListener('pointerenter', () => clearTimeout(pvTimer));
    el.addEventListener('pointerleave', () => previewHover(key, btn, false));
    el.style.visibility = 'hidden';
    layer.append(el);
    place(el, btn);
    el.style.visibility = '';
    pv = { el, key };
  }

  /* ---------------------------------------------------------- windows */

  interface Win {
    key: WinKey;
    el: HTMLElement;
    min: boolean;
    views: View[];
  }
  const wins = new Map<WinKey, Win>();
  let activeWin: Win | null = null;
  let zTop = 1;
  let cascade = 0;

  const winSizes: Partial<Record<WinKey, [number, number]>> = {
    explorer: [640, 400],
    pc: [640, 400],
    bin: [520, 320],
    browser: [640, 420],
    terminal: [600, 340],
    notepad: [520, 360],
    music: [320, 470],
    photos: [560, 380],
    calculator: [300, 420],
    'dock-settings': [720, 480],
    settings: [720, 480],
  };

  function dockBtnFor(key: WinKey) {
    const it = items.find((i) => i.kind === 'app' && i.app === key);
    return it ? recs.get(it.key)?.btn : undefined;
  }

  function updateRunning() {
    recs.forEach((rec, key) => {
      const it = items.find((i) => i.key === key);
      if (it?.kind !== 'app') return;
      const wv = wins.get(it.app);
      rec.btn.classList.toggle('is-running', !!wv);
      rec.btn.classList.toggle('is-active', !!wv && !wv.min && activeWin === wv);
    });
  }

  function focusWin(wv: Win) {
    activeWin = wv;
    wv.el.style.zIndex = String(++zTop);
    wins.forEach((o) => o.el.classList.toggle('is-inactive', o !== wv));
    updateRunning();
    syncEngaged();
  }

  function minimizeWin(wv: Win) {
    const b = dockBtnFor(wv.key);
    const { r, s } = stageScale();
    if (b && stage!.dataset.phase === 'ready') {
      const br = b.getBoundingClientRect();
      const tx = (br.left - r.left) / s + br.width / s / 2 - (wv.el.offsetLeft + wv.el.offsetWidth / 2);
      const ty = (br.top - r.top) / s - (wv.el.offsetTop + wv.el.offsetHeight / 2);
      wv.el.style.setProperty('--mx', `${tx}px`);
      wv.el.style.setProperty('--my', `${ty}px`);
    }
    wv.min = true;
    wv.el.classList.add('is-min');
    if (activeWin === wv) activeWin = null;
    updateRunning();
    syncEngaged();
  }

  function restoreWin(wv: Win) {
    wv.min = false;
    wv.el.classList.remove('is-min');
    focusWin(wv);
  }

  function closeWin(key: WinKey) {
    const wv = wins.get(key);
    if (!wv) return;
    wins.delete(key);
    wv.views.forEach(unmount);
    if (activeWin === wv) activeWin = null;
    wv.el.classList.add('is-closing');
    setTimeout(() => wv.el.remove(), 170);
    updateRunning();
    syncEngaged();
  }

  function showDesktop() {
    const open = [...wins.values()].filter((x) => !x.min);
    if (open.length) open.forEach(minimizeWin);
    else wins.forEach(restoreWin);
  }

  function workArea() {
    const sw = stage!.offsetWidth;
    const sh = stage!.offsetHeight;
    const d = dock.offsetHeight;
    const dw = dock.offsetWidth;
    const pad = 12;
    let x = pad;
    let y = pad;
    let wdt = sw - pad * 2;
    let hgt = sh - pad * 2;
    if (state.mode === 'both') hgt -= 48;
    if (state.edge === 'bottom') hgt -= d + 8;
    if (state.edge === 'top') {
      y += d + 8;
      hgt -= d + 8;
    }
    if (state.edge === 'left') {
      x += dw + 8;
      wdt -= dw + 8;
    }
    if (state.edge === 'right') wdt -= dw + 8;
    return { x, y, w: wdt, h: hgt };
  }

  function openApp(key: WinKey) {
    closeFlyout();
    if (key === 'settings') key = 'dock-settings';
    const existing = wins.get(key);
    if (existing) {
      if (existing.min) restoreWin(existing);
      else focusWin(existing);
      return;
    }
    createWin(key);
  }

  function toggleApp(key: AppId, btn: HTMLElement) {
    const wv = wins.get(key);
    hidePreview(true);
    closeFlyout();
    if (!wv) {
      btn.classList.remove('is-bouncing');
      void btn.offsetWidth;
      btn.classList.add('is-bouncing');
      setTimeout(() => btn.classList.remove('is-bouncing'), 750);
      createWin(key);
    } else if (wv.min) restoreWin(wv);
    else if (activeWin === wv) minimizeWin(wv);
    else focusWin(wv);
  }

  function createWin(key: WinKey) {
    const area = workArea();
    const [pw, ph] = winSizes[key] ?? [560, 380];
    const ww = Math.min(pw, area.w);
    const wh = Math.min(ph, area.h);
    const off = (cascade++ % 5) * 26;
    const left = area.x + Math.max(0, (area.w - ww) / 2 - 60 + off);
    const top = area.y + Math.max(0, Math.min((area.h - wh) / 2 - 20 + off, area.h - wh));
    const title = key === 'dock-settings' ? 'DockHub Settings' : appNames[key as AppId];
    const icon = key === 'dock-settings' ? dockLogo(`dl-w${cascade}`) : appIcons[key as AppId];
    const content = winContent(key);
    const bodyEl = h('div', { class: 'win-body' }, content.el);
    const ctrl = (ic: string, label: string, cls: string, fn: () => void) => h('button', { type: 'button', class: cls, 'aria-label': label, html: ic, onclick: (e: Event) => { e.stopPropagation(); fn(); } });
    const barEl = h(
      'div',
      { class: 'win-bar' },
      h('div', { class: 'win-title' }, h('span', { html: icon }), h('span', { text: title })),
      h(
        'div',
        { class: 'win-ctrls' },
        ctrl(icons.minus, 'Minimize', '', () => minimizeWin(wv)),
        ctrl('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>', 'Maximize', '', () => maximize()),
        ctrl(icons.close, 'Close', 'close', () => closeWin(key)),
      ),
    );
    const el = h('div', { class: 'win', role: 'dialog', 'aria-label': title, style: `left:${left}px;top:${top}px;width:${ww}px;height:${wh}px` }, barEl, bodyEl);
    const wv: Win = { key, el, min: false, views: content.views };
    let maxed: string | null = null;
    const maximize = () => {
      if (maxed) {
        el.setAttribute('style', maxed);
        maxed = null;
      } else {
        maxed = el.getAttribute('style');
        const a = workArea();
        Object.assign(el.style, { left: `${a.x - 4}px`, top: `${a.y - 4}px`, width: `${a.w + 8}px`, height: `${a.h + 8}px` });
      }
    };
    el.addEventListener('pointerdown', () => focusWin(wv));
    barEl.addEventListener('dblclick', maximize);
    barEl.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('button')) return;
      const { s } = stageScale();
      const sx = e.clientX;
      const sy = e.clientY;
      const ox = el.offsetLeft;
      const oy = el.offsetTop;
      el.classList.add('is-dragging');
      barEl.setPointerCapture(e.pointerId);
      const mv = (ev: PointerEvent) => {
        const nx = Math.min(Math.max(-el.offsetWidth + 80, ox + (ev.clientX - sx) / s), stage!.offsetWidth - 80);
        const ny = Math.min(Math.max(0, oy + (ev.clientY - sy) / s), stage!.offsetHeight - 40);
        el.style.left = `${nx}px`;
        el.style.top = `${ny}px`;
      };
      const upd = () => {
        el.classList.remove('is-dragging');
        barEl.removeEventListener('pointermove', mv);
        barEl.removeEventListener('pointerup', upd);
        barEl.removeEventListener('pointercancel', upd);
      };
      barEl.addEventListener('pointermove', mv);
      barEl.addEventListener('pointerup', upd);
      barEl.addEventListener('pointercancel', upd);
    });
    winLayer.append(el);
    wins.set(key, wv);
    wv.views.forEach(mount);
    focusWin(wv);
    content.after?.();
  }

  function winContent(key: WinKey): { el: HTMLElement; views: View[]; after?: () => void } {
    switch (key) {
      case 'explorer':
      case 'pc':
        return explorerContent();
      case 'bin':
        return { el: h('div', { class: 'br-page' }, h('span', { class: 'logo', html: appIcons.bin }), h('p', { text: 'Recycle Bin is empty.' })), views: [] };
      case 'browser':
        return {
          el: h(
            'div',
            { class: 'br' },
            h('div', { class: 'br-bar' }, h('div', { class: 'br-url' }, h('span', { html: icons.search }), 'Search or enter web address')),
            h('div', { class: 'br-page' }, h('span', { class: 'logo', html: dockLogo('dl-br') }), h('h4', { text: 'New Tab' }), h('p', { text: 'This window is part of the interactive demo. Drag from the title bar to move, or click the dock icon to minimize.' })),
          ),
          views: [],
        };
      case 'terminal':
        return terminalContent();
      case 'notepad': {
        const ta = h('textarea', { class: 'np', spellcheck: 'false', 'aria-label': 'Notepad' }) as HTMLTextAreaElement;
        ta.value = `{\n  "version": 2,\n  "taskbarMode": "Replace",\n  "edge": "${cap(state.edge)}",\n  "theme": "${cap(state.theme)}",\n  "backdrop": "${cap(state.backdrop)}",\n  "size": "${cap(state.size)}",\n  "layout": "${cap(state.layout)}",\n  "autoHide": ${state.autohide},\n  "items": [ … ]\n}\n\n%AppData%\\DockHub\\config.json`;
        return { el: ta, views: [] };
      }
      case 'music': {
        const v = widgetById.media.panel(makeInstance('media'), env);
        v.el.style.width = '100%';
        return { el: v.el, views: [v] };
      }
      case 'photos':
        return { el: h('div', { class: 'ph' }, ...Array.from({ length: 12 }, (_, i) => h('span', { html: albumArt(i % tracks.length).replace(/id="art(\d)"/, `id="ph${i}"`).replace(/url\(#art\d\)/, `url(#ph${i})`) }))), views: [] };
      case 'calculator':
        return calcContent();
      default:
        return settingsContent();
    }
  }

  const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

  function explorerContent() {
    const files: { name: string; ic: string; pin?: AppId; lnk?: boolean }[] = [
      { name: 'Documents', ic: appIcons.explorer },
      { name: 'Downloads', ic: appIcons.explorer },
      { name: 'Pictures', ic: appIcons.explorer },
      { name: 'Music', ic: appIcons.explorer },
      { name: 'Calculator', ic: appIcons.calculator, pin: 'calculator', lnk: true },
      { name: 'Photos', ic: appIcons.photos, pin: 'photos', lnk: true },
      { name: 'Media Player', ic: appIcons.music, pin: 'music', lnk: true },
      { name: 'DockHub.exe', ic: dockLogo('dl-ex') },
    ];
    const grid = h('div', { class: 'ex-grid' });
    files.forEach((f) => {
      const b = h('button', { class: 'ex-file', type: 'button' }, h('span', { html: f.ic }, f.lnk ? h('span', { class: 'lnk', html: icons.arrowUp.replace('M12 19V5M6.5 10.5L12 5l5.5 5.5', 'M8 16L16 8M9.5 8H16v6.5') }) : null), h('span', { text: f.name }));
      const menu = (e: MouseEvent | null) => {
        grid.querySelectorAll('.is-selected').forEach((x) => x.classList.remove('is-selected'));
        b.classList.add('is-selected');
        const entries: Entry[] = [{ head: f.name }, { label: 'Open', icon: 'external', run: () => (f.pin ? openApp(f.pin) : f.name === 'DockHub.exe' ? startDock() : undefined) }];
        if (f.pin) entries.push({ label: 'Pin to DockHub', icon: 'pin', run: () => pinApp(f.pin!) });
        entries.push('sep', { label: 'Properties', icon: 'settings' });
        openMenu(entries, e, b);
      };
      b.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        menu(e);
      });
      b.addEventListener('click', () => {
        grid.querySelectorAll('.is-selected').forEach((x) => x.classList.remove('is-selected'));
        b.classList.add('is-selected');
      });
      b.addEventListener('dblclick', () => (f.pin ? openApp(f.pin) : undefined));
      let lp = 0;
      b.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'mouse') lp = window.setTimeout(() => menu(null), 450);
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => b.addEventListener(ev, () => clearTimeout(lp)));
      grid.append(b);
    });
    const side = h(
      'div',
      { class: 'ex-side' },
      ...['Home', 'Desktop', 'Documents', 'Downloads', 'This PC'].map((n, i) => h('button', { type: 'button', class: i === 0 ? 'on' : '' }, h('span', { html: i === 4 ? appIcons.pc : appIcons.explorer }), n)),
    );
    return {
      el: h(
        'div',
        { class: 'ex' },
        side,
        h(
          'div',
          { class: 'ex-main' },
          h('div', { class: 'ex-crumb', text: 'Home  ›  Quick access' }),
          h('div', { class: 'ex-tip' }, h('span', { html: icons.pin }), h('span', { text: 'Right-click (or tap and hold on touch) a shortcut and choose "Pin to DockHub".' })),
          grid,
        ),
      ),
      views: [],
    };
  }

  function terminalContent() {
    const out = h('div');
    const input = h('input', { type: 'text', 'aria-label': 'Command', spellcheck: 'false', autocomplete: 'off' }) as HTMLInputElement;
    const prompt = 'PS C:\\Users\\you> ';
    const term = h('div', { class: 'term' }, out, h('div', { class: 'term-line' }, h('span', { text: prompt }), input));
    const print = (text: string, cls = '') => out.append(h('p', { class: cls, text }));
    print('Windows PowerShell', 't-dim');
    print('Try: DockHub.exe --exit, DockHub.exe, --restore-taskbar, --pin calc, help', 't-dim');
    print('');
    const history: string[] = [];
    let hi = 0;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' && history.length) {
        hi = Math.max(0, hi - 1);
        input.value = history[hi];
        return;
      }
      if (e.key === 'ArrowDown' && history.length) {
        hi = Math.min(history.length, hi + 1);
        input.value = history[hi] ?? '';
        return;
      }
      if (e.key !== 'Enter') return;
      const raw = input.value.trim();
      input.value = '';
      print(prompt + raw);
      if (!raw) return;
      history.push(raw);
      hi = history.length;
      const cmd = raw.toLowerCase().replace(/^\.\\/, '').replace(/(dockhub|customdock)(\.exe)?/, 'dockhub');
      if (cmd === 'cls' || cmd === 'clear') out.replaceChildren();
      else if (cmd === 'yardım' || cmd === 'yardim' || cmd === 'help') {
        print('DockHub.exe                        Launch or bring settings to foreground');
        print('DockHub.exe --exit                 Gracefully exit, taskbar restored');
        print('DockHub.exe --restore-taskbar      Emergency taskbar restoration');
        print('DockHub.exe --pin "<file>"         Pin an app to the dock (calc, photos, music)');
      } else if (cmd === 'dockhub') {
        if (stage!.dataset.phase === 'exited') {
          startDock();
          print('DockHub launched. Taskbar hidden.', 't-ok');
        } else {
          openApp('dock-settings');
          print('Already running, brought settings window to front.', 't-ok');
        }
      } else if (cmd === 'dockhub --exit') {
        if (stage!.dataset.phase === 'exited') print('DockHub is already closed.', 't-dim');
        else {
          exitDock();
          print('DockHub closed. Windows taskbar restored.', 't-ok');
        }
      } else if (cmd === 'dockhub --restore-taskbar') {
        if (stage!.dataset.phase !== 'exited') exitDock(true);
        print('session.json read, original taskbar state restored.', 't-ok');
        print('TaskbarCreated broadcast sent, tray icons re-registered.', 't-ok');
      } else if (cmd.startsWith('dockhub --pin')) {
        const arg = cmd.slice('dockhub --pin'.length).replace(/"/g, '').trim();
        const target: AppId | null = /calc|hesap/.test(arg) ? 'calculator' : /photo|foto/.test(arg) ? 'photos' : /music|müzik|media|medya/.test(arg) ? 'music' : /note|not/.test(arg) ? 'notepad' : /term/.test(arg) ? 'terminal' : null;
        if (!target) print(`"${arg || '?'}" not found. Example: DockHub.exe --pin calc`, 't-err');
        else {
          pinApp(target);
          print(`${appNames[target]} pinned to dock.`, 't-ok');
        }
      } else print(`'${raw}' is not recognized. Type "help" for commands.`, 't-err');
      term.scrollTop = term.scrollHeight;
    });
    return { el: term, views: [], after: () => setTimeout(() => input.focus({ preventScroll: true }), 50) };
  }

  function calcContent() {
    let cur = '0';
    let acc: number | null = null;
    let op: string | null = null;
    let fresh = false;
    const screen = h('div', { class: 'calc-screen num' });
    const hist = h('small');
    const show = () => {
      screen.replaceChildren(hist, cur.replace('.', ','));
    };
    const calc = (a: number, b: number, o: string) => (o === '+' ? a + b : o === '−' ? a - b : o === '×' ? a * b : b === 0 ? NaN : a / b);
    const press = (k: string) => {
      if (/\d/.test(k)) {
        cur = fresh || cur === '0' ? k : cur + k;
        fresh = false;
      } else if (k === ',') {
        if (fresh) cur = '0';
        if (!cur.includes('.')) cur += '.';
        fresh = false;
      } else if (k === 'C') {
        cur = '0';
        acc = null;
        op = null;
        hist.textContent = '';
      } else if (k === '⌫') cur = cur.length > 1 ? cur.slice(0, -1) : '0';
      else if (k === '=') {
        if (op !== null && acc !== null) {
          const r = calc(acc, parseFloat(cur), op);
          hist.textContent = `${String(acc).replace('.', ',')} ${op} ${cur.replace('.', ',')} =`;
          cur = Number.isFinite(r) ? String(+r.toFixed(10)) : 'Cannot divide by zero';
          acc = null;
          op = null;
          fresh = true;
        }
      } else {
        const v = parseFloat(cur);
        acc = acc !== null && op && !fresh ? calc(acc, v, op) : Number.isNaN(v) ? 0 : v;
        op = k;
        hist.textContent = `${String(acc).replace('.', ',')} ${op}`;
        cur = String(acc);
        fresh = true;
      }
      show();
    };
    const keys = ['C', '⌫', '÷', '×', '7', '8', '9', '−', '4', '5', '6', '+', '1', '2', '3', '=', '0', ','];
    const pad = h(
      'div',
      { class: 'calc-keys' },
      ...keys.map((k) => {
        const b = h('button', { type: 'button', class: k === '=' ? 'eq' : /[÷×−+C⌫]/.test(k) ? 'op' : '', text: k, onclick: () => press(k) });
        if (k === '=') b.style.gridRow = 'span 2';
        if (k === '0') b.style.gridColumn = 'span 2';
        return b;
      }),
    );
    show();
    return { el: h('div', { class: 'calc' }, screen, pad), views: [] };
  }

  function settingsContent() {
    const pages = ['General', 'Appearance', 'Taskbar', 'Widget Gallery'];
    let page = 'Appearance';
    const main = h('div', { class: 'set-main' });
    const side = h('div', { class: 'set-side' });
    const select = (key: keyof typeof state, opts: [string, string][]) => {
      const s = h('select', { 'aria-label': String(key) }, ...opts.map(([v, l]) => h('option', { value: v, text: l }))) as HTMLSelectElement;
      s.value = String(state[key]);
      s.addEventListener('change', () => set(key, s.value));
      return s;
    };
    const toggle = (key: 'autohide' | 'fullscreenHide') => {
      const b = h('button', { class: 'switch', role: 'switch', type: 'button', 'aria-checked': String(state[key]), 'aria-label': key });
      b.addEventListener('click', () => set(key, !state[key]));
      return b;
    };
    const row = (title: string, desc: string, ctl: HTMLElement) => h('div', { class: 'set-row' }, h('div', {}, h('b', { text: title }), h('small', { text: desc })), ctl);
    const draw = () => {
      const focused = main.contains(document.activeElement) ? (document.activeElement as HTMLElement).getAttribute('aria-label') : null;
      side.replaceChildren(
        h('div', { class: 'set-app' }, h('span', { html: dockLogo('dl-set') }), h('div', {}, h('b', { text: 'DockHub' }), h('small', { text: 'Settings' }))),
        ...pages.map((p) =>
          h('button', { type: 'button', class: p === page ? 'on' : '', onclick: () => { page = p; draw(); } }, h('span', { html: icons[(['settings', 'sparkle', 'monitor', 'widgets'] as const)[pages.indexOf(p)]] }), p),
        ),
      );
      const rows: HTMLElement[] = [];
      if (page === 'General') {
        rows.push(
          row('Replace taskbar', 'Application restarts itself when toggled', select('mode', [['replace', 'DockHub only'], ['both', 'Both together']])),
          row('Start with Windows', 'Dock is ready upon logging in', h('button', { class: 'switch', role: 'switch', type: 'button', 'aria-checked': 'true', onclick: (e: Event) => { const b = e.currentTarget as HTMLElement; b.setAttribute('aria-checked', String(b.getAttribute('aria-checked') !== 'true')); } })),
          row('Restore Windows taskbar', 'Emergency fallback: always works', h('button', { class: 'wp-btn', type: 'button', text: 'Restore', onclick: () => exitDock(true) })),
        );
      } else if (page === 'Appearance') {
        rows.push(
          h('div', { class: 'set-group', text: 'Dock' }),
          row('Position', 'Screen edge where the dock sits', select('edge', [['bottom', 'Bottom'], ['top', 'Top'], ['left', 'Left'], ['right', 'Right']])),
          row('Layout', 'Floating island or edge attached', select('layout', [['floating', 'Floating'], ['attached', 'Attached']])),
          row('Size', 'Small matches default Windows taskbar height', select('size', [['small', 'Small (48)'], ['medium', 'Medium (56)'], ['large', 'Large (66)']])),
          h('div', { class: 'set-group', text: 'Appearance' }),
          row('Theme', 'Dark, light, or follow system', select('theme', [['dark', 'Dark'], ['light', 'Light']])),
          row('Backdrop', 'Blurred glass, Acrylic, transparent, or solid', select('backdrop', [['blur', 'Blurred glass'], ['acrylic', 'Acrylic'], ['transparent', 'Transparent'], ['solid', 'Solid']])),
        );
      } else if (page === 'Taskbar') {
        rows.push(
          row('Auto-hide', 'Slides off screen, slides back on hover', toggle('autohide')),
          row('Hide in fullscreen', 'During games, videos, and F11 mode', toggle('fullscreenHide')),
          row('Start button', 'Opens the Windows Start menu', h('button', { class: 'switch', role: 'switch', type: 'button', 'aria-checked': 'true', disabled: true })),
        );
      } else {
        rows.push(
          ...widgets.map((d) =>
            row(d.name, d.variants.map((v) => v.name).join(', '), h('button', { class: 'add-btn', type: 'button', 'aria-label': `Add ${d.name}`, html: icons.plus, onclick: () => addWidget(d.id) })),
          ),
        );
      }
      main.replaceChildren(h('h4', { text: page }), ...rows);
      if (focused) main.querySelector<HTMLElement>(`[aria-label="${focused}"]`)?.focus({ preventScroll: true });
    };
    draw();
    const view: View = { el: main, refresh: draw };
    return { el: h('div', { class: 'set' }, side, main), views: [view] };
  }

  /* ------------------------------------------------------------ toasts */

  function toast(title: string, body: string, opts: { actions?: { label: string; run: () => void; accent?: boolean }[]; timeout?: number } = {}) {
    const close = () => {
      el.classList.add('is-closing');
      setTimeout(() => el.remove(), 200);
    };
    const el = h(
      'div',
      { class: 'toast', role: 'status' },
      h('div', { class: 'toast-app' }, h('span', { html: dockLogo(`dl-t${Date.now()}`) }), 'DockHub', h('button', { class: 'toast-close', type: 'button', 'aria-label': 'Close', html: icons.close, onclick: close })),
      h('b', { text: title }),
      h('p', { text: body }),
      opts.actions
        ? h(
            'div',
            { class: 'toast-actions' },
            ...opts.actions.map((a) => h('button', { type: 'button', class: `wp-btn ${a.accent ? 'accent' : ''}`, text: a.label, onclick: () => { close(); a.run(); } })),
          )
        : null,
    );
    toasts.append(el);
    while (toasts.children.length > 2) toasts.firstElementChild?.remove();
    if (opts.timeout !== 0) setTimeout(close, opts.timeout ?? 6000);
  }

  /* ------------------------------------------------------------ phases */

  function enter() {
    if (reduced()) return;
    stage!.classList.add('is-entering');
    setTimeout(() => stage!.classList.remove('is-entering'), 1500);
  }

  /** Like the real app: the Windows taskbar is hidden first, then the dock appears in its place. */
  let handoffTimer = 0;
  function startDock() {
    clearTimeout(handoffTimer);
    if (reduced()) {
      stage!.dataset.phase = 'ready';
      evalHide();
      return;
    }
    stage!.dataset.phase = 'handoff';
    handoffTimer = window.setTimeout(() => {
      stage!.dataset.phase = 'ready';
      enter();
      evalHide();
      requestAnimationFrame(updateFades);
    }, 420);
  }

  function exitDock(restore = false) {
    clearTimeout(handoffTimer);
    closeFlyout();
    stage!.dataset.phase = 'exited';
    stage!.classList.remove('is-hidden');
    toast(restore ? 'Taskbar restored' : 'DockHub closed', 'Windows taskbar and tray icons are restored. Nothing was lost.', {
      actions: [{ label: 'Restart DockHub', accent: true, run: startDock }],
      timeout: 0,
    });
  }

  let booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    if (reduced()) {
      stage!.dataset.phase = 'ready';
      return;
    }
    setTimeout(startDock, 900);
    setTimeout(() => toast('DockHub is running', 'Replaced the taskbar. When you close it, the Windows taskbar returns automatically.'), 2400);
  }

  /* ---------------------------------------------------------- autohide */

  let nearEdge = false;
  let hovered = false;
  let hideTimer = 0;
  function evalHide() {
    clearTimeout(hideTimer);
    if (!state.autohide || stage!.dataset.phase !== 'ready') {
      stage!.classList.remove('is-hidden');
      return;
    }
    if (hovered || nearEdge || fly) {
      stage!.classList.remove('is-hidden');
      return;
    }
    hideTimer = window.setTimeout(() => stage!.classList.add('is-hidden'), 650);
  }
  dock.addEventListener('pointerenter', () => {
    hovered = true;
    evalHide();
  });
  dock.addEventListener('pointerleave', () => {
    hovered = false;
    evalHide();
  });
  dock.addEventListener('focusin', () => {
    hovered = true;
    evalHide();
  });
  dock.addEventListener('focusout', () => {
    hovered = false;
    evalHide();
  });

  const onPointer = (e: PointerEvent) => {
    const { r, s } = stageScale();
    const x = (e.clientX - r.left) / s;
    const y = (e.clientY - r.top) / s;
    const sw = stage!.offsetWidth;
    const sh = stage!.offsetHeight;
    stage!.style.setProperty('--px', ((x / sw) * 2 - 1).toFixed(3));
    stage!.style.setProperty('--py', ((y / sh) * 2 - 1).toFixed(3));
    if (!state.autohide) return;
    const bottomLimit = sh - (state.mode === 'both' ? 48 : 0);
    const dist = state.edge === 'bottom' ? bottomLimit - y : state.edge === 'top' ? y : state.edge === 'left' ? x : sw - x;
    const hidden = stage!.classList.contains('is-hidden');
    const near = dist >= -2 && dist < (hidden ? 18 : dock.offsetHeight + 30);
    if (near !== nearEdge) {
      nearEdge = near;
      evalHide();
    }
  };
  stage.addEventListener('pointermove', onPointer);
  stage.addEventListener('pointerdown', onPointer);
  stage.addEventListener('pointerleave', () => {
    nearEdge = false;
    evalHide();
  });

  /* -------------------------------------------------------------- set */

  function set(key: keyof typeof state, value: any) {
    if ((state as any)[key] === value) return;
    const layoutChange = key === 'edge' || key === 'layout' || key === 'size' || key === 'mode';
    const apply = () => {
      (state as any)[key] = value;
      if (key === 'autohide' || key === 'fullscreenHide') {
        if (key === 'autohide') {
          stage!.classList.toggle('show-hint', !!value);
          if (value) setTimeout(() => stage!.classList.remove('show-hint'), 4200);
          evalHide();
        }
      } else stage!.dataset[key] = String(value);
      if (key === 'edge') render();
      syncBar();
      refreshAll();
      requestAnimationFrame(updateFades);
    };
    closeFlyout(true);
    if (layoutChange && !reduced() && stage!.dataset.phase === 'ready') {
      const anim = dock.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: 'ease-in', fill: 'forwards' });
      anim.onfinish = () => {
        apply();
        anim.cancel();
        dock.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
        enter();
      };
    } else apply();
    if (key === 'mode') {
      toast(
        value === 'both' ? 'Both together' : 'DockHub replaced the taskbar',
        value === 'both' ? 'Windows taskbar remains untouched; dock sits above it. Tray icons are not overtaken.' : 'Windows taskbar hidden, tray icons moved to the dock.',
      );
    }
  }

  /* --------------------------------------------------------------- bar */

  const segs = bar ? [...bar.querySelectorAll<HTMLElement>('[data-control]')] : [];
  segs.forEach((seg) => {
    const thumb = h('span', { class: 'seg-thumb', 'aria-hidden': 'true' });
    seg.prepend(thumb);
    seg.querySelectorAll<HTMLButtonElement>('button').forEach((b) =>
      b.addEventListener('click', () => {
        const key = seg.dataset.control as keyof typeof state;
        if (key === 'mode' && stage!.dataset.phase === 'exited') startDock();
        set(key, b.dataset.value);
      }),
    );
    seg.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const btns = [...seg.querySelectorAll<HTMLButtonElement>('button')];
      const i = btns.findIndex((b) => b.getAttribute('aria-checked') === 'true');
      const n = btns[(i + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length];
      n.focus();
      n.click();
    });
  });

  function syncBar() {
    segs.forEach((seg) => {
      const key = seg.dataset.control as keyof typeof state;
      const btns = [...seg.querySelectorAll<HTMLButtonElement>('button')];
      btns.forEach((b) => {
        const on = String(state[key]) === b.dataset.value;
        b.setAttribute('aria-checked', String(on));
        b.tabIndex = on ? 0 : -1;
      });
      const active = btns.find((b) => b.getAttribute('aria-checked') === 'true');
      const thumb = seg.querySelector<HTMLElement>('.seg-thumb');
      if (active && thumb) {
        thumb.style.width = `${active.offsetWidth}px`;
        thumb.style.transform = `translateX(${active.offsetLeft}px)`;
      }
    });
  }
  new ResizeObserver(syncBar).observe(bar ?? document.body);

  bar?.querySelector('[data-add-widget]')?.addEventListener('click', () => {
    if (stage.dataset.phase !== 'ready') startDock();
    openGallery();
  });
  bar?.querySelector('[data-open-settings]')?.addEventListener('click', () => openApp('dock-settings'));

  document.querySelectorAll<HTMLElement>('[data-demo-set]').forEach((b) =>
    b.addEventListener('click', () => {
      const [key, value] = b.dataset.demoSet!.split(':');
      stage.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
      setTimeout(() => {
        if (stage.dataset.phase !== 'ready') startDock();
        set(key as keyof typeof state, value);
      }, reduced() ? 0 : 650);
    }),
  );

  document.addEventListener('cd:add-widget', (e) => {
    const { id, variant } = (e as CustomEvent).detail;
    addWidget(id, variant);
  });

  /* ------------------------------------------------------ desk icons */

  stage.querySelectorAll<HTMLElement>('[data-open]').forEach((b) => {
    const open = () => {
      const key = b.dataset.open as WinKey;
      if (key === 'dock-settings' && stage.dataset.phase === 'exited') startDock();
      else openApp(key);
    };
    b.addEventListener('click', (e) => {
      stage.querySelectorAll('.desk-icon').forEach((x) => x.classList.toggle('is-selected', x === b));
      if ((e as PointerEvent).pointerType !== 'mouse' || e.detail === 0) open();
    });
    b.addEventListener('dblclick', open);
  });
  stage.addEventListener('pointerdown', (e) => {
    if (!(e.target as HTMLElement).closest('.desk-icon')) stage.querySelectorAll('.desk-icon').forEach((x) => x.classList.remove('is-selected'));
  });

  /* ------------------------------------------------------------ start */

  render();
  syncBar();
  document.fonts?.ready.then(syncBar);

  const io = new IntersectionObserver(
    (entries) => {
      const vis = entries.some((en) => en.isIntersecting);
      setVisible('stage', vis);
      if (entries.some((en) => en.intersectionRatio >= 0.6)) boot();
    },
    // The boot waits until most of the desktop, dock edge included, is on screen.
    { threshold: [0.2, 0.6] },
  );
  io.observe(stage);
}
