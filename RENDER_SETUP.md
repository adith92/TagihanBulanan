# 🚀 Render PostgreSQL: aktivasi aplikasi TagihanBulanan

## Sumber data

- `Tagihan Listrik Sekolahan.numbers` sudah diekstrak: **83 bulan, 2.440 baris**, 71 master tagihan, 6 kategori.
- Semua data disimpan di private Drive dan seed terenkripsi `seed/initial.enc`.
- Tidak menggunakan Google Apps Script.

## Resource Render yang sudah dibuat

- Workspace: `GoldenBirdProject`, region `singapore`
- PostgreSQL 18: `dpg-dbequp9srm7s73d2g0eg-a`, database `tagihanbulanan_db`, dashboard https://dashboard.render.com/d/dpg-dbequp9srm7s73d2g0eg-a
- Node web: `srv-dbeqv45g1s2s73dgohtg`, URL https://tagihanbulanan.onrender.com
- Branch `render/postgres-v4` (otomatis deploy dari branch ini)

## Menyelesaikan koneksi

1. Database → **Connect** → **Internal Database URL**.
2. Web service → **Environment** → Add env `DATABASE_URL` menggunakan URL dari langkah 1, tidak ada kutip. Jangan masukkan ke README, tiket, chat, atau repo.
3. `INITIAL_SEED_KEY` sudah disiapkan secara rahasia di file khusus Drive dan dapat dikonfigurasi pada Render Environment. Harus berisi kunci hex 64 karakter untuk membuka `seed/initial.enc`.
4. Deploy/restart otomatis setelah env berubah. Periksa `/api/health`; harus `storageReady:true`.
5. Verifikasi di Render SQL: `SELECT count(*), count(distinct period) FROM bill_history;` mengharapkan 2440 dan 83.
6. Periksa bulan paling awal 2019-11 dan terakhir 2026-10, lalu uji `Save → refresh`.

**Jangan mengasumsikan selesai jika `/api/health` belum sukses.** Data tidak boleh diisi ulang manual. Seed mengimpor file asli otomatis jika database benar-benar kosong.

## Keamanan dan backup

Pengguna meminta akses tanpa password. Situs terbuka berarti data pelanggan terbuka bagi siapa pun yang memiliki URL. Gunakan sistem pembatasan akses di tingkat jaringan/proksi bila diperlukan. PostgreSQL Free kedaluwarsa pada 24 November 2026 dan tidak menyediakan backup terkelola bawaan. Simpan backup Drive terpisah dan upgrade sebelum kedaluwarsa.
