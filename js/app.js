import { $, escapeHtml, getSettings, saveSettings, loadJSON, formatClock, formatGregorian, formatHijri, formatCountdown, toast, navigate, route, todayKey } from './util.js';
import { METHODS, nextPrayerInfo, imsakAndBuka, qiblaFrom } from './prayer.js';
import { initMurotal, renderMurotal, isPlayerViewOpen } from './murotal.js';
import { initDoa, renderDoa } from './doa.js';
import { renderQibla, stopQibla, paintCompassIn, compassMarkup } from './qibla.js';
import { initAlarm, renderAzan, renderAlarm, tickAlarms, resetAlarmsForNewDay, alarmSummary } from './alarm.js';

const VIEWS = ['home', 'murotal', 'doa', 'qibla', 'azan', 'alarm', 'premium', 'settings', 'lainnya'];

let cities = [];

const WORDMARK_ORNAMENT = '<span class="wm-ornament" aria-hidden="true"><i class="wm-rule"></i><svg viewBox="0 0 16 16" width="11" height="11"><path fill="currentColor" d="M8 0l1.15 6.85L16 8l-6.85 1.15L8 16l-1.15-6.85L0 8l6.85-1.15Z"/></svg><i class="wm-rule"></i></span>';

function showView(name) {
  const isTeal = name !== 'home';
  document.body.classList.toggle('theme-teal', isTeal);
  document.documentElement.classList.toggle('theme-teal', isTeal);
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.setAttribute('content', isTeal ? '#0b4f55' : '#f6f1e8');
  for (const v of VIEWS) {
    const el = document.getElementById('view-' + v);
    if (el) el.classList.toggle('active', v === name);
  }
  const tabMap = { home: 'home', murotal: 'murotal', qibla: 'qibla' };
  document.querySelectorAll('.tab').forEach((t) => {
    const active = tabMap[name] === t.dataset.view || (t.dataset.view === 'lainnya' && !tabMap[name]);
    t.classList.toggle('active', active);
  });
  if (name !== 'qibla') stopQibla();

  window.scrollTo(0, 0);
  const player = document.getElementById('murotal-player');
  if (player) {
    const showP = (name === 'murotal' && isPlayerViewOpen());
    player.style.display = showP ? 'flex' : 'none';
    document.body.classList.toggle('has-player', showP);
  }
}

function fardRowsFrom(allRows) {
  const keys = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
  return keys.map((k) => allRows.find((r) => r.key === k)).filter(Boolean);
}

function nextFardPrayer(s, now) {
  const next = nextPrayerInfo(s, now);
  const fardKeys = new Set(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']);
  if (fardKeys.has(next.key)) return next;
  // If next in allRows happened to be imsak or sunrise, display next fard for the 5-pill highlight & card
  const fards = fardRowsFrom(next.all);
  for (const r of fards) {
    if (r.when > now) return { ...r, isTomorrow: false, tz: next.tz, all: next.all };
  }
  // Otherwise tomorrow's Fajr
  return next;
}

function renderHome() {
  const s = getSettings();
  const next = nextFardPrayer(s, new Date());
  const ib = imsakAndBuka(s);
  const q = qiblaFrom(s);
  const view = document.getElementById('view-home');
  const now = new Date();
  const fards = fardRowsFrom(next.all);

  const pills = fards.map((r) => {
    const isNext = r.key === next.key && !next.isTomorrow;
    return `
      <div class="t ${isNext ? 'is-next' : ''}">
        <span class="n">${escapeHtml(r.name)}</span>
        <span class="v">${escapeHtml(r.timeLabel)}</span>
      </div>`;
  }).join('');

  view.innerHTML = `
    <header class="header">
      <img class="palm-bg" src="assets/palm.png" alt="">
      <div class="palm-fade" aria-hidden="true"></div>
      <div class="header-top">
        <div class="greet">Assalamu’alaikum</div>
      </div>
      <h1 class="wordmark">
        <span class="wm-text">Muro<span>ttal</span></span>
        ${WORDMARK_ORNAMENT}
      </h1>
      <div class="date">
        <span id="greg-date">${escapeHtml(formatGregorian(now, next.tz))}</span> · <span id="hijri-date">${escapeHtml(formatHijri(now, next.tz))}</span><br>
        <span class="clock-inline" id="live-clock">${formatClock(now, next.tz)}</span><button type="button" class="loc-pill" id="loc-open" title="Ubah kota atau lokasi">${escapeHtml(s.coords.label)} ›</button>
      </div>
    </header>

    <div class="home-stack">
      <section class="card next-card" id="next-card" aria-label="Shalat berikutnya">
        <div class="kicker">${next.isTomorrow ? 'Shalat berikutnya (besok)' : 'Shalat berikutnya'}</div>
        <div class="next-line">
          <div class="pname">${escapeHtml(next.name)}</div>
          <div class="ptime">${escapeHtml(next.timeLabel)}</div>
        </div>
        <div class="count" id="countdown"><strong>${formatCountdown(next.when - now)}</strong><span>menuju ${escapeHtml(next.name)}</span></div>
        <div class="times" aria-label="Lima waktu shalat">${pills}</div>
      </section>

      <section class="card ib-strip" aria-label="Imsak dan Buka puasa">
        <div class="ib-item">
          <span class="ib-kicker">Imsak</span>
          <strong id="imsak-time">${escapeHtml(ib.imsak.todayLabel)}</strong>
          <span class="ib-sub" id="imsak-count">${formatCountdown(ib.imsak.when - now)}${ib.imsak.isTomorrow ? ' (besok)' : ''}</span>
        </div>
        <div class="ib-divider" aria-hidden="true"></div>
        <div class="ib-item">
          <span class="ib-kicker">Buka puasa</span>
          <strong id="buka-time">${escapeHtml(ib.buka.todayLabel)}</strong>
          <span class="ib-sub" id="buka-count">${formatCountdown(ib.buka.when - now)}${ib.buka.isTomorrow ? ' (besok)' : ''}</span>
        </div>
      </section>

      <button type="button" class="card qibla-row" id="home-qibla-card" aria-label="Buka halaman kiblat">
        <div class="qibla-dial">${compassMarkup('home-compass', 'compass-mini')}</div>
        <div class="qibla-text">
          <div class="muted">Kiblat</div>
          <strong id="home-qibla-deg">${q.bearing.toFixed(1)}°</strong>
          <div class="muted" id="home-qibla-live">Dari utara, ke Ka‘bah · ${escapeHtml(s.coords.label)}</div>
        </div>
        <span class="chev">›</span>
      </button>

      <button type="button" class="card settings-row" id="home-alarm-card">
        <div class="bell" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5"/><path d="M9 17a3 3 0 0 0 6 0"/></svg>
        </div>
        <div class="grow">
          <strong>Pengingat &amp; Azan</strong>
          <div class="muted" id="home-alarm-summary">${escapeHtml(alarmSummary(s))}</div>
        </div>
        <span class="chev">›</span>
      </button>

      <div class="menu-label">Menu</div>
      <div class="menu-grid">
        <button type="button" class="tile" data-go="murotal">
          <span class="glyph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5h10a4 4 0 0 1 4 4v11H8a4 4 0 0 0-4 4V5z"/><path d="M16 5a4 4 0 0 1 4 4v11"/></svg></span>
          <span>Murottal</span>
        </button>
        <button type="button" class="tile" data-go="qibla">
          <span class="glyph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 4v2M12 18v2M4 12h2M18 12h2"/><path d="m12 7 2 5-2 2-2-2 2-5Z"/></svg></span>
          <span>Kiblat</span>
        </button>
        <button type="button" class="tile" data-go="alarm">
          <span class="glyph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 18V6l12-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></span>
          <span>Azan</span>
        </button>
        <button type="button" class="tile" data-go="doa">
          <span class="glyph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 4c-3 4-6 6.5-6 10a6 6 0 1 0 12 0c0-3.5-3-6-6-10z"/></svg></span>
          <span>Doa</span>
        </button>
        <button type="button" class="tile" id="tile-waktu">
          <span class="glyph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span>
          <span>Waktu shalat</span>
        </button>
        <button type="button" class="tile" data-go="premium">
          <span class="glyph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.8 6.8 17.9l.9-5.4L3.8 8.7l5.4-.8L12 3z"/></svg></span>
          <span>Premium</span>
        </button>
      </div>

      <div class="ad-banner" aria-label="Placeholder iklan">
        <span class="tag">Iklan</span>
        <p>Ruang iklan di area menu (contoh). Tidak muncul di layar pemutar ayat.</p>
      </div>
    </div>
  `;

  document.getElementById('loc-open').addEventListener('click', () => navigate('settings'));
  document.getElementById('home-qibla-card').addEventListener('click', () => navigate('qibla'));
  document.getElementById('home-alarm-card').addEventListener('click', () => navigate('alarm'));
  document.getElementById('tile-waktu').addEventListener('click', () => {
    document.getElementById('next-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast('Jadwal shalat mengikuti metode ' + (METHODS.find((m) => m.id === s.method)?.label || s.method) + '.');
  });
  view.querySelectorAll('.tile[data-go]').forEach((btn) => btn.addEventListener('click', () => navigate(btn.dataset.go)));
  refreshHomeQibla();
}

function refreshHomeQibla() {
  const root = document.getElementById('home-compass');
  if (!root) return;
  const q = qiblaFrom(getSettings());
  paintCompassIn(root, q.bearing);
  const deg = document.getElementById('home-qibla-deg');
  if (deg) deg.textContent = `${q.bearing.toFixed(1)}°`;
}

function refreshHomeTimes() {
  const view = document.getElementById('view-home');
  if (!view || !view.classList.contains('active')) return;
  const s = getSettings();
  const now = new Date();
  const next = nextFardPrayer(s, now);
  const ib = imsakAndBuka(s, now);

  const clock = document.getElementById('live-clock');
  const count = document.getElementById('countdown');
  if (clock) clock.textContent = formatClock(now, next.tz);
  if (count) count.innerHTML = `<strong>${formatCountdown(next.when - now)}</strong><span>menuju ${escapeHtml(next.name)}</span>`;

  const p = document.querySelector('#next-card .pname');
  if (p && p.textContent !== next.name) {
    renderHome();
    return;
  }
  const it = document.getElementById('imsak-time');
  const ic = document.getElementById('imsak-count');
  const bt = document.getElementById('buka-time');
  const bc = document.getElementById('buka-count');
  if (it) it.textContent = ib.imsak.todayLabel;
  if (ic) ic.textContent = `${formatCountdown(ib.imsak.when - now)}${ib.imsak.isTomorrow ? ' (besok)' : ''}`;
  if (bt) bt.textContent = ib.buka.todayLabel;
  if (bc) bc.textContent = `${formatCountdown(ib.buka.when - now)}${ib.buka.isTomorrow ? ' (besok)' : ''}`;
  refreshHomeQibla();
}

function renderPremium() {
  const view = document.getElementById('view-premium');
  view.innerHTML = `
    <div class="topbar">
      <button type="button" class="back" id="prem-back" aria-label="Kembali">‹</button>
      <h1>Premium</h1>
    </div>
    <p class="hint">Dukungan satu kali, bukan langganan. Harga di bawah hanya <strong>contoh</strong>, bukan tarif final.</p>

    <div class="compare">
      <div class="card col">
        <h3>Gratis</h3>
        <ul>
          <li>Murottal daring</li>
          <li>Beberapa qari</li>
          <li>Waktu shalat &amp; kiblat</li>
          <li>Azan saat waktu shalat</li>
          <li>Ada iklan di menu</li>
          <li>Unduh terbatas</li>
        </ul>
      </div>
      <div class="card col premium">
        <h3>Premium</h3>
        <div class="price">Rp19.000<small>sekali bayar · CONTOH</small></div>
        <ul>
          <li>Tanpa iklan</li>
          <li>Unduh semua surat, offline</li>
          <li>Semua qari</li>
          <li>Mode hafalan</li>
          <li>Tema tambahan</li>
          <li>Azan &amp; pengingat penuh</li>
        </ul>
      </div>
    </div>

    <div class="card" style="margin-top:12px">
      <div class="muted" style="font-weight:700;margin-bottom:6px">Mode hafalan (Premium — rencana)</div>
      <ul class="feat">
        <li><strong>Ulang ayat</strong> — mengulang ayat yang sedang diputar</li>
        <li><strong>Sambung ayat</strong> — lanjut ke ayat berikutnya secara berurutan</li>
        <li><strong>Tes hafalan</strong> — samarkan terjemah atau potongan ayat untuk menguji diri</li>
      </ul>
    </div>

    <div style="margin-top:14px;display:flex;flex-direction:column;gap:10px">
      <button type="button" class="cta gold" id="btn-premium-demo">Aktifkan Premium · Rp19.000 (contoh)</button>
      <div class="donate">
        <button type="button" class="cta ghost" id="btn-donate-demo">Dukung aplikasi</button>
        <p>Tombol donasi (placeholder). Belum terhubung ke sistem pembayaran apa pun.</p>
      </div>
    </div>
  `;
  $('#prem-back', view).addEventListener('click', () => navigate('home'));
  $('#btn-premium-demo', view).addEventListener('click', () => toast('Ini pratinjau Premium (harga contoh). Pembayaran belum diaktifkan.'));
  $('#btn-donate-demo', view).addEventListener('click', () => toast('Terima kasih! Tombol Dukung aplikasi masih placeholder.'));
}

function renderLainnya() {
  const view = document.getElementById('view-lainnya');
  view.innerHTML = `
    <div class="topbar"><h1>Lainnya</h1></div>
    <div class="stack">
      <button type="button" class="surah-card" data-go="alarm">
        <div class="num">🔔</div>
        <div class="surah-info"><div class="latin">Pengingat &amp; Azan</div><div class="meta">Atur per shalat, pengingat 10 menit, dan suara azan</div></div>
        <span class="chev">›</span>
      </button>
      <button type="button" class="surah-card" data-go="azan">
        <div class="num">🔊</div>
        <div class="surah-info"><div class="latin">Suara Azan &amp; Lisensi</div><div class="meta">Putar dan pilih 7 suara azan Wikimedia Commons</div></div>
        <span class="chev">›</span>
      </button>
      <button type="button" class="surah-card" data-go="doa">
        <div class="num">🤲</div>
        <div class="surah-info"><div class="latin">Doa</div><div class="meta">Doa dari Al-Qur'an dan doa harian</div></div>
        <span class="chev">›</span>
      </button>
      <button type="button" class="surah-card" data-go="premium">
        <div class="num">★</div>
        <div class="surah-info"><div class="latin">Premium &amp; Dukung</div><div class="meta">Paket contoh satu kali dan tombol dukungan</div></div>
        <span class="chev">›</span>
      </button>
      <button type="button" class="surah-card" data-go="settings">
        <div class="num">⚙</div>
        <div class="surah-info"><div class="latin">Pengaturan</div><div class="meta">Metode hisab, lokasi, madzhab, Imsak</div></div>
        <span class="chev">›</span>
      </button>
    </div>
    <section class="card" style="margin-top:14px">
      <h3 style="margin-bottom:8px;font-size:15px">Tentang &amp; sumber</h3>
      <p class="muted" style="line-height:1.6">Murottal adalah aplikasi ibadah PWA bertema tenang. Waktu shalat dihitung pustaka <strong>adhan-js</strong> (bawaan Umm al-Qura seperti Nusuk) dan menyesuaikan musim setiap hari. Kiblat: great-circle ke Ka‘bah 21,4225° LU, 39,8262° BT.</p>
      <p class="muted" style="line-height:1.6;margin-top:8px">Al-Qur'an 114 surat, terjemah Kemenag, &amp; audio qari: <strong>equran.id API v2</strong>. Azan: Wikimedia Commons (lihat kredit di menu Suara Azan). Doa Qur'an: api.alquran.cloud. Doa harian: Hisn al-Muslim via hisnmuslim.com.</p>
    </section>
  `;
  view.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => navigate(b.dataset.go)));
}

function renderSettings() {
  const view = document.getElementById('view-settings');
  const s = getSettings();
  const methodOpts = METHODS.map((m) => `<option value="${m.id}" ${s.method === m.id ? 'selected' : ''}>${escapeHtml(m.label)}</option>`).join('');
  const cityOpts = cities.map((c) => `<option value="${c.id}" ${s.cityId === c.id ? 'selected' : ''}>${escapeHtml(c.name_id)} (${escapeHtml(c.country)})</option>`).join('');
  const hint = METHODS.find((m) => m.id === s.method)?.hint || '';

  view.innerHTML = `
    <div class="topbar">
      <button type="button" class="back" id="set-back" aria-label="Kembali">‹</button>
      <h1>Pengaturan</h1>
    </div>
    <div class="stack">
      <label class="setting-row">Metode waktu shalat
        <select class="select" id="method-sel">${methodOpts}</select>
        <div class="muted" id="method-hint">${escapeHtml(hint)}</div>
      </label>
      <label class="setting-row">Madzhab untuk Ashar
        <select class="select" id="madhab-sel">
          <option value="Shafi" ${s.madhab === 'Shafi' ? 'selected' : ''}>Syafi'i (standar Indonesia &amp; Jepang)</option>
          <option value="Hanafi" ${s.madhab === 'Hanafi' ? 'selected' : ''}>Hanafi</option>
        </select>
      </label>
      <label class="setting-row">Selisih Imsak sebelum Subuh
        <select class="select" id="imsak-offset">
          ${[5,10,15,20].map((n) => `<option value="${n}" ${Number(s.imsakOffset) === n ? 'selected' : ''}>${n} menit (Imsak = Subuh dikurangi ${n} menit)</option>`).join('')}
        </select>
        <div class="muted">Praktik umum di Indonesia adalah 10 menit.</div>
      </label>
      <label class="setting-row">Aturan lintang tinggi (musim dingin di utara)
        <select class="select" id="highlat-sel">
          <option value="auto" ${s.highLat === 'auto' ? 'selected' : ''}>Otomatis</option>
          <option value="middle" ${s.highLat === 'middle' ? 'selected' : ''}>Tengah malam</option>
          <option value="seventh" ${s.highLat === 'seventh' ? 'selected' : ''}>Sepertujuh malam</option>
          <option value="angle" ${s.highLat === 'angle' ? 'selected' : ''}>Sudut senja</option>
        </select>
      </label>
      <label class="setting-row">Kota cadangan
        <select class="select" id="city-sel">${cityOpts}</select>
      </label>
    </div>
    <p class="btn-row">
      <button type="button" class="btn" id="use-gps">Gunakan lokasi HP</button>
    </p>
    <p class="note">Lokasi sekarang: ${escapeHtml(s.coords.label)} (${s.coords.lat.toFixed(4)}, ${s.coords.lon.toFixed(4)}) · ${escapeHtml(s.coords.tz)} · sumber: ${escapeHtml(s.coords.source)}</p>
  `;

  $('#set-back', view).addEventListener('click', () => navigate('home'));
  $('#method-sel', view).addEventListener('change', (e) => { saveSettings({ method: e.target.value }); renderSettings(); });
  $('#madhab-sel', view).addEventListener('change', (e) => saveSettings({ madhab: e.target.value }));
  $('#imsak-offset', view).addEventListener('change', (e) => saveSettings({ imsakOffset: Number(e.target.value) }));
  $('#highlat-sel', view).addEventListener('change', (e) => saveSettings({ highLat: e.target.value }));
  $('#city-sel', view).addEventListener('change', (e) => applyCity(e.target.value));
  $('#use-gps', view).addEventListener('click', useGps);
}

function applyCity(id) {
  const c = cities.find((x) => x.id === id);
  if (!c) return;
  saveSettings({
    cityId: id,
    useGps: false,
    coords: { lat: c.lat, lon: c.lon, tz: c.tz, label: `${c.name_id}, ${c.country}`, source: 'kota' }
  });
  toast('Lokasi diganti ke ' + c.name_id);
  renderSettings();
}

function useGps() {
  if (!navigator.geolocation) { toast('GPS tidak tersedia.'); return; }
  toast('Meminta lokasi…');
  navigator.geolocation.getCurrentPosition((pos) => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo';
    saveSettings({
      useGps: true,
      coords: { lat, lon, tz, label: `Lokasi HP (${lat.toFixed(3)}, ${lon.toFixed(3)})`, source: 'gps' }
    });
    toast('Lokasi HP tersimpan.');
    renderSettings();
  }, () => toast('Izin lokasi ditolak. Pakai kota cadangan ya.'), { enableHighAccuracy: true, timeout: 10000 });
}

function applyRoute() {
  const r = route();
  const name = VIEWS.includes(r.name) ? r.name : 'home';
  if (name === 'murotal') renderMurotal(r.rest[0] || null);
  showView(name);
  if (name === 'home') renderHome();
  if (name === 'doa') renderDoa();
  if (name === 'qibla') renderQibla();
  if (name === 'azan') renderAzan();
  if (name === 'alarm') renderAlarm();
  if (name === 'premium') renderPremium();
  if (name === 'settings') renderSettings();
  if (name === 'lainnya') renderLainnya();
}

async function boot() {
  const cityData = await loadJSON('data/cities.json');
  cities = cityData.cities;
  const s = getSettings();
  if (!s.coords || !s.coords.lat) applyCity(cityData.default_id);
  await Promise.all([initMurotal(), initDoa(), initAlarm()]);
  window.addEventListener('hashchange', applyRoute);
  if (!location.hash) location.hash = '#/home';
  else applyRoute();

  let lastDateKey = todayKey(getSettings().coords.tz);
  function refreshForSeasonAndDay(reason) {
    const cur = getSettings();
    const key = todayKey(cur.coords.tz);
    const dateChanged = key !== lastDateKey;
    if (dateChanged) {
      lastDateKey = key;
      resetAlarmsForNewDay();
      if (document.getElementById('view-home')?.classList.contains('active')) renderHome();
      else refreshHomeTimes();
      toast('Jadwal shalat hari ini sudah diperbarui (menyesuaikan musim dan tanggal).');
    } else if (reason === 'resume') {
      if (document.getElementById('view-home')?.classList.contains('active')) {
        const hijri = document.getElementById('hijri-date');
        const nowH = formatHijri(new Date(), cur.coords.tz);
        if (hijri && hijri.textContent !== nowH) renderHome();
        else refreshHomeTimes();
      }
    } else {
      refreshHomeTimes();
    }
    tickAlarms();
  }
  setInterval(() => refreshForSeasonAndDay('tick'), 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshForSeasonAndDay('resume');
  });
  window.addEventListener('pageshow', () => refreshForSeasonAndDay('resume'));
  window.addEventListener('focus', () => refreshForSeasonAndDay('resume'));
  if (!new URLSearchParams(location.search).has('e2e') && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

boot().catch((err) => {
  console.error(err);
  toast('Gagal memuat aplikasi. Muat ulang halaman.');
});
