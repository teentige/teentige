'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(ROOT, 'data', 'db.json');

function defaults() {
  return {
    password: null, // { hash, salt }
    settings: {
      siteTitle: 'Serene',
      siteTagline: 'a quiet place to breathe',
      heroTitle: 'Breathe in. Let go.',
      heroSubtitle: 'Photos and music to slow your day down — made and curated by me, for you.',
      about:
        'This is my little corner of the internet. A place where the photos are slow and the music is softer. Take a breath, look around, and stay as long as you like.',
      footerText: 'Made with quiet intention.',
    },
    photos: [],
    tracks: [],
  };
}

function loadDb() {
  if (!fs.existsSync(DB_PATH)) return defaults();
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const base = defaults();
    return Object.assign(base, parsed, {
      settings: Object.assign(base.settings, parsed.settings || {}),
      photos: Array.isArray(parsed.photos) ? parsed.photos : [],
      tracks: Array.isArray(parsed.tracks) ? parsed.tracks : [],
    });
  } catch (err) {
    console.error('Could not read data/db.json:', err.message);
    return defaults();
  }
}

function saveDb(db) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const tmp = DB_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_PATH);
}

module.exports = { loadDb, saveDb, DB_PATH };
