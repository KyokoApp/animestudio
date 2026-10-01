/* AnimeExtract — PWA klien GitHub Actions (vanilla JS, tanpa dependensi, tanpa server) */
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const API = 'https://api.github.com';
const WF_PATH = '.github/workflows/extract.yml';
const TRIGGER_PATH = 'trigger.json';
const VERSION = '1.0.0';

const S = {
  repo: '', token: '', game: null, types: ['Texture2D', 'Sprite', 'TextAsset'],
  games: [], classids: [],
  bundle: { url: '', name: '' },
  picked: [],
  runs: [], currentRun: null, poll: null, installed: false,
};

const POPULAR_TYPES = ['Texture2D', 'Sprite', 'Mesh', 'TextAsset', 'AudioClip', 'AnimationClip',
  'Material', 'Shader', 'Font', 'MonoBehaviour', 'VideoClip', 'AnimatorController'];
const PRESETS = {
  'Gambar': ['Texture2D', 'Sprite', 'SpriteAtlas'],
  'Audio': ['AudioClip'],
  'Model 3D': ['Mesh', 'Material', 'Texture2D'],
  'Animasi': ['AnimationClip', 'Animator', 'AnimatorController'],
  'Data/teks': ['TextAsset', 'MonoBehaviour', 'Shader'],
};

/* ───────────────────────── util ───────────────────────── */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function fmtBytes(n) {
  if (!Number.isFinite(n)) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n >= 100 || i === 0 ? n.toFixed(0) : n.toFixed(1)} ${u[i]}`;
}
function fmtWhen(ts) {
  const d = (Date.now() - new Date(ts).getTime()) / 1000;
  if (d < 60) return 'baru saja';
  if (d < 3600) return `${Math.round(d / 60)} mnt lalu`;
  if (d < 86400) return `${Math.round(d / 3600)} jam lalu`;
  return new Date(ts).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
}
function el(tag, attrs = {}, kids = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== null && v !== undefined && v !== false) n.setAttribute(k, v === true ? '' : v);
  }
  for (const k of [].concat(kids)) if (k) n.append(k);
  return n;
}
function toast(msg, kind = '') {
  const t = el('div', { class: `toast ${kind}`, text: msg });
  $('#toast').append(t);
  setTimeout(() => t.remove(), kind === 'err' ? 8000 : 4000);
}
function sheet(title, body) {
  const back = el('div', { class: 'sheet-backdrop' });
  const card = el('div', { class: 'sheet' });
  const close = () => { back.remove(); document.body.style.overflow = ''; };
  card.append(el('header', {}, [el('b', { text: title }), el('button', { class: 'x', text: '✕', onClick: close })]),
    el('div', { class: 'body' }, [body]));
  back.append(card);
  back.addEventListener('click', (e) => { if (e.target === back) close(); });
  $('#modalRoot').append(back);
  document.body.style.overflow = 'hidden';
  return { close };
}

/* ───────────────────── penyimpanan lokal ───────────────────── */
/* penyimpanan aman: localStorage bisa diblokir (iframe sandbox / mode privat) -> pakai memori */
const store = (() => {
  const mem = {};
  const coba = (fn) => { try { return fn(); } catch (e) { return null; } };
  const bisa = coba(() => { window.localStorage.setItem('__ae_t', '1'); window.localStorage.removeItem('__ae_t'); return true; }) === true;
  return {
    ok: bisa,
    get(k) { const v = bisa ? coba(() => window.localStorage.getItem(k)) : (k in mem ? mem[k] : null); return v === null && k in mem ? mem[k] : v; },
    set(k, v) { mem[k] = String(v); if (bisa) coba(() => window.localStorage.setItem(k, String(v))); },
    del(k) { delete mem[k]; if (bisa) coba(() => window.localStorage.removeItem(k)); },
  };
})();

const LS = {
  save() {
    store.set('ae.token', S.token);
    store.set('ae.repo', S.repo);
    store.set('ae.game', S.game ? S.game.name : '');
    store.set('ae.types', JSON.stringify(S.types));
    store.set('ae.bundle', JSON.stringify(S.bundle || {}));
    store.set('ae.opts', JSON.stringify({
      export_type: $('#optExport').value, group_assets: $('#optGroup').value,
      unity_version: $('#optUnity').value, cli_build: $('#optBuild').value,
      map_op: $('#optMap').value, publish_release: $('#optPublish').value,
    }));
  },
  load() {
    S.token = store.get('ae.token') || '';
    S.repo = store.get('ae.repo') || 'KyokoApp/anime-extract';
    try { const b = JSON.parse(store.get('ae.bundle') || 'null'); if (b && b.url) S.bundle = b; } catch (e) {}
    const g = store.get('ae.game');
    try { const t = JSON.parse(store.get('ae.types') || 'null'); if (Array.isArray(t)) S.types = t; } catch (e) {}
    try {
      const o = JSON.parse(store.get('ae.opts') || '{}');
      if (o.export_type) $('#optExport').value = o.export_type;
      if (o.group_assets) $('#optGroup').value = o.group_assets;
      if (o.unity_version) $('#optUnity').value = o.unity_version;
      if (o.cli_build) $('#optBuild').value = o.cli_build;
      if (o.map_op) $('#optMap').value = o.map_op;
      if (o.publish_release) $('#optPublish').value = o.publish_release;
    } catch (e) {}
    return g;
  },
  clear() {
    ['ae.token', 'ae.repo', 'ae.game', 'ae.types', 'ae.opts', 'ae.run', 'ae.bundle'].forEach((k) => store.del(k));
  },
};

/* ─────────────────────── GitHub API ─────────────────────── */
class GhError extends Error {
  constructor(status, msg, body) { super(msg); this.status = status; this.body = body; }
}
async function gh(path, opts = {}) {
  if (!S.token) throw new GhError(401, 'Token belum diisi');
  const { method = 'GET', body, accept = 'application/vnd.github+json' } = opts;
  let res;
  try {
    res = await fetch(path.startsWith('http') ? path : API + path, {
      method,
      headers: {
        Authorization: `Bearer ${S.token}`,
        Accept: accept,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new GhError(0, 'Tidak bisa menghubungi GitHub (jaringan/CORS). Coba lagi.');
  }
  if (res.status === 204) return {};
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { raw: text }; }
  if (!res.ok) {
    const m = data.message || `HTTP ${res.status}`;
    let hint = '';
    if (res.status === 401) hint = ' — token salah/kadaluarsa';
    if (res.status === 403) hint = ' — token tidak punya izin yang cukup';
    if (res.status === 404) hint = ' — repo/path tidak ditemukan (atau token tidak punya akses)';
    if (res.status === 422 && /workflow/i.test(m)) hint = ' — workflow belum ada di branch default';
    throw new GhError(res.status, m + hint, data);
  }
  return data;
}

/* ───────────────────────── navigasi tab ───────────────────────── */
function tab(name, push = true) {
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
  $$('.tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
  window.scrollTo(0, 0);
  if (push) history.replaceState(null, '', '#' + name);
  if (name === 'proses') loadRuns();
  if (name === 'hasil') fillResultRuns();
  schedulePolling();
}
$$('.tabbar button').forEach((b) => b.addEventListener('click', () => tab(b.dataset.tab)));

/* ─────────────────────────── SETUP ─────────────────────────── */
function renderTopbar() {
  const p = $('#statusPill'), t = $('#statusPillText');
  p.classList.remove('ok', 'warn', 'err');
  $('#repoLabel').textContent = S.repo || 'belum disetel';
  if (!S.tokendValid && (!S.token || !S.repo)) { p.classList.add('warn'); t.textContent = 'belum siap'; return; }
  if (S.repoStatus === 'ok') { p.classList.add('ok'); t.textContent = 'terhubung'; }
  else if (S.repoStatus === 'err') { p.classList.add('err'); t.textContent = 'gagal konek'; }
  else { p.classList.add('warn'); t.textContent = 'cek…'; }
}
$('#statusPill').addEventListener('click', () => tab('setup'));

$('#btnToggleTok').addEventListener('click', () => {
  const i = $('#setToken');
  i.type = i.type === 'password' ? 'text' : 'password';
});

$('#btnSaveSetup').addEventListener('click', async () => {
  const repo = $('#setRepo').value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
  const token = $('#setToken').value.trim();
  const out = $('#setupResult');
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return (out.innerHTML = '<span style="color:#fca5a5">Format repo harus owner/nama, mis. KyokoApp/anime-extract</span>');
  if (!token) return (out.innerHTML = '<span style="color:#fca5a5">Token belum diisi.</span>');
  S.repo = repo; S.token = token;
  out.textContent = 'Menguji koneksi…';
  try {
    const me = await gh('/user');
    const r = await gh(`/repos/${repo}`);
    const perms = r.permissions || {};
    const bolehTulis = perms.push || perms.admin || perms.maintain;
    S.repoStatus = 'ok'; S.tokendValid = true;
    LS.save(); renderTopbar();
    out.innerHTML = `✅ Tersambung sebagai <b>${esc(me.login)}</b> ke <b>${esc(r.full_name)}</b>`
      + (r.private ? ' (private)' : ' (PUBLIC ⚠️)')
      + (bolehTulis ? '' : '<br><span style="color:#fca5a5">Token tidak punya izin tulis — workflow tidak akan bisa dijalankan.</span>');
    toast('Tersambung ke ' + r.full_name, 'ok');
    if (location.hash === '#setup' || !location.hash) tab('ekstrak');
  } catch (e) {
    S.repoStatus = 'err'; S.tokendValid = false; renderTopbar();
    out.innerHTML = `<span style="color:#fca5a5">❌ ${esc(e.message)}</span>`;
  }
});

$('#btnClearSetup').addEventListener('click', () => {
  if (!confirm('Hapus token & pengaturan dari HP ini?')) return;
  LS.clear(); S.token = ''; S.repo = ''; S.repoStatus = null;
  $('#setToken').value = ''; $('#setRepo').value = '';
  renderTopbar(); $('#setupResult').textContent = 'Data dihapus.';
});

/* ──────────────────────────── KIRIM ──────────────────────────── */
const drop = $('#drop');
$('#btnPick').addEventListener('click', (e) => { e.stopPropagation(); $('#fileInput').click(); });
drop.addEventListener('click', () => $('#fileInput').click());
['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', (e) => addPicked(Array.from(e.dataTransfer.files || [])));
$('#fileInput').addEventListener('change', (e) => { addPicked(Array.from(e.target.files)); e.target.value = ''; });

function addPicked(files) {
  for (const f of files) if (f.size > 0) S.picked.push(f);
  renderPicked();
}
function renderPicked() {
  const wrap = $('#picked'); wrap.innerHTML = '';
  S.picked.forEach((f, i) => {
    wrap.append(el('div', { class: 'fileitem' }, [
      el('span', { class: 'nm', text: f.name, title: f.name }),
      el('span', { class: 'sz', text: fmtBytes(f.size) }),
      el('button', { class: 'rm', text: '✕', onClick: () => { S.picked.splice(i, 1); renderPicked(); } }),
    ]));
  });
  $('#btnUpload').disabled = !S.picked.length;
  $('#upInfo').textContent = S.picked.length
    ? `${S.picked.length} file · ${fmtBytes(S.picked.reduce((a, f) => a + f.size, 0))}${S.picked.length > 1 ? ' — yang dipakai hanya file pertama' : ''}`
    : '';
}

const INBOX = 'inbox';
const safeName = (n) => n.replace(/[^\w.\-]+/g, '_').replace(/^_+/, '') || 'bundle.bin';
const MAX_APP_MB = 45, HARD_MB = 90;

function tagNow() {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  return `bundle-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/* Baca file dari HP → base64 (progress 0..1) */
function readBase64(file, onProgress) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    fr.onload = () => resolve(String(fr.result).split(',')[1] || '');
    fr.onerror = () => reject(new GhError(0, 'Gagal membaca file di HP ini (file terlalu besar untuk memori browser?).'));
    fr.readAsDataURL(file);
  });
}

/* XHR generik: bisa untuk PUT/POST/DELETE + progress upload (fetch() tidak bisa progress upload) */
function xhrSend(method, url, body, headers, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    if (onProgress && xhr.upload) xhr.upload.addEventListener('progress', (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); });
    xhr.addEventListener('load', () => {
      let data = null; try { data = JSON.parse(xhr.responseText); } catch (_) {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(data || {});
      else reject(new GhError(xhr.status, (data && data.message) || `HTTP ${xhr.status}`, xhr.responseText));
    });
    xhr.addEventListener('error', () => reject(new GhError(0, 'Koneksi ke GitHub terputus / diblokir browser.')));
    xhr.addEventListener('abort', () => reject(new GhError(0, 'Dibatalkan.')));
    xhr.send(body);
  });
}

/* Kirim file ke repo (Contents API — jalur yang lolos CORS di browser HP) */
async function sendToRepo(file, onProgress) {
  const name = safeName(file.name);
  const path = `${INBOX}/${name}`;
  const b64 = await readBase64(file, (p) => onProgress(p * 0.4));
  let sha = null;
  try { sha = (await gh(`/repos/${S.repo}/contents/${path}`)).sha; } catch (e) { if (e.status !== 404) throw e; }
  const payload = JSON.stringify({ message: `AnimeExtract: kirim ${name}`, content: b64, branch: 'main', ...(sha ? { sha } : {}) });
  const res = await xhrSend('PUT', `${API}/repos/${S.repo}/contents/${path}`, payload, {
    Authorization: `Bearer ${S.token}`, Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28',
  }, (p) => onProgress(0.4 + p * 0.6));
  return { name, path, size: file.size, sha: res && res.content ? res.content.sha : null };
}

$('#btnUpload').addEventListener('click', async () => {
  if (!S.token || !S.repo) { toast('Setel repo & token dulu di tab Setelan', 'err'); return tab('setup'); }
  const files = S.picked.slice();
  if (!files.length) return toast('Pilih file dulu', 'err');

  const tooBig = files.filter((f) => f.size > HARD_MB * 1024 * 1024);
  if (tooBig.length) {
    toast(`${tooBig[0].name} terlalu besar untuk jalur app (maks ${HARD_MB} MB). Pakai kartu "File besar (> 45 MB)".`, 'err');
    return tab('kirim');
  }
  const big = files.filter((f) => f.size > MAX_APP_MB * 1024 * 1024);
  if (big.length && !confirm(`${big.map((f) => f.name).join(', ')} lebih dari ${MAX_APP_MB} MB.\nMasih bisa, tapi bisa lambat/gagal — kalau gagal pakai jalur Releases (untuk file besar).\n\nLanjut kirim?`)) return;

  const btn = $('#btnUpload'); btn.disabled = true;
  const barWrap = $('#upBarWrap'), bar = $('#upBar'); barWrap.classList.remove('hidden'); $('#upInfo').textContent = '';
  let done = 0, first = null;
  const total = files.reduce((a, f) => a + f.size, 0);
  try {
    for (const f of files) {
      const hasil = await sendToRepo(f, (p) => {
        const tot = Math.round(((done + f.size * p) / total) * 100);
        bar.style.width = tot + '%';
        $('#upInfo').textContent = `${p < 0.4 ? 'Membaca' : 'Mengunggah'} ${f.name} — ${Math.round(p * 100)}%`;
      });
      done += f.size; if (!first) first = hasil;
      $('#upInfo').textContent = `✅ ${hasil.name} masuk ke repo (${fmtBytes(f.size)})`;
    }
    bar.style.width = '100%';
    S.bundle = { url: first.path, name: first.name, size: first.size, kind: 'repo' };
    $('#bundleUrl').value = first.path;
    LS.save(); renderBundle();
    toast('Terikirim ke repo — lanjut atur ekstraksi', 'ok');
    S.picked = []; renderPicked();
    $('#upInfo').innerHTML = `<span style="color:#86efac">✅ Siap diekstrak:</span> <b>${esc(first.path)}</b> (${fmtBytes(first.size)}) — sudah masuk repo private kamu.`;
    loadInbox();
    setTimeout(() => tab('ekstrak'), 700);
  } catch (e) {
    barWrap.classList.add('hidden');
    const link = `https://github.com/${esc(S.repo)}/releases/new`;
    $('#upInfo').innerHTML = `<span style="color:#fca5a5">❌ ${esc(e.message)}</span><br>
      Coba lagi, atau pakai jalur Releases (file besar / koneksi tidak stabil):
      <a href="${link}" target="_blank" rel="noreferrer">buka halaman release baru</a> → attach file → Publish → tempel linknya di kartu “pakai bundle yang sudah ada”.`;
    toast(e.message, 'err');
  } finally {
    btn.disabled = !S.picked.length;
  }
});

/* tombol jalur file besar */
$('#btnNewRelease').addEventListener('click', async () => {
  if (!S.repo || !S.token) { toast('Setel repo & token dulu', 'err'); return tab('setup'); }
  const tag = tagNow(), info = $('#newRelInfo');
  const win = window.open('', '_blank');   // fix HP: buka tab dulu biar tidak diblokir popup
  info.textContent = 'Menyiapkan halaman release…';
  try {
    const rel = await gh(`/repos/${S.repo}/releases`, {
      method: 'POST',
      body: { tag_name: tag, name: 'Bundle ' + tag, body: 'Dilampirkan manual dari HP (file besar).', draft: false, prerelease: true },
    });
    info.innerHTML = `Halaman siap. Attach file bundle-nya, tekan <b>Publish release</b>, lalu salin link filenya. Tag: <code class="kbd">${esc(tag)}</code>`;
    if (win) win.location = rel.html_url; else window.open(rel.html_url, '_blank');
  } catch (e) {
    if (win) win.location = `https://github.com/${S.repo}/releases/new`;
    info.innerHTML = `Buka halaman Releases manual: <a href="https://github.com/${esc(S.repo)}/releases/new" target="_blank" rel="noreferrer">github.com/${esc(S.repo)}/releases/new</a>`;
  }
});

/* isi inbox: lihat + hapus */
async function loadInbox() {
  const wrap = $('#inboxList');
  if (!S.repo || !S.token) { wrap.innerHTML = '<div class="tiny muted">Setel repo & token dulu.</div>'; return; }
  wrap.innerHTML = '<div class="tiny muted">Memuat…</div>';
  try {
    const items = await gh(`/repos/${S.repo}/contents/${INBOX}?ref=main`);
    wrap.innerHTML = '';
    if (!Array.isArray(items) || !items.length) { wrap.innerHTML = '<div class="tiny muted">Inbox kosong 🎉</div>'; return; }
    let totalKb = 0;
    for (const it of items) {
      totalKb += it.size / 1024;
      const row = el('div', { class: 'fileitem' }, [
        el('span', { class: 'nm', text: it.name, title: it.name }),
        el('span', { class: 'sz', text: fmtBytes(it.size) }),
        el('button', { class: 'rm', text: '🗑', title: 'Hapus dari repo', onClick: async () => {
          if (!confirm(`Hapus ${it.name} dari repo?`)) return;
          try {
            await gh(`/repos/${S.repo}/contents/${it.path}`, { method: 'DELETE', body: { message: `AnimeExtract: hapus ${it.name}`, sha: it.sha, branch: 'main' } });
            toast('Terhapus', 'ok'); loadInbox();
          } catch (e) { toast('Gagal hapus: ' + e.message, 'err'); }
        } }),
      ]);
      if (S.bundle && S.bundle.url === it.path) row.classList.add('on');
      wrap.append(row);
    }
    wrap.append(el('div', { class: 'tiny muted mt', text: `Total ${fmtBytes(totalKb * 1024)} di inbox/` }));
  } catch (e) {
    wrap.innerHTML = e.status === 404
      ? '<div class="tiny muted">Inbox masih kosong 🎉</div>'
      : `<div class="tiny muted">Gagal memuat: ${esc(e.message)}</div>`;
  }
}
$('#btnInboxRefresh').addEventListener('click', loadInbox);

$('#btnUseManual').addEventListener('click', () => {
  const u = $('#manualUrl').value.trim();
  if (!u) return toast('Isi link atau path dulu', 'err');
  if (!/^https?:\/\//.test(u) && !/^[\w.\-/]+$/.test(u)) return toast('Link / path tidak valid', 'err');
  S.bundle = { url: u, name: u.split('/').pop(), kind: /^https?:/.test(u) ? 'link' : 'repo' };
  $('#bundleUrl').value = u;
  LS.save(); renderBundle();
  toast('Bundle dipakai', 'ok');
  tab('ekstrak');
});

/* tampilkan info bundle yang dipakai di tab Ekstrak */
function renderBundle() {
  const box = $('#bundleInfo');
  if (!box) return;
  const b = S.bundle || {};
  if (!b.url) { box.innerHTML = '<span class="muted">Belum ada bundle — kirim dulu di tab 📤 Kirim.</span>'; return; }
  const tipe = b.kind === 'repo' ? '📁 di repo (inbox)' : '🔗 link luar';
  box.innerHTML = `<b>${esc(b.name || b.url)}</b> ${b.size ? '(' + fmtBytes(b.size) + ')' : ''}<br>`
    + `<span class="tiny muted">${tipe} · <code class="kbd">${esc(b.url)}</code></span>`;
}

/* ──────────────────────────── EKSTRAK ──────────────────────────── */
function renderGame() {
  if (!S.games || !S.games.length) {
    $('#gameLabel').textContent = 'Daftar game belum termuat';
    $('#gameSub').textContent = 'Muat ulang halaman (atau pakai tab Setelan → Simpan & uji koneksi).';
    return;
  }
  if (!S.game) { S.game = S.games.find((g) => g.name === 'GI') || S.games[0]; }
  $('#gameLabel').textContent = S.game.label;
  $('#gameSub').textContent = `${S.game.name} · ${S.game.category}${S.game.note ? ' — ' + S.game.note : ''}`;
}
function renderTypes() {
  const w = $('#typeChips'); w.innerHTML = '';
  if (!S.types.length) { w.append(el('span', { class: 'muted small', text: 'Semua jenis asset (paling lengkap, paling lama).' })); return; }
  S.types.forEach((t) => {
    const c = el('span', { class: 'chip on' }, [el('span', { text: t }), el('span', { text: '✕' })]);
    c.addEventListener('click', () => { S.types = S.types.filter((x) => x !== t); renderTypes(); LS.save(); });
    w.append(c);
  });
}
$('#btnAllTypes').addEventListener('click', () => { S.types = []; renderTypes(); LS.save(); toast('Akan mengekspor semua jenis asset'); });
$('#btnPickTypes').addEventListener('click', () => {
  const body = el('div');
  const search = el('input', { type: 'search', placeholder: 'Cari jenis asset…' });
  const presets = el('div', { class: 'chips', style: 'margin-top:10px' });
  Object.entries(PRESETS).forEach(([n, list]) => {
    const c = el('span', { class: 'chip mini', text: '+' + n });
    c.addEventListener('click', () => { S.types = [...new Set([...S.types, ...list])]; renderTypes(); LS.save(); render(search.value); });
    presets.append(c);
  });
  const list = el('div', { class: 'list', style: 'margin-top:10px' });
  body.append(search, presets, list);
  function render(q = '') {
    list.innerHTML = '';
    const ql = q.trim().toLowerCase();
    const items = ql ? S.classids.filter((c) => c.toLowerCase().includes(ql)).slice(0, 150)
      : POPULAR_TYPES.concat(S.classids.filter((c) => !POPULAR_TYPES.includes(c))).slice(0, 250);
    for (const c of items) {
      const on = S.types.includes(c);
      const b = el('button', { class: 'opt' + (on ? ' on' : '') });
      b.append(el('span', { text: (on ? '✓ ' : '') + c }));
      b.addEventListener('click', () => {
        S.types = on ? S.types.filter((x) => x !== c) : [...S.types, c];
        renderTypes(); LS.save(); render(search.value);
      });
      list.append(b);
    }
  }
  search.addEventListener('input', () => render(search.value));
  render();
  sheet('Pilih jenis asset', body);
});
$('#gameSelector').addEventListener('click', () => {
  const body = el('div');
  const search = el('input', { type: 'search', placeholder: 'Cari game… (genshin, star rail, zzz)' });
  const list = el('div', { class: 'list', style: 'margin-top:10px' });
  body.append(search, list);
  function render(q = '') {
    list.innerHTML = '';
    const ql = q.trim().toLowerCase();
    const gs = S.games.filter((g) => !ql || g.label.toLowerCase().includes(ql) || g.name.toLowerCase().includes(ql) || g.category.toLowerCase().includes(ql));
    let lastCat = null;
    for (const g of gs) {
      if (g.category !== lastCat) { list.append(el('div', { class: 'grp', text: g.category })); lastCat = g.category; }
      const b = el('button', { class: 'opt' + (S.game && g.name === S.game.name ? ' on' : '') }, [
        el('span', { text: g.label }), el('span', { class: 'sub2', text: g.name + (g.note ? ' · ' + g.note : '') }),
      ]);
      b.addEventListener('click', () => { S.game = g; renderGame(); LS.save(); m.close(); });
      list.append(b);
    }
    if (!gs.length) list.append(el('div', { class: 'muted small', text: 'Tidak ada yang cocok.' }));
  }
  search.addEventListener('input', () => render(search.value));
  render();
  const m = sheet('Pilih game', body);
});

async function triggerExtraction(inputs) {
  try {
    await gh(`/repos/${S.repo}/actions/workflows/extract.yml/dispatches`, {
      method: 'POST', body: { ref: 'main', inputs },
    });
    return 'tombol';
  } catch (e) {
    if (e.status !== 404 && e.status !== 422) throw e;
    // fallback: tulis trigger.json (dipicu oleh push)
    let sha;
    try { sha = (await gh(`/repos/${S.repo}/contents/${TRIGGER_PATH}?ref=main`)).sha; } catch (e2) { sha = undefined; }
    const isi = { _catatan: 'Dibuat oleh app AnimeExtract.', ...inputs, dry_run: false };
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(isi, null, 2) + '\n')));
    await gh(`/repos/${S.repo}/contents/${TRIGGER_PATH}`, {
      method: 'PUT',
      body: { message: `kick: ${inputs.game} (${inputs.types || 'semua jenis'})`, content: b64, branch: 'main', ...(sha ? { sha } : {}) },
    });
    return 'trigger.json';
  }
}

$('#bundleUrl').addEventListener('change', () => {
  const v = $('#bundleUrl').value.trim();
  if (v) S.bundle = { url: v, name: v.split('/').pop(), kind: /^https?:/.test(v) ? 'link' : 'repo' };
  else S.bundle = { url: '', name: '' };
  LS.save(); renderBundle();
});

$('#btnRun').addEventListener('click', async () => {
  if (!S.token || !S.repo) { toast('Setel repo & token dulu', 'err'); return tab('setup'); }
  const url = $('#bundleUrl').value.trim();
  if (!url) return toast('Belum ada bundle — kirim dulu di tab Kirim', 'err');
  const btn = $('#btnRun'); btn.disabled = true; btn.textContent = '⏳ Mengirim…';
  const inputs = {
    game: S.game.name,
    bundle_url: url,
    types: S.types.join(','),
    export_type: $('#optExport').value,
    group_assets: $('#optGroup').value,
    map_op: $('#optMap').value,
    unity_version: $('#optUnity').value.trim(),
    cli_build: $('#optBuild').value,
    publish_release: $('#optPublish').value,
  };
  try {
    LS.save();
    const via = await triggerExtraction(inputs);
    $('#runInfo').textContent = `Terkirim (lewat ${via}). Menunggu runner Windows…`;
    toast('Ekstraksi dikirim 🚀 tunggu di tab Proses', 'ok');
    tab('proses');
    setTimeout(loadRuns, 5000);
  } catch (e) {
    $('#runInfo').innerHTML = `<span style="color:#fca5a5">${esc(e.message)}</span>`;
    toast(e.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = '🚀 Jalankan ekstraksi';
  }
});

/* ──────────────────────────── PROSES ──────────────────────────── */
function stateOf(r) { return r.conclusion || r.status; }
async function loadRuns(silent = false) {
  if (!S.token || !S.repo) return;
  try {
    const d = await gh(`/repos/${S.repo}/actions/runs?per_page=40`);
    S.runs = (d.workflow_runs || []).filter((r) => (r.path || '').endsWith(WF_PATH.replace('.github/workflows/', '')));
    renderRuns();
    S.repoStatus = 'ok'; renderTopbar();
  } catch (e) {
    if (!silent) toast(e.message, 'err');
  }
  schedulePolling();
}
function renderRuns() {
  const w = $('#runList'); w.innerHTML = '';
  if (!S.runs.length) { w.append(el('div', { class: 'muted small', text: 'Belum ada riwayat ekstraksi.' })); }
  for (const r of S.runs) {
    const card = el('div', { class: 'job' });
    card.append(el('div', { class: 'head' }, [
      el('div', { class: 't' }, [
        el('b', { text: `#${r.run_number} · ${r.display_title || r.name}` }),
        el('span', { class: 'tiny muted', text: `${fmtWhen(r.created_at)} · ${r.event}` }),
      ]),
      el('span', { class: `state ${stateOf(r)}`, text: stateOf(r) }),
    ]));
    card.addEventListener('click', () => showRun(r));
    w.append(card);
  }
  const running = S.runs.filter((r) => r.status === 'in_progress' || r.status === 'queued').length;
  const b = $('#runBadge'); b.classList.toggle('hidden', !running); b.textContent = running;
}
async function showRun(r) {
  S.currentRun = r;
  const box = $('#runDetail'); box.classList.remove('hidden');
  $('#runDetailTitle').textContent = `#${r.run_number} · ${r.display_title || ''}`;
  $('#runLink').href = r.html_url;
  $('#btnCancelRun').classList.toggle('hidden', !(r.status === 'in_progress' || r.status === 'queued'));
  const steps = $('#runSteps'); steps.innerHTML = '<div class="muted small">memuat langkah…</div>';
  try {
    const d = await gh(`/repos/${S.repo}/actions/runs/${r.id}/jobs`);
    steps.innerHTML = '';
    for (const job of d.jobs || []) {
      steps.append(el('div', { class: 'tiny muted', style: 'margin:8px 0 2px', text: `${job.name} · ${job.status}${job.conclusion ? ' / ' + job.conclusion : ''}` }));
      for (const s of job.steps || []) {
        const concl = s.conclusion || s.status;
        const cls = concl === 'success' ? 'ok' : concl === 'failure' ? 'bad'
          : (s.status === 'in_progress' ? 'run' : concl === 'skipped' ? 'skip' : '');
        const mk = cls === 'ok' ? '✔' : cls === 'bad' ? '✘' : cls === 'run' ? '⏳' : cls === 'skip' ? '·' : '·';
        steps.append(el('div', { class: `step ${cls}` }, [el('span', { class: 'mk', text: mk }), el('span', { text: s.name })]));
      }
    }
  } catch (e) { steps.innerHTML = `<span style="color:#fca5a5">${esc(e.message)}</span>`; }
}
$('#btnCloseDetail').addEventListener('click', () => $('#runDetail').classList.add('hidden'));
$('#btnRefreshRuns').addEventListener('click', () => loadRuns());
$('#btnSeeResults').addEventListener('click', () => { if (S.currentRun) { $('#resultRun').value = S.currentRun.run_number; tab('hasil'); } });
$('#btnCancelRun').addEventListener('click', async () => {
  if (!S.currentRun || !confirm('Batalkan ekstraksi ini?')) return;
  try { await gh(`/repos/${S.repo}/actions/runs/${S.currentRun.id}/cancel`, { method: 'POST' }); toast('Permintaan batal dikirim'); loadRuns(); }
  catch (e) { toast(e.message, 'err'); }
});
function schedulePolling() {
  clearInterval(S.poll);
  const running = S.runs.some((r) => r.status === 'in_progress' || r.status === 'queued');
  const onProses = $('#view-proses').classList.contains('active');
  if (!running && !onProses) return;
  S.poll = setInterval(async () => {
    if (document.hidden) return;
    await loadRuns(true);
    if (S.currentRun) {
      const fresh = S.runs.find((x) => x.id === S.currentRun.id);
      if (fresh) { const wasRun = S.currentRun.status !== 'completed'; S.currentRun = fresh; if (wasRun) showRun(fresh); }
    }
  }, 10000);
}

/* ──────────────────────────── HASIL ──────────────────────────── */
async function fillResultRuns() {
  if (!S.token || !S.repo) return;
  const sel = $('#resultRun');
  const cur = sel.value;
  sel.innerHTML = '';
  const done = S.runs.filter((r) => r.status === 'completed');
  if (!done.length) {
    try { const d = await gh(`/repos/${S.repo}/actions/runs?per_page=20`); S.runs = (d.workflow_runs || []).filter((r) => (r.path || '').endsWith('extract.yml')); } catch (e) {}
  }
  const list = S.runs.filter((r) => r.status === 'completed');
  for (const r of list) {
    sel.append(el('option', { value: r.run_number, text: `#${r.run_number} · ${stateOf(r)} · ${fmtWhen(r.created_at)}` }));
  }
  if (cur && list.some((r) => String(r.run_number) === cur)) sel.value = cur;
  else if (store.get('ae.run') && list.some((r) => String(r.run_number) === store.get('ae.run'))) sel.value = store.get('ae.run');
  loadResults();
}
$('#resultRun').addEventListener('change', () => { store.set('ae.run', $('#resultRun').value); loadResults(); });
$('#btnRefreshResults').addEventListener('click', loadResults);

async function loadResults() {
  const box = $('#resultBody');
  const rn = $('#resultRun').value;
  if (!rn) { box.innerHTML = '<div class="muted small">Belum ada ekstraksi yang selesai.</div>'; return; }
  const run = S.runs.find((r) => String(r.run_number) === String(rn));
  box.innerHTML = '<div class="muted small">memuat hasil…</div>';
  let assets = [], artifacts = [];
  try {
    try { assets = (await gh(`/repos/${S.repo}/releases/tags/extract-${rn}`)).assets || []; } catch (e) { if (e.status !== 404) throw e; }
    if (run) { try { artifacts = (await gh(`/repos/${S.repo}/actions/runs/${run.id}/artifacts`)).artifacts || []; } catch (e) {} }
  } catch (e) {
    box.innerHTML = `<span style="color:#fca5a5">${esc(e.message)}</span>`; return;
  }
  box.innerHTML = '';
  if (!assets.length && !artifacts.length) {
    box.innerHTML = `<div class="muted small">Tidak ada hasil untuk #${esc(rn)}.
      ${run && run.conclusion !== 'success' ? `<br>Ekstraksi berakhir <b>${esc(stateOf(run))}</b> — cek langkahnya di tab Proses.` : ''}
      <br>Kalau hasilnya kosong (0 file): biasanya kode game salah, atau filternya terlalu sempit.</div>`;
    return;
  }
  for (const a of assets) {
    const row = el('div', { class: 'res' }, [
      el('span', { class: 'ic', text: a.name.endsWith('.txt') ? '📄' : '🗜️' }),
      el('div', { class: 'meta' }, [el('b', { text: a.name }), el('span', { text: `${fmtBytes(a.size)} · ${fmtWhen(a.created_at)}` })]),
      el('button', { class: 'btn small primary', text: a.size > 200 * 1024 * 1024 ? '⬇️ (besar)' : '⬇️ Unduh' }),
    ]);
    row.querySelector('button').addEventListener('click', () => downloadAsset(a));
    box.append(row);
  }
  for (const a of artifacts) {
    if (a.expired) continue;
    const row = el('div', { class: 'res' }, [
      el('span', { class: 'ic', text: '📦' }),
      el('div', { class: 'meta' }, [el('b', { text: a.name }), el('span', { text: `artifact · ${fmtBytes(a.size_in_bytes)} · kedaluwarsa ${fmtWhen(a.expires_at)}` })]),
      el('a', { class: 'btn small ghost', href: run ? run.html_url : '#', target: '_blank', rel: 'noreferrer', text: 'Buka di GitHub' }),
    ]);
    box.append(row);
  }
  box.append(el('p', { class: 'tiny muted', text: 'Unduhan besar (>200 MB) lebih lancar dari halaman Releases di browser — app ini mengunduh lewat API jadi memakai memori HP.' }));
}

async function downloadAsset(a) {
  if (a.size > 200 * 1024 * 1024) {
    const lanjut = confirm(`File ini ${fmtBytes(a.size)} — mengunduh lewat app bisa berat untuk HP.\n\nOK = tetap unduh di app\nCancel = buka halaman Releases (lebih aman)`);
    if (!lanjut) { window.open(`https://github.com/${S.repo}/releases/tag/extract-${$('#resultRun').value}`, '_blank'); return; }
  }
  const t = toast('Mengunduh ' + a.name + '…');
  try {
    const res = await fetch(`${API}/repos/${S.repo}/releases/assets/${a.id}`, {
      headers: { Authorization: `Bearer ${S.token}`, Accept: 'application/octet-stream' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = el('a', { href: url, download: a.name });
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    toast('Selesai: ' + a.name, 'ok');
  } catch (e) {
    toast('Gagal mengunduh di app — buka dari GitHub saja', 'err');
    window.open(`https://github.com/${S.repo}/releases/tag/extract-${$('#resultRun').value}`, '_blank');
  } finally { t.remove(); }
}

/* ──────────────────────────── boot ──────────────────────────── */
async function boot() {
  $('#appVersion').textContent = `AnimeExtract v${VERSION} · PWA`;
  // data dimuat lewat <script> (window.AE_GAMES / AE_CLASSIDS) — lebih tahan banting
  // daripada fetch() yang bisa diblokir CORS saat app dibuka di dalam iframe/preview.
  let games = window.AE_GAMES || null, classids = window.AE_CLASSIDS || null;
  if (!games || !classids) {   // cadangan: kalau file .js belum ada, coba fetch JSON
    const [g2, c2] = await Promise.all([
      games ? Promise.resolve(games) : fetch('data/games.json').then((r) => r.json()).catch(() => []),
      classids ? Promise.resolve(classids) : fetch('data/classids.json').then((r) => r.json()).catch(() => []),
    ]);
    games = g2; classids = c2;
  }
  S.games = games; S.classids = classids;
  const g = LS.load();
  $('#setRepo').value = S.repo;
  if (S.token) $('#setToken').value = S.token;
  renderTopbar();
  renderGame();
  renderTypes();
  store.get('ae.run') && ($('#resultRun').value = store.get('ae.run'));

  if (!S.token || !S.repo) { tab('setup', false); return; }
  // uji koneksi diam-diam
  try {
    await gh(`/repos/${S.repo}`);
    S.repoStatus = 'ok';
  } catch (e) { S.repoStatus = 'err'; }
  renderTopbar();
  const h = (location.hash || '').replace('#', '');
  tab(['setup', 'kirim', 'ekstrak', 'proses', 'hasil', 'panduan'].includes(h) ? h : 'ekstrak', false);
  loadRuns(true);
}

/* PWA: service worker + install prompt */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  try {
    navigator.serviceWorker.register('./sw.js').catch(() => {/* offline-mode tidak tersedia; app tetap jalan */});
  } catch (e) {/* Safari lama / iframe sandbox */}
}
$('#btnInstall').addEventListener('click', async () => {
  $('#btnInstall').classList.add('hidden');
  if (deferredPrompt) { deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; }
  else toast('Di Android: menu Chrome ⋮ → “Tambahkan ke layar utama”', 'ok');
});
window.addEventListener('appinstalled', () => { $('#btnInstall').classList.add('hidden'); toast('App terpasang 🎉', 'ok'); });

boot();
