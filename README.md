# 🌿 Serene — my quiet corner of the internet

A personal relaxation website: slow, calming photos and gentle music,
with **everything manageable from a built-in admin panel** — no code needed.

## ✨ Features

- **Gallery** — masonry photo wall with a lightbox; hover to see titles & captions
- **Music player** — a relaxing player with spinning vinyl disc, play/pause,
  seek, volume, auto-advance, and a mini-player bar that follows you as you scroll
- **Hero rotation** — your featured photos slowly crossfade behind the homepage title
- **Light & dark mode** — a one-click toggle that remembers your choice
- **Admin panel** (`/admin.html`) where you can:
  - upload photos & music by dragging files into the browser
  - edit titles, descriptions, artists, durations
  - mark photos as **featured** (they appear in the hero rotation)
  - drag-and-drop to reorder everything
  - change every word on the site (title, tagline, hero text, about, footer)
  - change your admin password

## 🚀 Run it

```bash
npm install
npm start
```

Then open:
- Site: `http://localhost:3000/`
- Admin: `http://localhost:3000/admin.html`

> Default admin password: `relax123` — **change it right away** under *Admin → Settings*.

On first start the site seeds itself with a few original ambient tracks and
calm photos, so it looks good from the very first run.

## 📂 Project structure

```
public/            front end (site + admin panel)
  index.html       the public site
  admin.html       the management panel
  css/  js/        styles & logic
lib/               server-side helpers (store, auth, seeding)
seed/              bundled starter photos & generated ambient audio
scripts/           tooling (e.g. regenerate the seed audio: npm run seed-audio)
uploads/           files you upload via the admin panel (git-ignored)
data/db.json       content database (git-ignored)
server.js          Express server + admin API
```

## 🔒 Privacy & security notes

- Content is stored locally in `uploads/` and `data/db.json` — nothing leaves
  your server.
- Admin session uses an HttpOnly cookie; passwords are stored as salted
  scrypt hashes, never in plain text.
- The site is static-first: visitors only ever read public data through
  `/api/site`, so the admin endpoints stay protected.

Made with quiet intention. 🌙
