'use strict';

/**
 * Exports the site as a fully static snapshot into docs/.
 * Works on any static host (GitHub Pages, Netlify, Vercel, etc.):
 *   - all current photos, music, cover art copied from uploads/
 *   - frozen site data written to docs/data/site.json
 *   - the frontend automatically uses site.json when no API server is present
 *
 * Usage: node scripts/export-static.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs');
const UPLOADS = path.join(ROOT, 'uploads');
const { loadDb } = require('../lib/store');

function cpDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    if (fs.statSync(s).isDirectory()) cpDir(s, path.join(dest, name));
    else fs.copyFileSync(s, path.join(dest, name));
  }
}

function toPublicPhoto(p) {
  return { id: p.id, title: p.title, description: p.description, url: `uploads/photos/${p.file}`, featured: !!p.featured };
}
function toPublicTrack(t) {
  return { id: t.id, title: t.title, artist: t.artist, url: `uploads/music/${t.file}`, duration: t.duration };
}

function main() {
  const db = loadDb();

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });

  // frontend files
  cpDir(path.join(ROOT, 'public'), OUT);

  // media
  if (fs.existsSync(UPLOADS)) cpDir(UPLOADS, path.join(OUT, 'uploads'));

  // frozen data (same shape as GET /api/site, but relative URLs)
  const coverUrl = fs.existsSync(path.join(UPLOADS, 'cover.jpg')) ? 'uploads/cover.jpg' : null;
  const site = {
    settings: { ...db.settings, coverUrl },
    photos: db.photos.slice().sort((a, b) => a.order - b.order).map(toPublicPhoto),
    tracks: db.tracks.slice().sort((a, b) => a.order - b.order).map(toPublicTrack),
  };
  fs.writeFileSync(path.join(OUT, 'data', 'site.json'), JSON.stringify(site, null, 2));
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

  const sizeMB = (fs.statSync(path.join(OUT, 'data', 'site.json')).size / 1024).toFixed(1);
  console.log(`✅ Exported static site to docs/`);
  console.log(`   ${site.photos.length} photos, ${site.tracks.length} tracks, cover: ${coverUrl ? 'yes' : 'no'}`);
  console.log(`   site.json: ${sizeMB} KB`);
}

main();
