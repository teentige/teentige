'use strict';

/**
 * First-boot seed: copies the bundled seed photos/music into uploads/
 * and creates data/db.json so the site works out of the box.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SEED = path.join(ROOT, 'seed');
const UPLOADS = path.join(ROOT, 'uploads');
const { loadDb, saveDb, DB_PATH } = require('./store');
const { hashPassword, DEFAULT_PASSWORD } = require('./auth');

function copyInto(fromDir, toDir, urlPrefix) {
  const out = [];
  if (!fs.existsSync(fromDir)) return out;
  fs.mkdirSync(toDir, { recursive: true });
  const entries = fs.readdirSync(fromDir).filter((f) => !f.startsWith('.')).sort();
  for (const name of entries) {
    const src = path.join(fromDir, name);
    if (!fs.statSync(src).isFile()) continue;
    const file = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${name}`;
    fs.copyFileSync(src, path.join(toDir, file));
    out.push({ file, originalName: name, url: `${urlPrefix}/${file}` });
  }
  return out;
}

function ensureSeeded() {
  if (fs.existsSync(DB_PATH)) return false;

  console.log('🌱 No database found — seeding with starter content...');

  fs.mkdirSync(path.join(UPLOADS, 'photos'), { recursive: true });
  fs.mkdirSync(path.join(UPLOADS, 'music'), { recursive: true });

  // Cover art for the player
  if (fs.existsSync(path.join(SEED, 'cover.jpg'))) {
    fs.copyFileSync(path.join(SEED, 'cover.jpg'), path.join(UPLOADS, 'cover.jpg'));
  }

  const photos = copyInto(path.join(SEED, 'photos'), path.join(UPLOADS, 'photos'), '/uploads/photos');
  const tracks = copyInto(path.join(SEED, 'music'), path.join(UPLOADS, 'music'), '/uploads/music');

  const photoMeta = {
    'misty-forest': { title: 'Misty Morning Forest', description: 'Soft light filtering through ancient pines.', featured: true },
    'golden-horizon': { title: 'Golden Horizon', description: 'The ocean breathing at the edge of the sky.', featured: true },
    'mirror-lake': { title: 'Mirror Lake', description: 'Mountains reflected in perfectly still water.', featured: false },
    'starry-night': { title: 'A Thousand Stars', description: 'A quiet night above the sleeping hills.', featured: true },
    'river-stones': { title: 'River of Stones', description: 'Slow water over smooth, patient stone.', featured: false },
    'lavender-dusk': { title: 'Lavender Dusk', description: 'A field settling into evening.', featured: false },
  };

  const trackMeta = {
    'moonlit-waves': { title: 'Moonlit Waves', artist: 'Serene Fields' },
    'forest-breeze': { title: 'Forest Breeze', artist: 'Serene Fields' },
    'starlight-drift': { title: 'Starlight Drift', artist: 'Serene Fields' },
  };

  const db = loadDb();
  db.password = hashPassword(DEFAULT_PASSWORD);
  db.photos = photos.map((p, i) => {
    const stem = p.originalName.replace(/\.[^.]+$/, '');
    return {
      id: require('crypto').randomUUID(),
      ...p,
      ...(photoMeta[stem] || {}),
      order: i,
      createdAt: Date.now(),
    };
  });
  db.tracks = tracks.map((t, i) => {
    const stem = t.originalName.replace(/\.[^.]+$/, '');
    return {
      id: require('crypto').randomUUID(),
      ...t,
      ...(trackMeta[stem] || {}),
      duration: wavDuration(path.join(UPLOADS, 'music', t.file)),
      order: i,
      createdAt: Date.now(),
    };
  });
  db.settings.coverUrl = fs.existsSync(path.join(UPLOADS, 'cover.jpg')) ? '/uploads/cover.jpg' : null;

  saveDb(db);
  console.log(`✅ Seeded ${db.photos.length} photos and ${db.tracks.length} tracks.`);
  console.log(`🔑 Default admin password is '${DEFAULT_PASSWORD}' — change it under Admin → Settings.`);
  return true;
}

function wavDuration(file) {
  try {
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(12);
    fs.readSync(fd, buf, 0, 12, 40); // data chunk size at file offset 40
    const dataSize = buf.readUInt32LE(0);
    const srBuf = Buffer.alloc(4);
    fs.readSync(fd, srBuf, 0, 4, 24); // sample rate
    fs.closeSync(fd);
    const sr = srBuf.readUInt32LE(0);
    if (sr > 0) return Math.round(dataSize / 2 / sr); // 16-bit mono → 2 bytes per sample
  } catch (_) {
    /* ignore */
  }
  return null;
}

module.exports = { ensureSeeded };

if (require.main === module) {
  ensureSeeded();
}
