import { $, $all, escapeHtml, loadJSON, getSettings, saveSettings, toast, navigate } from './util.js';

const OFFLINE_CACHE = 'murottal-offline-v1';
const OFFLINE_META_KEY = 'murottal-offline-meta-v1';
const DB_NAME = 'murottal-db';
const DB_STORE = 'surahs';

let surahs = [];
let reciters = [];
let audio;
let activeSurahData = null; // full equran.id data for open surah
let isDownloading = false;
let state = {
  surahNum: null,     // null = list view, 1..114 = player view
  ayahNum: 1,
  reciterId: '05',
  repeatAyah: false,
  isPlaying: false
};

function openDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('no idb')); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: 'nomor' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetSurah(num) {
  try {
    const db = await openDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const req = tx.objectStore(DB_STORE).get(Number(num));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function idbPutSurah(data) {
  try {
    const db = await openDB();
    await new Promise((resolve) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(data);
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
  } catch { /* ignore */ }
}

function getOfflineMeta() {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_META_KEY) || '{}');
  } catch {
    return {};
  }
}

function setOfflineMeta(meta) {
  try {
    localStorage.setItem(OFFLINE_META_KEY, JSON.stringify(meta));
  } catch { /* ignore */ }
}

function isSurahOfflineAny(num) {
  const meta = getOfflineMeta();
  return Object.keys(meta).some((k) => k.startsWith(`${num}:`) && meta[k]);
}

function isSurahOfflineForQari(num, qariId) {
  const meta = getOfflineMeta();
  return Boolean(meta[`${num}:${qariId}`]);
}

export async function initMurotal() {
  const [s, r] = await Promise.all([loadJSON('data/surahs.json'), loadJSON('data/reciters.json')]);
  surahs = s.surahs;
  reciters = r.reciters;
  const savedReciter = getSettings().reciterId;
  state.reciterId = reciters.some((x) => x.id === savedReciter) ? savedReciter : reciters[0].id;

  audio = document.getElementById('murotal-audio');
  if (!audio) {
    audio = document.createElement('audio');
    audio.id = 'murotal-audio';
    audio.preload = 'none';
    document.body.appendChild(audio);
  }
  audio.addEventListener('play', () => { state.isPlaying = true; syncPlayerDock(); });
  audio.addEventListener('pause', () => { state.isPlaying = false; syncPlayerDock(); });
  audio.addEventListener('ended', handleAyahEnded);
  audio.addEventListener('error', () => {
    state.isPlaying = false;
    syncPlayerDock();
    toast('Audio ayat gagal diputar. Periksa koneksi atau unduh surat untuk putar offline.');
  });
}

function handleAyahEnded() {
  if (!activeSurahData) return;
  if (state.repeatAyah) {
    audio.currentTime = 0;
    audio.play().catch(() => {});
    return;
  }
  const total = activeSurahData.ayat.length;
  if (state.ayahNum < total) {
    playAyah(state.ayahNum + 1, true);
  } else {
    state.isPlaying = false;
    syncPlayerDock();
    toast(`Selesai Surat ${activeSurahData.namaLatin}.`);
  }
}

export function renderMurotal(surahParam = null) {
  const num = surahParam ? Number(surahParam) : null;
  window.scrollTo(0, 0);
  if (num && num >= 1 && num <= 114) {
    openSurahPlayer(num);
  } else {
    state.surahNum = null;
    hidePlayerDock();
    renderSurahList();
  }
}

function renderSurahList(filter = '') {
  const view = document.getElementById('view-murotal');
  if (!view) return;

  view.innerHTML = `
    <div class="topbar">
      <button type="button" class="back" id="murotal-back-home" aria-label="Kembali">‹</button>
      <h1>114 Surat</h1>
    </div>
    <div class="toolbar">
      <input class="search" id="surah-search" placeholder="Cari surat (mis. Al-Fatihah, Yasin, 36)..." value="${escapeHtml(filter)}">
    </div>
    <div class="surah-list" id="surah-list-items"></div>
    <p class="note">Sumber teks Arab (Utsmani) &amp; terjemah Kemenag: equran.id API v2. Audio qari dari cdn.equran.id. Buka surat untuk membaca, mendengarkan per ayat, atau unduh offline.</p>
  `;

  $('#murotal-back-home', view).addEventListener('click', () => navigate('home'));
  const searchEl = $('#surah-search', view);
  const paintItems = (qText) => {
    const q = qText.trim().toLowerCase();
    const list = surahs.filter((s) => {
      const blob = `${s.number} ${s.name_latin} ${s.name_ar} ${s.meaning_id}`.toLowerCase();
      return !q || blob.includes(q);
    });
    const container = document.getElementById('surah-list-items');
    if (!container) return;
    container.innerHTML = list.map((s) => {
      const offline = isSurahOfflineAny(s.number);
      return `
        <button type="button" class="surah-card" data-surah="${s.number}">
          <div class="num">${s.number}</div>
          <div class="surah-info">
            <div class="latin">${escapeHtml(s.name_latin)} ${offline ? '<span class="badge-offline">Offline</span>' : ''}</div>
            <div class="meta">${escapeHtml(s.meaning_id)} · ${s.ayah_count} ayat · ${escapeHtml(s.revelation)}</div>
          </div>
          <div class="ar">${escapeHtml(s.name_ar)}</div>
        </button>`;
    }).join('') || '<p class="empty">Tidak ada surat yang cocok.</p>';

    $all('.surah-card', container).forEach((btn) => {
      btn.addEventListener('click', () => navigate(`murotal/${btn.dataset.surah}`));
    });
  };

  paintItems(filter);
  searchEl.addEventListener('input', (e) => paintItems(e.target.value));
}

async function fetchSurahData(num) {
  const cached = await idbGetSurah(num);
  if (cached && Array.isArray(cached.ayat) && cached.ayat.length > 0) {
    return cached;
  }
  const res = await fetch(`https://equran.id/api/v2/surat/${num}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json?.data?.ayat) throw new Error('Format surat tidak valid');
  await idbPutSurah(json.data);
  return json.data;
}

async function openSurahPlayer(num) {
  const view = document.getElementById('view-murotal');
  if (!view) return;
  const switchingSurah = state.surahNum !== num;
  state.surahNum = num;
  if (switchingSurah) {
    state.ayahNum = 1;
    state.isPlaying = false;
    if (audio) { audio.pause(); audio.removeAttribute('src'); }
  }

  const meta = surahs.find((x) => x.number === num) || { number: num, name_latin: `Surat ${num}`, name_ar: '', ayah_count: '', revelation: '', meaning_id: '' };

  view.innerHTML = `
    <div class="topbar">
      <button type="button" class="back" id="player-back" aria-label="Daftar surat">‹</button>
      <h1>${escapeHtml(meta.name_latin)}</h1>
      <button type="button" class="ghost-pill ${getSettings().showLatin ? 'on' : ''}" id="toggle-latin" title="Tampilkan transliterasi Latin">Latin</button>
    </div>
    <div class="player-head">
      <div class="sname">Surat ${num} · ${meta.ayah_count} ayat · ${escapeHtml(meta.revelation)}${meta.meaning_id ? ' · ' + escapeHtml(meta.meaning_id) : ''}</div>
      <div class="ar-title">${escapeHtml(meta.name_ar)}</div>
    </div>
    <div class="ayahs" id="ayahs-list">
      <div class="card muted" style="text-align:center;padding:24px">Memuat ayat dari equran.id…</div>
    </div>
    <p class="source-note">Teks Arab (Utsmani), Latin, dan Terjemah Kemenag RI: equran.id API v2. Audio: cdn.equran.id.</p>
  `;

  $('#player-back', view).addEventListener('click', () => navigate('murotal'));
  $('#toggle-latin', view).addEventListener('click', (e) => {
    const next = !getSettings().showLatin;
    saveSettings({ showLatin: next });
    e.currentTarget.classList.toggle('on', next);
    paintAyahs();
  });

  showPlayerDock();

  try {
    const data = await fetchSurahData(num);
    if (state.surahNum !== num) return; // navigated away while loading
    activeSurahData = data;
    paintAyahs();
    syncPlayerDock();
  } catch (err) {
    const list = document.getElementById('ayahs-list');
    if (list) {
      list.innerHTML = `<div class="card" style="text-align:center;padding:22px">
        <div style="font-weight:800;margin-bottom:6px">Gagal memuat surat</div>
        <div class="muted" style="margin-bottom:12px">Periksa koneksi internet Anda, atau buka surat yang sudah diunduh offline.</div>
        <button type="button" class="btn secondary small" id="retry-surah">Coba lagi</button>
      </div>`;
      document.getElementById('retry-surah')?.addEventListener('click', () => openSurahPlayer(num));
    }
  }
}

function paintAyahs() {
  const list = document.getElementById('ayahs-list');
  if (!list || !activeSurahData) return;
  const showLatin = Boolean(getSettings().showLatin);
  list.innerHTML = activeSurahData.ayat.map((a) => `
    <article class="ayah ${a.nomorAyat === state.ayahNum ? 'current' : ''}" data-ayah="${a.nomorAyat}">
      <div class="ayah-top">
        <span class="n">${a.nomorAyat}</span>
        <span class="ayah-play-hint">${a.nomorAyat === state.ayahNum && state.isPlaying ? 'Sedang diputar' : 'Ketuk untuk putar'}</span>
      </div>
      <div class="ar-text">${escapeHtml(a.teksArab)}</div>
      ${showLatin && a.teksLatin ? `<div class="latin-text">${escapeHtml(a.teksLatin)}</div>` : ''}
      <div class="id-text">${escapeHtml(a.teksIndonesia)}</div>
    </article>
  `).join('');

  $all('.ayah', list).forEach((el) => {
    el.addEventListener('click', () => playAyah(Number(el.dataset.ayah), true));
  });
}

function highlightActiveAyah() {
  const list = document.getElementById('ayahs-list');
  if (!list) return;
  $all('.ayah', list).forEach((el) => {
    const num = Number(el.dataset.ayah);
    const active = num === state.ayahNum;
    el.classList.toggle('current', active);
    const hint = el.querySelector('.ayah-play-hint');
    if (hint) hint.textContent = active && state.isPlaying ? 'Sedang diputar' : 'Ketuk untuk putar';
    if (active) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
}

function playAyah(ayahNum, autoplay = true) {
  if (!activeSurahData || !activeSurahData.ayat.length) return;
  const max = activeSurahData.ayat.length;
  const clamped = Math.max(1, Math.min(max, ayahNum));
  state.ayahNum = clamped;
  const ayahObj = activeSurahData.ayat.find((a) => a.nomorAyat === clamped) || activeSurahData.ayat[0];
  const url = ayahObj?.audio?.[state.reciterId] || Object.values(ayahObj?.audio || {})[0];
  if (!url) {
    toast('Audio tidak tersedia untuk ayat ini.');
    return;
  }
  const isE2e = new URLSearchParams(location.search).has('e2e');
  if (!isE2e) {
    if (audio.src !== url) audio.src = url;
    audio.currentTime = 0;
    if (autoplay) {
      audio.play().catch(() => toast('Ketuk tombol Putar untuk memulai audio.'));
    }
  }
  highlightActiveAyah();
  syncPlayerDock();
}

function togglePlay() {
  if (!activeSurahData) return;
  if (!audio.src || audio.ended) {
    playAyah(state.ayahNum, true);
    return;
  }
  if (audio.paused) {
    audio.play().catch(() => toast('Ketuk lagi untuk memulai audio.'));
  } else {
    audio.pause();
  }
  syncPlayerDock();
}

async function downloadCurrentSurah() {
  if (!activeSurahData || isDownloading) return;
  const num = activeSurahData.nomor;
  const qariId = state.reciterId;

  if (isSurahOfflineForQari(num, qariId)) {
    toast('Surat ini sudah tersimpan offline untuk qari ini.');
    return;
  }
  if (!('caches' in window)) {
    toast('Penyimpanan offline (CacheStorage) tidak didukung browser ini.');
    return;
  }

  isDownloading = true;
  const btn = document.getElementById('dl-surah-btn');
  const setLabel = (txt) => { if (btn) btn.textContent = txt; };

  try {
    await idbPutSurah(activeSurahData);
    const cache = await caches.open(OFFLINE_CACHE);
    const urls = [];
    for (const a of activeSurahData.ayat) {
      if (a.audio?.[qariId]) urls.push(a.audio[qariId]);
    }
    let done = 0;
    const total = urls.length;
    setLabel(`Mengunduh 0/${total}…`);
    // Download in small batches of 4 to stay gentle on connection
    for (let i = 0; i < urls.length; i += 4) {
      const chunk = urls.slice(i, i + 4);
      await Promise.all(chunk.map(async (u) => {
        const res = await fetch(u, { mode: 'no-cors' });
        await cache.put(u, res);
        done += 1;
        setLabel(`Mengunduh ${done}/${total}…`);
      }));
    }
    const meta = getOfflineMeta();
    meta[`${num}:${qariId}`] = Date.now();
    setOfflineMeta(meta);
    toast(`Surat ${activeSurahData.namaLatin} tersimpan offline (${total} ayat).`);
  } catch (err) {
    toast('Gagal mengunduh surat. Periksa koneksi internet.');
  } finally {
    isDownloading = false;
    syncPlayerDock();
  }
}

function showPlayerDock() {
  const dock = document.getElementById('murotal-player');
  if (!dock) return;
  dock.classList.add('show');
  dock.style.display = 'flex';
  document.body.classList.add('has-player');
  const recOpts = reciters.map((r) =>
    `<option value="${r.id}" ${r.id === state.reciterId ? 'selected' : ''}>${escapeHtml(r.name_id)}</option>`
  ).join('');

  dock.innerHTML = `
    <div class="controls">
      <select class="qari" id="player-qari" aria-label="Pilih Qari">${recOpts}</select>
    </div>
    <div class="controls">
      <button type="button" class="ctrl" id="prev-ayah" aria-label="Ayat sebelumnya">‹ Ayat</button>
      <button type="button" class="ctrl primary" id="toggle-ayah">▶ Putar ayat ${state.ayahNum}</button>
      <button type="button" class="ctrl" id="next-ayah" aria-label="Ayat berikutnya">Ayat ›</button>
    </div>
    <div class="controls">
      <button type="button" class="ctrl ${state.repeatAyah ? 'active' : ''}" id="repeat-ayah-btn">↻ Ulang ayat</button>
      <button type="button" class="ctrl" id="dl-surah-btn">↓ Unduh surat</button>
    </div>
  `;

  $('#player-qari', dock).addEventListener('change', (e) => {
    state.reciterId = e.target.value;
    saveSettings({ reciterId: state.reciterId });
    const wasPlaying = !audio.paused && Boolean(audio.src);
    if (audio) { audio.pause(); audio.removeAttribute('src'); }
    if (wasPlaying) playAyah(state.ayahNum, true);
    else syncPlayerDock();
  });

  $('#prev-ayah', dock).addEventListener('click', () => {
    if (!activeSurahData) return;
    playAyah(Math.max(1, state.ayahNum - 1), true);
  });

  $('#next-ayah', dock).addEventListener('click', () => {
    if (!activeSurahData) return;
    playAyah(Math.min(activeSurahData.ayat.length, state.ayahNum + 1), true);
  });

  $('#toggle-ayah', dock).addEventListener('click', togglePlay);

  $('#repeat-ayah-btn', dock).addEventListener('click', () => {
    state.repeatAyah = !state.repeatAyah;
    syncPlayerDock();
    toast(state.repeatAyah ? 'Ulang ayat aktif.' : 'Ulang ayat dimatikan.');
  });

  $('#dl-surah-btn', dock).addEventListener('click', downloadCurrentSurah);
  syncPlayerDock();
}

function hidePlayerDock() {
  const dock = document.getElementById('murotal-player');
  if (!dock) return;
  dock.classList.remove('show');
  dock.style.display = 'none';
  document.body.classList.remove('has-player');
}

function syncPlayerDock() {
  const dock = document.getElementById('murotal-player');
  if (!dock || !dock.classList.contains('show')) return;
  const playBtn = $('#toggle-ayah', dock);
  if (playBtn) {
    playBtn.textContent = state.isPlaying ? `⏸ Jeda ayat ${state.ayahNum}` : `▶ Putar ayat ${state.ayahNum}`;
  }
  const repBtn = $('#repeat-ayah-btn', dock);
  if (repBtn) repBtn.classList.toggle('active', state.repeatAyah);

  const dlBtn = $('#dl-surah-btn', dock);
  if (dlBtn && !isDownloading && state.surahNum) {
    const saved = isSurahOfflineForQari(state.surahNum, state.reciterId);
    dlBtn.textContent = saved ? '✓ Tersimpan offline' : '↓ Unduh surat';
    dlBtn.classList.toggle('active', saved);
  }
  highlightActiveAyah();
}

export function isPlayerViewOpen() {
  return state.surahNum !== null;
}
