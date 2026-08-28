# 🌿 Hi, I'm king Titus 👋

Welcome to my little corner of the internet. This repository is both my GitHub
profile card and the home of **Serene** — my relaxation site: calm photos and
gentle music, with everything managed from a built-in admin panel.

- 🖼 **The site:** a quiet gallery of photos and a relaxing music player
- 🎛 **The admin panel:** upload photos & music, edit texts, reorder — all from your browser
- 🚀 **Run it anywhere:** it's a small Node.js app (works on Glitch, Render, your own computer…)

## 🏃 Quick start

```bash
npm install
npm start
```

Then open:
- Site: `http://localhost:3000/`
- Admin: `http://localhost:3000/admin.html` — default password `relax123` (change it!)

## ✨ Features

- **Gallery** — masonry photo wall with lightbox
- **Music player** — spinning disc, seek, volume, auto-advance + mini-player bar
- **Hero rotation** — your featured photos slowly crossfade behind the title
- **Light & dark mode**
- **Admin panel** — drag & drop photo/music uploads, drag-to-reorder, mark photos
  "featured", edit every text on the site, change the password
- **Static export** — `npm run export` builds a `docs/` folder you can host
  anywhere for free (GitHub Pages, Netlify…)

## 📂 Structure

```
public/     site + admin panel (HTML/CSS/JS)
lib/        server helpers (data store, auth, seeding)
seed/       bundled starter photos & original ambient audio
scripts/    tooling (seed audio generator, static export)
server.js   Express server + admin API
docs/       static export (for free static hosting)
```

Made with quiet intention. 🌙
