# ⚡ TagihanBulanan v5.0.0

**Production:** https://tagihanbulanan.onrender.com  
**Stack:** Node.js 24 LTS, Express 5.3.0, PostgreSQL 18 with pg 8.23.1.  
**Client:** Responsive web/PWA for Android, iOS, iPad, tablets and desktop.

## Data tetap aman

- Data asli diimpor dari `Tagihan Listrik Sekolahan.numbers`: 83 periode, 2.440 baris tagihan dan 71 master. Transaksi terbaru berada di PostgreSQL Render dan **tidak direset selama upgrade**.
- `seed/initial.enc` adalah arsip pemulihan terenkripsi, digunakan hanya jika database baru kosong. Simpan bersama kunci privat yang ada di Render.
- Rekonsiliasi Oktober 2026 diaudit di PostgreSQL; kode migrasi yang diperlukan tetap disimpan.
- PostgreSQL Free kedaluwarsa 24 November 2026. Upgrade paket dan simpan backup eksternal sebelum tanggal tersebut.

## Fitur

- 📱 Kartu tagihan mobile dan tabel desktop yang dapat digeser serta diubah lebarnya.
- 📊 Dashboard, kategori, tagihan bulanan, master, riwayat, impor CSV, ekspor Excel/CSV.
- 💰 Format Rupiah, status Sudah & Cetak, Blibli/Tokopedia.
- ☁️ Autosave ke PostgreSQL, pemeriksaan revisi, penanganan konflik.
- 📲 Manifest PWA & service worker khusus app shell; **transaksi dan respons API tidak di-cache**.

## Jalankan

```bash
npm install
npm test
npm run lint
npm start
```

Render service sudah ada pada branch `render/postgres-v4`, dengan build `npm install`, start `npm start`, region Singapore. **Jangan buat ulang database.**

## Repo yang sudah dirapikan

Branch aktif hanya memuat Node/Express dan PostgreSQL. Legacy Vercel API, Apps Script bridge, konfigurasi Vercel, duplikat library model, skrip development/build Vercel, `render.yaml` blueprint yang tak dipakai, dan changelog lama v4.2 dihapus dari tree aktif. Riwayat commit tetap ada agar dapat dipulihkan.

## Penting: akses publik

Situs ini **tanpa login** sesuai permintaan sebelumnya. Siapa pun yang mengetahui URL bisa membaca dan mengubah data. Untuk data pelanggan, tambahkan gateway autentikasi privat; `X-Robots-Tag` bukan kontrol akses.

[Lihat runbook Render](RENDER_SETUP.md) · [Panduan mobile v4.3](docs/RESPONSIVE_MOBILE_v4.3.md) · [Audit impor](docs/IMPORT_REPORT.md) · [Audit upgrade Context7](docs/UPGRADE_CONTEXT7_2026-10-25.md).
