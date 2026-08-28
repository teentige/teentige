'use strict';

/* ============================================================
   Serene — public site logic
   ============================================================ */

const $ = (sel) => document.querySelector(sel);

const state = {
  site: null,
  photos: [],
  tracks: [],
  queue: [],
  index: 0,
  playing: false,
  heroTimer: null,
  heroIndex: 0,
  lbIndex: 0,
};

const audio = $('#audio');
const els = {
  navTitle: $('#navTitle'),
  heroKicker: $('#heroKicker'),
  heroTitle: $('#heroTitle'),
  heroSub: $('#heroSub'),
  heroBg: $('#heroBg'),
  galleryGrid: $('#galleryGrid'),
  tracklist: $('#tracklist'),
  nowTitle: $('#nowTitle'),
  nowArtist: $('#nowArtist'),
  disc: $('#disc'),
  discImg: $('#discImg'),
  playBtn: $('#playBtn'),
  prevBtn: $('#prevBtn'),
  nextBtn: $('#nextBtn'),
  seek: $('#seek'),
  curTime: $('#curTime'),
  totTime: $('#totTime'),
  miniPlayer: $('#miniPlayer'),
  miniDisc: $('#miniDisc'),
  miniTitle: $('#miniTitle'),
  miniArtist: $('#miniArtist'),
  miniPlay: $('#miniPlay'),
  miniPrev: $('#miniPrev'),
  miniNext: $('#miniNext'),
  miniSeek: $('#miniSeek'),
  miniVol: $('#miniVol'),
  lightbox: $('#lightbox'),
  lbImg: $('#lbImg'),
  lbTitle: $('#lbTitle'),
  lbDesc: $('#lbDesc'),
  lbClose: $('#lbClose'),
  lbPrev: $('#lbPrev'),
  lbNext: $('#lbNext'),
  aboutText: $('#aboutText'),
  aboutSign: $('#aboutSign'),
  footerText: $('#footerText'),
};

/* ------------------------------------------------------------ helpers */
function fmtTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function setRangeFill(el) {
  const min = parseFloat(el.min) || 0;
  const max = parseFloat(el.max) || 100;
  const val = parseFloat(el.value) || 0;
  el.style.setProperty('--fill', `${((val - min) / (max - min)) * 100}%`);
}

/* ------------------------------------------------------------ safe storage
   Some preview/embedded contexts block localStorage — never let that kill the page. */
const storage = {
  get(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch (_) {}
  },
};

/* ------------------------------------------------------------ theme */
function applyTheme() {
  const dark = storage.get('serene-theme') === 'dark';
  document.documentElement.classList.toggle('dark', dark);
  $('#themeToggle').textContent = dark ? '☀' : '☾';
}
$('#themeToggle').addEventListener('click', () => {
  const dark = document.documentElement.classList.toggle('dark');
  storage.set('serene-theme', dark ? 'dark' : 'light');
  $('#themeToggle').textContent = dark ? '☀' : '☾';
});

/* ------------------------------------------------------------ nav scroll */
function onScroll() {
  $('#nav').classList.toggle('scrolled', window.scrollY > 40);
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ------------------------------------------------------------ load site data */
async function loadSite() {
  let data;
  try {
    const res = await fetch('/api/site');
    if (!res.ok) throw new Error('no api');
    data = await res.json();
  } catch (_) {
    // No server (static export on GitHub Pages etc.) — use the frozen snapshot.
    // Static hosts often serve the index at a path without a trailing slash,
    // which would break relative asset URLs, so normalize it first.
    if (!location.pathname.endsWith('/')) {
      location.replace(location.pathname + '/');
      return;
    }
    const res = await fetch('data/site.json');
    if (!res.ok) throw new Error('No site data found');
    data = await res.json();
  }
  state.site = data.settings;
  state.photos = data.photos;
  state.tracks = data.tracks;
  renderStatic();
  renderHero();
  renderGallery();
  renderTracks();
  initReveal();
}

function renderStatic() {
  const s = state.site;
  document.title = s.siteTitle;
  els.navTitle.textContent = s.siteTitle;
  els.heroKicker.textContent = s.siteTagline;
  els.heroTitle.textContent = s.heroTitle;
  els.heroSub.textContent = s.heroSubtitle;
  els.aboutText.textContent = s.about;
  els.aboutSign.textContent = `— ${s.siteTitle}`;
  els.footerText.textContent = s.footerText;
}

/* ------------------------------------------------------------ hero rotation */
function renderHero() {
  els.heroBg.innerHTML = '';
  const featured = state.photos.filter((p) => p.featured);
  const pool = featured.length ? featured : state.photos.slice(0, 3);
  if (!pool.length) {
    els.heroBg.style.background =
      'linear-gradient(135deg, #22302a, #4c6b4e 55%, #2a3a33)';
    return;
  }
  // preload
  pool.forEach((p) => { const img = new Image(); img.src = p.url; });

  pool.forEach((p, i) => {
    const div = document.createElement('div');
    div.className = 'hero-slide' + (i === 0 ? ' active' : '');
    div.style.backgroundImage = `url("${p.url}")`;
    els.heroBg.appendChild(div);
  });

  clearInterval(state.heroTimer);
  state.heroIndex = 0;
  state.heroTimer = setInterval(() => {
    if (pool.length < 2) return;
    const slides = els.heroBg.children;
    slides[state.heroIndex].classList.remove('active');
    state.heroIndex = (state.heroIndex + 1) % pool.length;
    slides[state.heroIndex].classList.add('active');
  }, 8000);
}

/* ------------------------------------------------------------ gallery */
function renderGallery() {
  els.galleryGrid.innerHTML = '';
  if (!state.photos.length) {
    els.galleryGrid.innerHTML =
      '<div class="empty-state" style="grid-column:1/-1">No photos yet — the owner can add them from the manage panel.</div>';
    return;
  }
  state.photos.forEach((p, i) => {
    const card = document.createElement('figure');
    card.className = 'photo-card reveal';
    card.dataset.i = i;
    card.innerHTML = `
      ${p.featured ? '<span class="photo-feat">featured</span>' : ''}
      <img src="${p.url}" alt="${esc(p.title)}" loading="lazy" />
      <figcaption class="photo-cap">
        <h3>${esc(p.title)}</h3>
        ${p.description ? `<p>${esc(p.description)}</p>` : ''}
      </figcaption>`;
    card.addEventListener('click', () => openLightbox(i));
    els.galleryGrid.appendChild(card);
  });
  initReveal();
}

/* ------------------------------------------------------------ lightbox */
function openLightbox(i) {
  state.lbIndex = i;
  const p = state.photos[i];
  if (!p) return;
  els.lbImg.src = p.url;
  els.lbImg.alt = p.title;
  els.lbTitle.textContent = p.title;
  els.lbDesc.textContent = p.description || '';
  els.lightbox.classList.add('open');
  els.lightbox.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  els.lightbox.classList.remove('open');
  els.lightbox.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}
function stepLightbox(dir) {
  const n = state.photos.length;
  if (!n) return;
  openLightbox((state.lbIndex + dir + n) % n);
}
els.lbClose.addEventListener('click', closeLightbox);
els.lbPrev.addEventListener('click', (e) => { e.stopPropagation(); stepLightbox(-1); });
els.lbNext.addEventListener('click', (e) => { e.stopPropagation(); stepLightbox(1); });
els.lightbox.addEventListener('click', (e) => { if (e.target === els.lightbox) closeLightbox(); });
document.addEventListener('keydown', (e) => {
  if (!els.lightbox.classList.contains('open')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') stepLightbox(-1);
  if (e.key === 'ArrowRight') stepLightbox(1);
});

/* ------------------------------------------------------------ music player */
function renderTracks() {
  els.tracklist.innerHTML = '';
  if (!state.tracks.length) {
    els.tracklist.innerHTML =
      '<li class="empty-state" style="margin-top:20px">No music yet — the owner can add tracks from the manage panel.</li>';
    return;
  }
  state.tracks.forEach((t, i) => {
    const li = document.createElement('li');
    li.className = 'track';
    li.dataset.i = i;
    li.innerHTML = `
      <span class="track-num">${String(i + 1).padStart(2, '0')}</span>
      <span class="eq" aria-hidden="true"><span></span><span></span><span></span><span></span></span>
      <span class="track-meta"><b>${esc(t.title)}</b><span>${esc(t.artist || '')}</span></span>
      <span class="track-dur">${fmtTime(t.duration)}</span>`;
    li.addEventListener('click', () => playTrack(i));
    els.tracklist.appendChild(li);
  });
  state.queue = state.tracks;
}

function setDiscImage() {
  const cover = state.site?.coverUrl;
  if (cover) {
    els.discImg.src = cover;
    els.miniDisc.src = cover;
  } else if (state.tracks.length) {
    els.discImg.src = state.tracks[0].url; // fallback: won't render, shows bg
  }
}

function playTrack(i) {
  if (!state.queue.length) return;
  state.index = i;
  const t = state.queue[i];
  audio.src = t.url;
  audio.volume = parseFloat(els.miniVol.value) || 0.8;
  audio.play().catch(() => {});
  els.nowTitle.textContent = t.title;
  els.nowArtist.textContent = t.artist || '';
  els.miniTitle.textContent = t.title;
  els.miniArtist.textContent = t.artist || '';
  els.disc.classList.add('spinning');
  els.miniPlayer.classList.add('show');
  updateTracklistUI();
}

function updateTracklistUI() {
  [...els.tracklist.children].forEach((li, i) => {
    li.classList.toggle('playing', i === state.index && state.playing);
    const num = li.querySelector('.track-num');
    if (i === state.index) num.textContent = state.playing ? '♪' : '▮▮';
    else num.textContent = String(i + 1).padStart(2, '0');
  });
}

function togglePlay() {
  if (!state.queue.length) return;
  if (audio.src) {
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  } else {
    playTrack(0);
  }
}
function nextTrack() { if (state.queue.length) playTrack((state.index + 1) % state.queue.length); }
function prevTrack() {
  if (!state.queue.length) return;
  if (audio.currentTime > 4) { audio.currentTime = 0; return; }
  playTrack((state.index - 1 + state.queue.length) % state.queue.length);
}

audio.addEventListener('play', () => {
  state.playing = true;
  els.playBtn.textContent = '❚❚';
  els.miniPlay.textContent = '❚❚';
  els.disc.classList.add('spinning');
  updateTracklistUI();
});
audio.addEventListener('pause', () => {
  state.playing = false;
  els.playBtn.textContent = '▶';
  els.miniPlay.textContent = '▶';
  els.disc.classList.remove('spinning');
  updateTracklistUI();
});
audio.addEventListener('ended', () => nextTrack());
audio.addEventListener('loadedmetadata', () => {
  els.totTime.textContent = fmtTime(audio.duration);
});
audio.addEventListener('timeupdate', () => {
  if (!audio.duration) return;
  els.seek.value = audio.currentTime;
  els.miniSeek.value = audio.currentTime;
  els.curTime.textContent = fmtTime(audio.currentTime);
  setRangeFill(els.seek);
  setRangeFill(els.miniSeek);
});
audio.addEventListener('error', () => {
  els.nowTitle.textContent = 'Track unavailable';
});

els.playBtn.addEventListener('click', togglePlay);
els.miniPlay.addEventListener('click', togglePlay);
els.prevBtn.addEventListener('click', prevTrack);
els.nextBtn.addEventListener('click', nextTrack);
els.miniPrev.addEventListener('click', prevTrack);
els.miniNext.addEventListener('click', nextTrack);

els.seek.addEventListener('input', () => {
  if (audio.duration) audio.currentTime = parseFloat(els.seek.value);
  setRangeFill(els.seek);
});
els.miniSeek.addEventListener('input', () => {
  if (audio.duration) audio.currentTime = parseFloat(els.miniSeek.value);
  setRangeFill(els.miniSeek);
});
els.miniVol.addEventListener('input', () => {
  audio.volume = parseFloat(els.miniVol.value) || 0;
  els.miniVol.style.setProperty('--fill', `${(audio.volume * 100)}%`);
});

/* ------------------------------------------------------------ reveal on scroll */
function initReveal() {
  if (typeof IntersectionObserver === 'undefined') {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  document.querySelectorAll('.reveal:not(.in)').forEach((el) => io.observe(el));
}

/* ------------------------------------------------------------ misc */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    applyTheme();
    setRangeFill(els.seek);
    setRangeFill(els.miniSeek);
    setRangeFill(els.miniVol);
    loadSite().catch((err) => {
      console.error('Failed to load site data', err);
      const banner = $('#siteError');
      banner.textContent = 'Could not load the site content. Please refresh in a moment.';
      banner.hidden = false;
    });
  } catch (err) {
    console.error('Site init error', err);
  }
});
