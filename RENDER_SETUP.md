# 🚀 Migrasi TagihanBulanan ke Render PostgreSQL

**Status:** Kode dan data awal telah disiapkan, **belum dianggap live sebelum Render database dan service sukses dibuat serta diuji.**

## 📚 Data migrasi

- Sumber: `Tagihan Listrik Sekolahan.numbers` SHA256 `23015b90899db3f1b71a03d4b8e54dd61513cb67cc0966f051014883e6dafbe7`.
- 83 bulan, November 2019 hingga Oktober 2026. Tidak ada Februari 2020 pada file asal.
- 2.440 baris, 71 master tagihan, 6 kategori.
- Kolom: nama, nomor pelanggan (string), jumlah, Sudah, Cetak, Toko, kategori, sheet dan baris sumber.
- Penyesuaian kategori dan total sumber perlu direview dari `docs/IMPORT_REPORT.md`.

## 🔐 Mengapa ada seed terenkripsi di repository?

Aplikasi berasal dari repository GitHub publik. File `seed/initial.enc` merupakan **AES-256-GCM encryption** dari JSON lengkap yang dibuat dari file Numbers asli. Repository tidak memuat password ataupun kunci; `INITIAL_SEED_KEY` hanya tersedia sebagai secret di Render. Jangan commit `.seed-key-private`.

Proses saat boot pertama:
1. `DATABASE_URL` menghubungkan Render Web Service ke Render PostgreSQL, **gunakan internal URL** bila region dan workspace sama.
2. `server.mjs` membuat tabel `tracker_state` serta empat SQL Views (`bill_history`, `bill_period_totals`, `bill_categories`, `bill_templates`).
3. Jika tabel belum memiliki data, aplikasi mendekripsi `seed/initial.enc` menggunakan `INITIAL_SEED_KEY` lalu menyimpan 2.440 tagihan secara atomik.
4. Kalau tabel sudah terisi, tidak pernah ditimpa ulang oleh seed saat restart atau redeploy.
5. `GET /api/health` harus `storageReady=true`, dan jumlah pada view harus 2440 serta 83 periode.

## ⚙️ Setup Render

- Workspace yang dituju: `GoldenBirdProject`; region `singapore`.
- Create PostgreSQL: `tagihanbulanan-db` (pilih harga/plan yang memang disetujui oleh pemilik).
- Create Render Node web service dari `adith92/TagihanBulanan`, branch `render/postgres-v4`, build `npm ci` (butuh `package-lock.json` jika tersedia; alternatif `npm install`), start `npm start`.
- Environment: `DATABASE_URL` (Internal Database URL), `INITIAL_SEED_KEY` (secret, 64 digit hex), `NODE_ENV=production`.
- Gunakan storage PostgreSQL, bukan SQLite/local file; local disk Free Web Service sementara.

## 👤 Akses tanpa password

`/api/session` mengembalikan `authenticated=true` dan tidak memunculkan password screen. **Siapa pun yang mengetahui URL website dapat melihat dan menyunting seluruh data**. Tidak dianjurkan untuk internet publik. Jika perlu akses pribadi tanpa mengetik password, gunakan lapisan identitas/akses privat di depan situs (misalnya Cloudflare Access dengan sesi Google yang telah login).

## ⚠️ Ketahanan data Free

Render PostgreSQL Free kadaluwarsa setelah 30 hari dan tidak mendapat backup otomatis. Jangan menganggap aplikasi siap sebagai pencatatan jangka panjang sebelum memilih plan database yang bertahan dan menerapkan backup ke Google Drive.

## ✅ Checklist selesai

- [ ] PostgreSQL dibuat dan dapat diakses dari web service.
- [ ] Backend siap menerima request di Render.
- [ ] `/api/health` menghasilkan `storageReady:true`.
- [ ] `SELECT count(*) FROM bill_history` → 2.440; `count(distinct period)` → 83.
- [ ] Edit satu nilai → Save → refresh browser → data tetap.
- [ ] Riwayat awal November 2019 dan akhir Oktober 2026 terlihat.
- [ ] Backup JSON/Numbers disimpan di Google Drive.
