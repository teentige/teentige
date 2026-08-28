'use strict';

/**
 * Serene — a personal relaxation site.
 * Serves the public site + music player, and a full admin API
 * so the owner can manage every photo, track and setting from the browser.
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const { loadDb, saveDb } = require('./lib/store');
const { DEFAULT_PASSWORD, TOKEN_TTL_MS, hashPassword, verifyPassword, newToken } = require('./lib/auth');
const { ensureSeeded } = require('./lib/seed');

const ROOT = __dirname;
const UPLOADS = path.join(ROOT, 'uploads');
const PORT = process.env.PORT || 3000;

fs.mkdirSync(path.join(UPLOADS, 'photos'), { recursive: true });
fs.mkdirSync(path.join(UPLOADS, 'music'), { recursive: true });
ensureSeeded();

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

// ---------------------------------------------------------------- static files
app.use(express.static(path.join(ROOT, 'public')));
app.use(
  '/uploads',
  express.static(UPLOADS, {
    setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache'),
  })
);

// ---------------------------------------------------------------- session tokens
const tokens = new Map(); // token -> expiry

function readCookies(req) {
  const raw = req.headers.cookie || '';
  const out = {};
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx > -1) out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function isAuthed(req) {
  const token = readCookies(req).admin_token;
  if (!token) return false;
  const exp = tokens.get(token);
  if (!exp) return false;
  if (exp < Date.now()) {
    tokens.delete(token);
    return false;
  }
  return true;
}

function authRequired(req, res, next) {
  if (isAuthed(req)) return next();
  res.status(401).json({ error: 'Not authenticated' });
}

// ---------------------------------------------------------------- uploads
const MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/ogg': '.ogg',
  'audio/webm': '.webm',
  'audio/mp4': '.m4a',
  'audio/aac': '.aac',
  'audio/flac': '.flac',
  'audio/x-m4a': '.m4a',
};

function makeUploader(subdir, kind) {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(UPLOADS, subdir)),
    filename: (req, file, cb) => {
      const ext = MIME_EXT[file.mimetype] || path.extname(file.originalname).toLowerCase().slice(0, 8) || '';
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  });
  return multer({
    storage,
    limits: { fileSize: kind === 'photo' ? 20 * 1024 * 1024 : 60 * 1024 * 1024, files: 30 },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const extOk =
        kind === 'photo'
          ? ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'].includes(ext)
          : ['.mp3', '.wav', '.ogg', '.oga', '.webm', '.m4a', '.aac', '.flac', '.aiff', '.opus'].includes(ext);
      const ok = file.mimetype.startsWith(kind === 'photo' ? 'image/' : 'audio/') || extOk;
      cb(ok ? null : new Error(`Unsupported file type: ${file.mimetype || file.originalname || 'unknown'}`), ok);
    },
  });
}

const uploadPhoto = makeUploader('photos', 'photo');
const uploadTrack = makeUploader('music', 'track');

// ---------------------------------------------------------------- helpers
const toPublicPhoto = (p) => ({ id: p.id, title: p.title, description: p.description, url: p.url, featured: !!p.featured });
const toPublicTrack = (t) => ({ id: t.id, title: t.title, artist: t.artist, url: t.url, duration: t.duration });

function getCoverUrl(db) {
  if (fs.existsSync(path.join(UPLOADS, 'cover.jpg'))) return '/uploads/cover.jpg';
  return null;
}

function logAdmin(action) {
  console.log(`[admin] ${action}`);
}

// ---------------------------------------------------------------- public API
app.get('/api/site', (req, res) => {
  const db = loadDb();
  const s = db.settings;
  res.json({
    settings: {
      siteTitle: s.siteTitle,
      siteTagline: s.siteTagline,
      heroTitle: s.heroTitle,
      heroSubtitle: s.heroSubtitle,
      about: s.about,
      footerText: s.footerText,
      coverUrl: getCoverUrl(db),
    },
    photos: db.photos
      .slice()
      .sort((a, b) => a.order - b.order)
      .map(toPublicPhoto),
    tracks: db.tracks
      .slice()
      .sort((a, b) => a.order - b.order)
      .map(toPublicTrack),
  });
});

// ---------------------------------------------------------------- admin: auth
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (typeof password !== 'string') return res.status(400).json({ error: 'Password required' });
  const db = loadDb();
  if (!db.password) {
    // First boot fallback: seed already sets a password, but be safe.
    db.password = hashPassword(DEFAULT_PASSWORD);
    saveDb(db);
  }
  if (!verifyPassword(password, db.password)) {
    logAdmin('failed login attempt');
    return res.status(401).json({ error: 'Incorrect password' });
  }
  const token = newToken();
  tokens.set(token, Date.now() + TOKEN_TTL_MS);
  res.setHeader(
    'Set-Cookie',
    `admin_token=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(TOKEN_TTL_MS / 1000)}`
  );
  logAdmin('login');
  res.json({ ok: true });
});

app.post('/api/admin/logout', (req, res) => {
  const token = readCookies(req).admin_token;
  if (token) tokens.delete(token);
  res.setHeader('Set-Cookie', 'admin_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/admin/me', (req, res) => {
  if (!isAuthed(req)) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ ok: true });
});

// ---------------------------------------------------------------- admin: photos
app.get('/api/admin/photos', authRequired, (req, res) => {
  const db = loadDb();
  res.json(db.photos.slice().sort((a, b) => a.order - b.order));
});

app.post('/api/admin/photos', authRequired, uploadPhoto.array('files', 30), (req, res) => {
  const db = loadDb();
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ error: 'No files uploaded' });
  const startOrder = db.photos.reduce((m, p) => Math.max(m, p.order), -1) + 1;
  const created = files.map((f, i) => {
    const base = path.basename(f.originalname, path.extname(f.originalname)).replace(/[_-]+/g, ' ').trim();
    const photo = {
      id: crypto.randomUUID(),
      file: f.filename,
      originalName: f.originalname,
      url: `/uploads/photos/${f.filename}`,
      title: base || 'Untitled',
      description: '',
      featured: false,
      order: startOrder + i,
      createdAt: Date.now(),
    };
    db.photos.push(photo);
    return photo;
  });
  saveDb(db);
  logAdmin(`added ${created.length} photo(s)`);
  res.json({ ok: true, photos: created });
});

app.patch('/api/admin/photos/:id', authRequired, (req, res) => {
  const db = loadDb();
  const p = db.photos.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Photo not found' });
  const { title, description, featured } = req.body || {};
  if (typeof title === 'string' && title.trim()) p.title = title.trim().slice(0, 120);
  if (typeof description === 'string') p.description = description.trim().slice(0, 400);
  if (typeof featured === 'boolean') p.featured = featured;
  saveDb(db);
  logAdmin(`updated photo ${p.title}`);
  res.json({ ok: true, photo: p });
});

app.delete('/api/admin/photos/:id', authRequired, (req, res) => {
  const db = loadDb();
  const idx = db.photos.findIndex((x) => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Photo not found' });
  const [removed] = db.photos.splice(idx, 1);
  try {
    fs.unlinkSync(path.join(UPLOADS, 'photos', removed.file));
  } catch (_) {}
  db.photos.forEach((p, i) => (p.order = i));
  saveDb(db);
  logAdmin(`deleted photo ${removed.title}`);
  res.json({ ok: true });
});

app.post('/api/admin/photos/reorder', authRequired, (req, res) => {
  const db = loadDb();
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const byId = new Map(db.photos.map((p) => [p.id, p]));
  const next = [];
  for (const id of ids) {
    if (byId.has(id)) next.push(byId.get(id));
  }
  for (const p of db.photos) if (!next.includes(p)) next.push(p);
  next.forEach((p, i) => (p.order = i));
  db.photos = next;
  saveDb(db);
  logAdmin('reordered photos');
  res.json({ ok: true });
});

// ---------------------------------------------------------------- admin: music
app.get('/api/admin/tracks', authRequired, (req, res) => {
  const db = loadDb();
  res.json(db.tracks.slice().sort((a, b) => a.order - b.order));
});

app.post('/api/admin/tracks', authRequired, uploadTrack.array('files', 30), (req, res) => {
  const db = loadDb();
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ error: 'No files uploaded' });
  const startOrder = db.tracks.reduce((m, t) => Math.max(m, t.order), -1) + 1;
  const created = files.map((f, i) => {
    const base = path.basename(f.originalname, path.extname(f.originalname)).replace(/[_-]+/g, ' ').trim();
    const track = {
      id: crypto.randomUUID(),
      file: f.filename,
      originalName: f.originalname,
      url: `/uploads/music/${f.filename}`,
      title: base || 'Untitled',
      artist: 'Unknown artist',
      duration: wavDuration(path.join(UPLOADS, 'music', f.filename)),
      order: startOrder + i,
      createdAt: Date.now(),
    };
    db.tracks.push(track);
    return track;
  });
  saveDb(db);
  logAdmin(`added ${created.length} track(s)`);
  res.json({ ok: true, tracks: created });
});

app.patch('/api/admin/tracks/:id', authRequired, (req, res) => {
  const db = loadDb();
  const t = db.tracks.find((x) => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Track not found' });
  const { title, artist, duration } = req.body || {};
  if (typeof title === 'string' && title.trim()) t.title = title.trim().slice(0, 120);
  if (typeof artist === 'string') t.artist = artist.trim().slice(0, 120);
  if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) t.duration = Math.round(duration);
  saveDb(db);
  logAdmin(`updated track ${t.title}`);
  res.json({ ok: true, track: t });
});

app.delete('/api/admin/tracks/:id', authRequired, (req, res) => {
  const db = loadDb();
  const idx = db.tracks.findIndex((x) => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Track not found' });
  const [removed] = db.tracks.splice(idx, 1);
  try {
    fs.unlinkSync(path.join(UPLOADS, 'music', removed.file));
  } catch (_) {}
  db.tracks.forEach((t, i) => (t.order = i));
  saveDb(db);
  logAdmin(`deleted track ${removed.title}`);
  res.json({ ok: true });
});

app.post('/api/admin/tracks/reorder', authRequired, (req, res) => {
  const db = loadDb();
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const byId = new Map(db.tracks.map((t) => [t.id, t]));
  const next = [];
  for (const id of ids) {
    if (byId.has(id)) next.push(byId.get(id));
  }
  for (const t of db.tracks) if (!next.includes(t)) next.push(t);
  next.forEach((t, i) => (t.order = i));
  db.tracks = next;
  saveDb(db);
  logAdmin('reordered tracks');
  res.json({ ok: true });
});

// ---------------------------------------------------------------- admin: settings
app.get('/api/admin/settings', authRequired, (req, res) => {
  const db = loadDb();
  res.json({ settings: db.settings, hasPassword: !!db.password });
});

app.patch('/api/admin/settings', authRequired, (req, res) => {
  const db = loadDb();
  const body = req.body || {};
  const s = db.settings;
  const allowed = ['siteTitle', 'siteTagline', 'heroTitle', 'heroSubtitle', 'about', 'footerText'];
  for (const key of allowed) {
    if (typeof body[key] === 'string') s[key] = body[key].trim().slice(0, 500);
  }
  saveDb(db);
  logAdmin('updated settings');
  res.json({ ok: true, settings: s });
});

app.post('/api/admin/password', authRequired, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const db = loadDb();
  if (typeof currentPassword !== 'string' || !verifyPassword(currentPassword, db.password)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  db.password = hashPassword(newPassword);
  saveDb(db);
  logAdmin('changed password');
  res.json({ ok: true });
});

// ---------------------------------------------------------------- misc
app.get('/api/health', (req, res) => res.json({ ok: true }));

// 404 for unknown API routes
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

app.use((err, req, res, next) => {
  if (err) {
    const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 400);
    return res.status(status).json({ error: err.message || 'Upload failed' });
  }
  next();
});

// SPA-style fallback so /admin and deep links work
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
  res.sendFile(path.join(ROOT, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌿 Serene is running at http://0.0.0.0:${PORT}`);
  console.log(`   Public site:  http://localhost:${PORT}/`);
  console.log(`   Admin panel:  http://localhost:${PORT}/admin.html  (default password: ${DEFAULT_PASSWORD})`);
});

function wavDuration(file) {
  try {
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(12);
    fs.readSync(fd, buf, 0, 12, 40);
    const dataSize = buf.readUInt32LE(0);
    const srBuf = Buffer.alloc(4);
    fs.readSync(fd, srBuf, 0, 4, 24);
    fs.closeSync(fd);
    const sr = srBuf.readUInt32LE(0);
    if (sr > 0) return Math.round(dataSize / 2 / sr);
  } catch (_) {}
  return null;
}
