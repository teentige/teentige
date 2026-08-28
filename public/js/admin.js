'use strict';

/* ============================================================
   Serene — admin panel logic
   ============================================================ */

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const state = {
  photos: [],
  tracks: [],
  settings: {},
  tab: 'dashboard',
  orderDirty: { photos: false, tracks: false },
};

let toastTimer = null;

/* ------------------------------------------------------------ helpers */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function toast(msg, isErr = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.toggle('err', isErr);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 3200);
}

async function api(path, opts = {}) {
  const res = await fetch(path, opts);
  let data = null;
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/* ------------------------------------------------------------ auth flow */
async function checkAuth() {
  try {
    await api('/api/admin/me');
    $('#loginScreen').style.display = 'none';
    $('#adminApp').hidden = false;
    init();
  } catch (_) {
    $('#loginScreen').style.display = 'grid';
  }
}

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = $('#loginPassword').value;
  $('#loginError').textContent = '';
  try {
    await api('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    $('#loginScreen').style.display = 'none';
    $('#adminApp').hidden = false;
    $('#loginPassword').value = '';
    init();
  } catch (err) {
    $('#loginError').textContent = err.message;
  }
});

$('#logoutBtn').addEventListener('click', async () => {
  try { await api('/api/admin/logout', { method: 'POST' }); } catch (_) {}
  location.reload();
});

/* ------------------------------------------------------------ tabs */
function switchTab(name) {
  state.tab = name;
  $$('.side-link[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  $$('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === `tab-${name}`));
  if (name === 'dashboard') refreshDashboard();
}
$$('.side-link[data-tab]').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
$$('[data-goto]').forEach((a) =>
  a.addEventListener('click', (e) => {
    e.preventDefault();
    switchTab(a.dataset.goto);
  })
);

/* ------------------------------------------------------------ dashboard */
async function refreshDashboard() {
  try {
    const [photos, tracks] = await Promise.all([api('/api/admin/photos'), api('/api/admin/tracks')]);
    $('#statPhotos').textContent = photos.length;
    $('#statTracks').textContent = tracks.length;
    $('#statFeatured').textContent = photos.filter((p) => p.featured).length;
    const s = await api('/api/admin/settings');
    $('#sideBrand').textContent = s.settings.siteTitle || 'Serene';
  } catch (err) {
    if (err.status === 401) return location.reload();
  }
}

/* ------------------------------------------------------------ photos */
function renderPhotos() {
  const grid = $('#photoGrid');
  grid.innerHTML = '';
  if (!state.photos.length) {
    grid.innerHTML = '<div class="empty" style="color:var(--ink-soft);grid-column:1/-1;text-align:center;padding:30px">No photos yet — drop some above ☝</div>';
    return;
  }
  state.photos.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.draggable = true;
    card.dataset.id = p.id;
    card.innerHTML = `
      <img src="${p.url}" alt="${esc(p.title)}" loading="lazy" />
      ${p.featured ? '<span class="item-feat">featured</span>' : ''}
      <div class="item-badges">
        <button class="badge star ${p.featured ? 'on' : ''}" title="Toggle featured">★</button>
        <button class="badge edit" title="Edit">✎</button>
        <button class="badge del" title="Delete">✕</button>
      </div>
      <div class="item-body">
        <div class="item-title">${esc(p.title)}</div>
        <div class="item-sub">${p.description ? esc(p.description) : 'No description'}</div>
      </div>`;
    card.querySelector('.star').addEventListener('click', async () => {
      const next = !p.featured;
      try {
        await api(`/api/admin/photos/${p.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ featured: next }),
        });
        p.featured = next;
        renderPhotos();
        toast(next ? 'Marked as featured ★' : 'Removed from featured');
      } catch (err) { toast(err.message, true); }
    });
    card.querySelector('.edit').addEventListener('click', () => openEditor('photo', p.id));
    card.querySelector('.del').addEventListener('click', () => deleteItem('photo', p.id));
    attachDrag(card, 'photos');
    grid.appendChild(card);
  });
}

/* ------------------------------------------------------------ tracks */
function renderTracks() {
  const list = $('#trackList');
  list.innerHTML = '';
  if (!state.tracks.length) {
    list.innerHTML = '<div class="empty" style="color:var(--ink-soft);text-align:center;padding:30px">No music yet — drop some above ☝</div>';
    return;
  }
  state.tracks.forEach((t) => {
    const row = document.createElement('div');
    row.className = 'track-row';
    row.draggable = true;
    row.dataset.id = t.id;
    row.innerHTML = `
      <span class="track-order">${String(t.order + 1).padStart(2, '0')}</span>
      <div class="track-info"><b>${esc(t.title)}</b><span>${esc(t.artist || 'Unknown artist')}</span></div>
      <span class="track-dur">${fmtDur(t.duration)}</span>
      <div class="item-badges" style="position:static;display:flex;gap:6px">
        <button class="badge edit" style="opacity:1;transform:none" title="Edit">✎</button>
        <button class="badge del" style="opacity:1;transform:none" title="Delete">✕</button>
      </div>`;
    row.querySelector('.edit').addEventListener('click', () => openEditor('track', t.id));
    row.querySelector('.del').addEventListener('click', () => deleteItem('track', t.id));
    attachDrag(row, 'tracks');
    list.appendChild(row);
  });
}

function fmtDur(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* ------------------------------------------------------------ drag & drop reorder */
function attachDrag(el, kind) {
  el.addEventListener('dragstart', (e) => {
    el.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', el.dataset.id);
    e.dataTransfer.setData('kind', kind);
  });
  el.addEventListener('dragend', () => el.classList.remove('dragging'));
  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    el.classList.add('drag-over');
  });
  el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    el.classList.remove('drag-over');
    const fromId = e.dataTransfer.getData('text/plain');
    const toId = el.dataset.id;
    const arr = kind === 'photos' ? state.photos : state.tracks;
    const from = arr.findIndex((x) => x.id === fromId);
    const to = arr.findIndex((x) => x.id === toId);
    if (from === -1 || to === -1 || from === to) return;
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    arr.forEach((x, i) => (x.order = i));
    state.orderDirty[kind] = true;
    kind === 'photos' ? renderPhotos() : renderTracks();
    $(kind === 'photos' ? '#savePhotoOrderBtn' : '#saveTrackOrderBtn').hidden = false;
  });
}

async function saveOrder(kind) {
  const ids = (kind === 'photos' ? state.photos : state.tracks).map((x) => x.id);
  try {
    await api(`/api/admin/${kind === 'photos' ? 'photos' : 'tracks'}/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    state.orderDirty[kind] = false;
    $(kind === 'photos' ? '#savePhotoOrderBtn' : '#saveTrackOrderBtn').hidden = true;
    toast('Order saved');
  } catch (err) { toast(err.message, true); }
}
$('#savePhotoOrderBtn').addEventListener('click', () => saveOrder('photos'));
$('#saveTrackOrderBtn').addEventListener('click', () => saveOrder('tracks'));

/* ------------------------------------------------------------ uploads */
function setupUpload(kind) {
  const isPhoto = kind === 'photo';
  const inputId = isPhoto ? '#photoInput' : '#trackInput';
  const dropId = isPhoto ? '#photoDropzone' : '#trackDropzone';
  const progressId = isPhoto ? '#photoProgress' : '#trackProgress';
  const barId = isPhoto ? '#photoBarFill' : '#trackBarFill';
  const textId = isPhoto ? '#photoBarText' : '#trackBarText';
  const endpoint = isPhoto ? '/api/admin/photos' : '/api/admin/tracks';

  const input = $(inputId);
  const dz = $(dropId);

  dz.addEventListener('click', () => input.click());
  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', (e) => {
    e.preventDefault();
    dz.classList.remove('over');
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  });
  input.addEventListener('change', () => {
    if (input.files.length) uploadFiles(input.files);
    input.value = '';
  });

  async function uploadFiles(files) {
    const list = [...files].filter((f) =>
      isPhoto ? f.type.startsWith('image/') : f.type.startsWith('audio/')
    );
    if (!list.length) {
      toast(isPhoto ? 'Please choose image files' : 'Please choose audio files', true);
      return;
    }
    const fd = new FormData();
    list.forEach((f) => fd.append('files', f));
    $(progressId).hidden = false;
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', endpoint);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          $(barId).style.width = pct + '%';
          $(textId).textContent = `Uploading… ${pct}%`;
        }
      };
      const done = new Promise((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
          else {
            try { reject(new Error(JSON.parse(xhr.responseText).error || 'Upload failed')); }
            catch (_) { reject(new Error('Upload failed')); }
          }
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
      });
      xhr.send(fd);
      await done;
      toast(`${list.length} uploaded ✓`);
      await loadAll();
    } catch (err) {
      toast(err.message, true);
    } finally {
      $(progressId).hidden = true;
      $(barId).style.width = '0%';
    }
  }
}

/* ------------------------------------------------------------ editor modal */
const editorKind = { type: null, id: null };

function openEditor(type, id) {
  const item = (type === 'photo' ? state.photos : state.tracks).find((x) => x.id === id);
  if (!item) return;
  editorKind.type = type;
  editorKind.id = id;
  const isPhoto = type === 'photo';
  $('#modalTitle').textContent = isPhoto ? 'Edit photo' : 'Edit track';
  $('#modalSub').textContent = isPhoto ? item.title : `${item.title} — ${item.artist || ''}`;
  $('#editorForm [name="title"]').value = item.title || '';
  $('#editorForm [name="description"]').value = item.description || '';
  $('#extraFields').innerHTML = isPhoto
    ? ''
    : `<label>Artist<input name="artist" maxlength="120" value="${esc(item.artist || '')}" /></label>
       <label>Duration (seconds, optional)<input name="duration" type="number" min="1" value="${item.duration || ''}" /></label>`;
  $('#deleteBtn').hidden = false;
  $('#editorModal').hidden = false;
}

function closeEditor() {
  $('#editorModal').hidden = true;
  editorKind.type = null;
  editorKind.id = null;
}
$('#modalClose').addEventListener('click', closeEditor);
$('#cancelBtn').addEventListener('click', closeEditor);
$('#editorModal').addEventListener('click', (e) => { if (e.target === $('#editorModal')) closeEditor(); });

$('#editorForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const { type, id } = editorKind;
  if (!type) return;
  const body = {
    title: $('#editorForm [name="title"]').value,
    description: $('#editorForm [name="description"]').value,
  };
  const artistEl = $('#editorForm [name="artist"]');
  const durEl = $('#editorForm [name="duration"]');
  if (artistEl) body.artist = artistEl.value;
  if (durEl) body.duration = parseFloat(durEl.value) || undefined;
  const endpoint = (type === 'photo' ? '/api/admin/photos/' : '/api/admin/tracks/') + id;
  try {
    await api(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    closeEditor();
    toast('Saved ✓');
    await loadAll();
  } catch (err) { toast(err.message, true); }
});

async function deleteItem(type, id) {
  const name = (type === 'photo' ? state.photos : state.tracks).find((x) => x.id === id)?.title || 'this item';
  if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
  try {
    await api(`/api/admin/${type === 'photo' ? 'photos' : 'tracks'}/${id}`, { method: 'DELETE' });
    toast('Deleted');
    await loadAll();
  } catch (err) { toast(err.message, true); }
}

/* ------------------------------------------------------------ settings */
async function loadSettings() {
  try {
    const { settings } = await api('/api/admin/settings');
    state.settings = settings;
    for (const [key, val] of Object.entries(settings)) {
      const el = $('#settingsForm [name="' + key + '"]');
      if (el) el.value = val || '';
    }
  } catch (err) { toast(err.message, true); }
}

$('#settingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {};
  ['siteTitle', 'siteTagline', 'heroTitle', 'heroSubtitle', 'about', 'footerText'].forEach((k) => {
    body[k] = $('#settingsForm [name="' + k + '"]').value;
  });
  const msg = $('#settingsMsg');
  try {
    await api('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    msg.textContent = 'Saved ✓';
    msg.className = 'form-msg ok';
    $('#sideBrand').textContent = body.siteTitle || 'Serene';
    toast('Settings saved ✓');
  } catch (err) {
    msg.textContent = err.message;
    msg.className = 'form-msg err';
  }
});

$('#passwordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('#passwordMsg');
  const fd = new FormData(e.target);
  try {
    await api('/api/admin/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: fd.get('currentPassword'),
        newPassword: fd.get('newPassword'),
      }),
    });
    msg.textContent = 'Password updated ✓';
    msg.className = 'form-msg ok';
    e.target.reset();
  } catch (err) {
    msg.textContent = err.message;
    msg.className = 'form-msg err';
  }
});

/* ------------------------------------------------------------ boot */
async function loadAll() {
  try {
    const [photos, tracks] = await Promise.all([api('/api/admin/photos'), api('/api/admin/tracks')]);
    state.photos = photos;
    state.tracks = tracks;
    renderPhotos();
    renderTracks();
    if (state.tab === 'dashboard') refreshDashboard();
  } catch (err) {
    if (err.status === 401) return location.reload();
    toast(err.message, true);
  }
}

function init() {
  loadAll();
  loadSettings();
  refreshDashboard();
  setupUpload('photo');
  setupUpload('track');
}

document.addEventListener('DOMContentLoaded', checkAuth);
