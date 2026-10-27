# Setup TagihanBulanan Render setelah penghapusan (27 Oktober 2026)

**Web dan database TagihanBulanan lama sudah tidak ditemukan di Render.** Tidak ada deployment baru yang dibuat. Proyek Render lain dalam workspace **jangan disentuh**.

- Source: https://github.com/adith92/TagihanBulanan
- Data awal terenkripsi: `seed/initial.enc`, manifest di `seed/manifest.json`
- Kunci pribadi: `INITIAL_SEED_KEY` ada pada file terpisah milik pemilik; **bukan di GitHub**.
- Data pada GitHub adalah arsip Numbers tanggal 25 Oktober 2026 (83 periode, 2440 baris, 71 master), **bukan salinan terakhir PostgreSQL yang sudah dihapus**.

Saat diminta deploy ulang:
1. Buat database PostgreSQL Render baru dan web service Node 24 baru dari `main` atau `render/postgres-v4`.
2. Build `npm install`, start `npm start`.
3. Pasang `DATABASE_URL` (URL internal database BARU) dan `INITIAL_SEED_KEY` (kunci privat baru).
4. Verifikasi `/api/health`, catatan jumlah baris dan migrasi Oktober dari screenshot, lalu Save/Reload sebelum menganggap backup terpulihkan.
5. Jika diinginkan backup GitHub harian, aktifkan workflow `.github/workflows/encrypted-db-backup.yml` dengan GitHub Actions secret `TAGIHAN_BACKUP_KEY` dan vars `TAGIHAN_API_URL` serta `TAGIHAN_AUTO_BACKUP=true`.

**Keamanan:** Repo GitHub bersifat publik. Jangan commit JSON pelanggan, password PostgreSQL, atau kunci AES secara mentah. Situs sebelumnya tanpa login; perbaiki keamanan sebelum produksi ulang.

[Lihat panduan restore](docs/RECOVERY_AFTER_RENDER_DELETE.md).
