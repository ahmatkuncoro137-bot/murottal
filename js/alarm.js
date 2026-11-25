import { $, $all, escapeHtml, getSettings, saveSettings, loadJSON, toast, todayKey, navigate } from './util.js';
import { PRAYER_META, computePrayerTimes } from './prayer.js';

let voices = [];
let azanAudio;
const fired = new Set();

export async function initAlarm() {
  const data = await loadJSON('data/azan.json');
  voices = data.voices;
  azanAudio = document.getElementById('azan-audio');
  if (!azanAudio) {
    azanAudio = document.createElement('audio');
    azanAudio.id = 'azan-audio';
    azanAudio.preload = 'auto';
    document.body.appendChild(azanAudio);
  }
  const s = getSettings();
  const v = voices.find((x) => x.id === s.azanId) || voices[0];
  if (!new URLSearchParams(location.search).has('e2e')) {
    azanAudio.src = v.file;
  }
}

export function getAzanVoices() {
  return voices;
}

export function alarmSummary(s = getSettings()) {
  const fardKeys = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
  const activeCount = fardKeys.filter((k) => s.alarms?.[k]).length;
  const v = voices.find((x) => x.id === s.azanId) || voices[0];
  const early = Number(s.earlyMinutes || 0);
  const earlyTxt = early > 0 ? `${early} menit sebelumnya` : 'Tepat waktu shalat';
  const voiceName = v ? v.name : 'Masjidil Haram';
  return `${activeCount} shalat aktif · ${earlyTxt} · ${voiceName}`;
}

export function renderAzan() {
  const view = document.getElementById('view-azan');
  const s = getSettings();
  view.innerHTML = `
    <div class="topbar">
      <button type="button" class="back" id="azan-back" aria-label="Kembali">‹</button>
      <h1>Suara Azan</h1>
    </div>
    <p class="note">Pilih suara azan. Berkas tersimpan lokal di aplikasi (sumber Wikimedia Commons, lisensi terbuka). Kredit penulis dan lisensi dicantumkan sesuai ketentuan.</p>
    <div class="stack">
      ${voices.map((v) => `
        <label class="voice-item ${s.azanId === v.id ? 'is-selected' : ''}">
          <div class="voice-meta">
            <div class="voice-name">${escapeHtml(v.name_id)}</div>
            ${v.style ? `<div class="muted">${escapeHtml(v.style)}</div>` : ''}
            <div class="license">${escapeHtml(v.author)} · ${escapeHtml(v.license)} · <a href="${escapeHtml(v.source_url)}" target="_blank" rel="noopener">Sumber</a></div>
          </div>
          <button type="button" class="btn secondary small preview-azan" data-id="${v.id}">Putar</button>
          <input type="radio" name="azan-voice" value="${v.id}" ${s.azanId === v.id ? 'checked' : ''} aria-label="Pilih ${escapeHtml(v.name_id)}">
        </label>
      `).join('')}
    </div>
    <p class="btn-row" style="margin-top:14px">
      <button type="button" class="btn secondary" id="goto-alarm">Atur Pengingat Per Shalat</button>
    </p>
  `;
  $('#azan-back', view).addEventListener('click', () => navigate('alarm'));
  $('#goto-alarm', view).addEventListener('click', () => navigate('alarm'));
  $all('input[name=azan-voice]', view).forEach((r) => r.addEventListener('change', () => {
    saveSettings({ azanId: r.value });
    const v = voices.find((x) => x.id === r.value);
    if (v) azanAudio.src = v.file;
    toast('Suara azan disimpan.');
    renderAzan();
  }));
  $all('.preview-azan', view).forEach((b) => b.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    preview(b.dataset.id);
  }));
}

export function renderAlarm() {
  const view = document.getElementById('view-alarm');
  const s = getSettings();
  const { rows } = computePrayerTimes(new Date(), s);
  const timeByKey = Object.fromEntries(rows.map((r) => [r.key, r.timeLabel]));

  const alarmItems = [
    ...PRAYER_META.filter((p) => p.key !== 'sunrise').map((p) => ({
      key: p.key,
      name: p.name,
      sub: p.alias ? `${p.alias} · Setiap hari` : 'Setiap hari',
      time: timeByKey[p.key] || '--:--'
    })),
    { key: 'imsak', name: 'Imsak', sub: `${s.imsakOffset ?? 10} menit sebelum Subuh`, time: timeByKey.imsak || '--:--' }
  ];

  const switchRows = alarmItems.map((p) => `
    <label class="toggle-row">
      <div class="toggle-info">
        <strong>${escapeHtml(p.name)}</strong>
        <span class="muted">${escapeHtml(p.sub)}</span>
      </div>
      <span class="time">${escapeHtml(p.time)}</span>
      <span class="switch-wrap">
        <input type="checkbox" class="sr-switch" data-alarm="${p.key}" ${s.alarms[p.key] ? 'checked' : ''} aria-label="Aktifkan azan ${escapeHtml(p.name)}">
        <span class="switch ${s.alarms[p.key] ? 'on' : ''}"><i></i></span>
      </span>
    </label>
  `).join('');

  const earlyOptions = [
    { val: 0, label: 'Tidak' },
    { val: 5, label: '5 menit' },
    { val: 10, label: '10 menit' },
    { val: 15, label: '15 menit' },
    { val: 20, label: '20 menit' }
  ];

  const currentVoice = voices.find((v) => v.id === s.azanId) || voices[0];

  view.innerHTML = `
    <div class="topbar">
      <button type="button" class="back" id="alarm-back" aria-label="Kembali">‹</button>
      <h1>Pengingat &amp; Azan</h1>
    </div>
    <p class="hint">Azan berbunyi tepat pada waktu shalat saat aplikasi terbuka. Pengingat lebih awal muncul sebelum masuk waktu shalat.</p>

    <div class="block-title">Aktifkan per shalat</div>
    <div class="toggle-list">${switchRows}</div>

    <div class="block-title">Pengingat lebih awal</div>
    <p class="hint" style="padding-bottom:6px">Notifikasi pengingat sebelum waktu shalat (azan tetap berbunyi tepat pada waktunya).</p>
    <div class="chips" id="early-chips">
      ${earlyOptions.map((o) => `
        <button type="button" class="chip ${Number(s.earlyMinutes) === o.val ? 'on' : ''}" data-early="${o.val}">${o.label}</button>
      `).join('')}
    </div>

    <div class="block-title">Suara azan</div>
    <div class="chips" id="voice-chips">
      ${voices.map((v) => `
        <button type="button" class="chip ${s.azanId === v.id ? 'on' : ''}" data-voice="${v.id}">${escapeHtml(v.name)}</button>
      `).join('')}
    </div>
    ${currentVoice ? `<p class="hint" style="margin-top:6px">Dipilih: <strong>${escapeHtml(currentVoice.name_id)}</strong> (${escapeHtml(currentVoice.author)} · ${escapeHtml(currentVoice.license)}). <a href="#/azan" class="inline-link">Lihat semua &amp; sumber ›</a></p>` : ''}

    <p class="btn-row">
      <button type="button" class="btn" id="test-azan">Uji bunyi azan</button>
      <button type="button" class="btn secondary" id="ask-notif">Izinkan notifikasi</button>
    </p>

    <p class="note"><strong>Catatan PWA:</strong> di browser/PWA, azan dan pengingat berbunyi andal selama aplikasi terbuka atau berada di layar depan. Sistem HP (terutama iOS dan sebagian Android) dapat menghentikan timer saat aplikasi ditutup atau layar tidur. Untuk azan otomatis di latar belakang, dibutuhkan build aplikasi Android/Capacitor dengan notifikasi lokal sistem.</p>
  `;

  $('#alarm-back', view).addEventListener('click', () => navigate('home'));

  $all('[data-alarm]', view).forEach((cb) => cb.addEventListener('change', () => {
    const alarms = { ...getSettings().alarms, [cb.dataset.alarm]: cb.checked };
    saveSettings({ alarms });
    const pill = cb.parentElement.querySelector('.switch');
    if (pill) pill.classList.toggle('on', cb.checked);
  }));

  $all('[data-early]', view).forEach((btn) => btn.addEventListener('click', () => {
    const val = Number(btn.dataset.early);
    saveSettings({ earlyMinutes: val });
    $all('[data-early]', view).forEach((b) => b.classList.toggle('on', Number(b.dataset.early) === val));
    toast(val > 0 ? `Pengingat ${val} menit sebelum shalat disimpan.` : 'Pengingat lebih awal dimatikan.');
  }));

  $all('[data-voice]', view).forEach((btn) => btn.addEventListener('click', () => {
    const id = btn.dataset.voice;
    saveSettings({ azanId: id });
    const v = voices.find((x) => x.id === id);
    if (v) azanAudio.src = v.file;
    renderAlarm();
    toast(`Suara azan: ${v?.name || id}`);
  }));

  $('#ask-notif', view).addEventListener('click', askNotif);
  $('#test-azan', view).addEventListener('click', () => preview(getSettings().azanId));
}

async function askNotif() {
  if (!('Notification' in window)) { toast('Notifikasi tidak didukung browser ini.'); return; }
  const perm = await Notification.requestPermission();
  saveSettings({ notificationsAsked: true });
  toast(perm === 'granted' ? 'Notifikasi diizinkan selama aplikasi terbuka.' : 'Izin notifikasi tidak diberikan.');
}

export function preview(id = getSettings().azanId) {
  const v = voices.find((x) => x.id === id) || voices[0];
  if (!v) return;
  azanAudio.src = v.file;
  azanAudio.currentTime = 0;
  azanAudio.play()
    .then(() => {
      const banner = document.getElementById('alarm-banner');
      if (banner) {
        banner.innerHTML = `<strong>Uji Suara Azan</strong><div>${escapeHtml(v.name_id)}</div><button type="button" class="btn secondary small" id="stop-azan" style="margin-top:8px">Hentikan</button>`;
        banner.classList.add('show');
        document.getElementById('stop-azan').addEventListener('click', stopAzanBanner);
      }
    })
    .catch(() => toast('Ketuk lagi untuk memutar azan.'));
}

function stopAzanBanner() {
  if (azanAudio) {
    azanAudio.pause();
    azanAudio.currentTime = 0;
  }
  const banner = document.getElementById('alarm-banner');
  if (banner) banner.classList.remove('show');
}

export function tickAlarms(now = new Date()) {
  const s = getSettings();
  const { rows, tz } = computePrayerTimes(now, s);
  const earlyMin = Number(s.earlyMinutes || 0);
  const earlyMs = earlyMin * 60 * 1000;
  const day = todayKey(tz);

  for (const row of rows) {
    if (!s.alarms[row.key]) continue;

    // 1. Pre-reminder (e.g. 10 minutes before)
    if (earlyMin > 0) {
      const preAt = new Date(row.when.getTime() - earlyMs);
      const preKey = `${day}-${row.key}-pre-${earlyMin}`;
      if (!fired.has(preKey) && now >= preAt && now < preAt.getTime() + 60 * 1000) {
        fired.add(preKey);
        triggerPreReminder(row, earlyMin);
      }
    }

    // 2. Exact prayer-time azan
    const exactKey = `${day}-${row.key}-exact`;
    if (!fired.has(exactKey) && now >= row.when && now < row.when.getTime() + 60 * 1000) {
      fired.add(exactKey);
      triggerAlarm(row, s);
    }
  }
}

function triggerPreReminder(row, minutes) {
  toast(`Pengingat: ${minutes} menit lagi menuju ${row.name} (${row.timeLabel})`, 5000);
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(`${minutes} menit menuju ${row.name}`, {
        body: `Waktu ${row.name} pukul ${row.timeLabel}. Bersiap untuk shalat.`,
        icon: 'assets/icons/icon-192.png'
      });
    } catch { /* ignore */ }
  }
}

function triggerAlarm(row, s) {
  const v = voices.find((x) => x.id === s.azanId) || voices[0];
  if (v) {
    azanAudio.src = v.file;
    azanAudio.currentTime = 0;
    azanAudio.play().catch(() => {});
  }
  const banner = document.getElementById('alarm-banner');
  if (banner) {
    banner.innerHTML = `<strong>Waktu ${escapeHtml(row.name)}</strong><div>${escapeHtml(row.timeLabel)} · ${escapeHtml(v?.name || 'Azan')}</div><button type="button" class="btn secondary small" id="stop-azan" style="margin-top:8px">Hentikan</button>`;
    banner.classList.add('show');
    document.getElementById('stop-azan').addEventListener('click', stopAzanBanner);
  }
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(`Waktu ${row.name}`, { body: `Sekarang waktu ${row.name} (${row.timeLabel}).`, icon: 'assets/icons/icon-192.png' });
    } catch { /* ignore */ }
  }
}

export function resetAlarmsForNewDay() {
  fired.clear();
}

export function stopAzan() {
  stopAzanBanner();
}

export { voices };
