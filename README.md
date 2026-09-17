# DockHub website

Landing page and interactive Windows 11 demo for [DockHub](https://github.com/sametgurtuna/DockHub), built with [Astro](https://astro.build/).

Live: https://sametgurtuna.github.io/dockhub-website/

## Develop

Requires Node.js 22.12 or later.

```sh
npm install
npm run dev
```

The dev server runs at `http://localhost:4321/dockhub-website/`. Add `?static` to the URL to disable animations (useful for screenshots).

## Build

```sh
npm run build
```

The static site is written to `dist/`. Every push to `main` builds and deploys it to GitHub Pages through `.github/workflows/deploy.yml`.

## Structure

| Path | Purpose |
|---|---|
| `src/pages/index.astro` | Page composition |
| `src/components/` | Sections (Hero, Modes, Widgets, Bento, Safety, Faq, Cta, Footer), the demo stage (`Desktop.astro`), the Bloom wallpaper and the wordmark |
| `src/scripts/` | Demo engine (`demo.ts`), widget renderers (`widgets.ts`), simulated data (`sim.ts`), mini stages and the widget gallery |
| `src/styles/` | Page tokens (`global.css`) and the Windows 11 demo world (`demo.css`) |
| `src/lib/site.ts` | Download and repository links |

Weather, system values and media tracks in the demo are sample data; the clock is real.
