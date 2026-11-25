# Murottal — Sumber, Lisensi, dan Batas Kemampuan

Aplikasi PWA **Murottal** (waktu shalat, kiblat, pengingat & azan, murottal 114 surat, doa).

## Murottal (114 surat, terjemah Kemenag, & audio)
- **Daftar 114 surat, teks Arab (Rasm Utsmani), transliterasi, dan Terjemah Indonesia (Kemenag RI):** diambil dari [equran.id API v2](https://equran.id/api/v2/surat).
- **Audio per ayat & qari:** di-stream dari `cdn.equran.id` untuk 6 qari resmi API equran.id v2 (Misyari Rasyid Al-Afasy, Abdurrahman As-Sudais, Yasir Ad-Dosari, Abdullah Al-Juhany, Abdul Muhsin Al-Qasim, Ibrahim Al-Dossari).
- **Putar offline:** tombol *Unduh surat* menyimpan teks surat di IndexedDB dan berkas MP3 ayat untuk qari yang dipilih di CacheStorage (`murottal-offline-v1`).

## Waktu shalat & kiblat
- **Perhitungan waktu shalat:** pustaka [adhan-js v4.4.6](https://github.com/batoulapps/adhan-js) (lisensi MIT), dibundle di `js/vendor/adhan.umd.min.js`.
- **Metode bawaan:** **Umm al-Qura** (seperti aplikasi Nusuk), dengan pilihan Kemenag RI (20°/18°), Muslim World League, Otoritas Mesir, Singapura (MUIS), dan Turki (Diyanet). Waktu menyesuaikan musim secara otomatis.
- **Imsak & Buka puasa:** Imsak bawaan = Subuh dikurangi 10 menit (dapat diubah di Pengaturan); Buka puasa = Maghrib.
- **Kiblat:** rumus great-circle / `adhan.Qibla` ke Ka‘bah **21,4225° LU, 39,8262° BT** dengan kompas `DeviceOrientation` / `webkitCompassHeading`.

## Azan & pengingat (batas PWA)
- **Berkas azan lokal (`assets/azan/`):** 7 suara dari Wikimedia Commons (lisensi publik / CC0 / CC BY / CC BY-SA). Kredit penulis dan tautan sumber ditampilkan di menu **Suara Azan** dan **Pengingat & Azan**.
- **Pengingat & azan:** pengingat lebih awal (bawaan 10 menit sebelum waktu shalat) dan azan tepat pada waktu shalat berjalan saat aplikasi web terbuka. Di browser HP (terutama iOS dan sebagian Android), timer dapat berhenti saat aplikasi ditutup; azan otomatis di latar belakang membutuhkan build aplikasi Android (mis. Capacitor) dengan notifikasi lokal sistem.

## Doa
- **Doa dari Al-Qur'an:** `api.alquran.cloud` (`quran-uthmani` + `id.indonesian` Kemenag + transliterasi).
- **Doa harian:** Hisn al-Muslim via `hisnmuslim.com`.

## Aset visual & tipografi
- **Pohon kurma:** potongan pohon kurma utama dari foto yang diberikan pemilik.
- **Font:** `Plus Jakarta Sans`, `Noto Naskh Arabic`, dan `Cinzel Decorative` (SIL Open Font License), dibundle di `assets/fonts/`.
- **Monetisasi / Premium:** layar Premium (Rp19.000 contoh), tombol *Dukung aplikasi*, dan banner *Iklan* di area menu beranda bersifat placeholder (tidak ada pembayaran asli dan tidak ada iklan di pemutar ayat).
