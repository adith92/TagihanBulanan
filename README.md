# ⚡ TagihanBulanan v5.4.0

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

## v5.1: Optimalisasi lintas perangkat

- **Android dan iOS:** pencarian tagihan memperbarui daftar tanpa membongkar field pencarian. Keyboard virtual tidak lagi dibuat ulang setiap ketikan.
- **Android/iOS saat berpindah aplikasi:** pemeriksaan server dilanjutkan ketika halaman aktif, perangkat kembali online, atau tab dibuka lagi. Draf belum tersimpan tidak pernah ditimpa oleh polling.
- **Mac dan Windows:** font sistem asli menggantikan permintaan Google Fonts eksternal; startup lebih ringan dan tampilan lebih konsisten dengan OS.
- **Tablet:** desain responsif dari v4.3 tetap menggunakan kartu di layar kecil dan tabel dengan kolom di desktop.
- **Semua perangkat:** fokus keyboard lebih jelas, target sentuh disesuaikan, animasi menghormati pengaturan Reduce Motion, status database tetap ditampilkan.
- **Zona waktu:** pemilihan periode awal ditentukan memakai `Asia/Jakarta` secara konsisten walau zona waktu perangkat berbeda.
- **PWA:** versi cache asset `v5.1.0`. Seluruh request `/api/` serta data tagihan tidak dimasukkan ke cache offline.

Seluruh pengembangan dan dokumentasi *versi selanjutnya* disimpan di **GitHub saja**. Jangan otomatis mengunggah file proyek ini ke Google Drive.

## v5.2: Copy nomor pelanggan dan kode bayar

Ketuk nomor di kartu HP, tabel desktop, atau Master Tagihan untuk menyalin **nomor asli secara persis sebagai teks** (termasuk awalan nol). Ikon ⧉ Salin memanggil Clipboard API, dengan fallback untuk browser lama. Tidak mengubah data PostgreSQL dan tidak perlu mengetik ulang nomor pembayaran. Dapat langsung paste ke Blibli, Tokopedia atau aplikasi pembayaran lain.

## v5.3 • Edit per baris dan nomor pelanggan

- Setiap baris tagihan (HP maupun desktop) memiliki tombol ✏️ **Edit**.
- Ubah nomor pelanggan/kode bayar sebagai **teks**, nama, kategori, nominal Rupiah, platform, catatan, serta status Sudah/Cetak.
- Untuk baris berulang, opsi **Perbarui master untuk bulan berikutnya** dapat dicentang/dimatikan. Edit master tidak menyentuh riwayat pembayaran masa lalu.
- Master Tagihan kini memiliki tombol ✏️ Edit untuk nomor pelanggan dan detail tagihan berulang.
- Tombol ⧉ Salin nomor tetap ada. Validasi mencegah memasukkan duplikat identik (nomor + nama + kategori) di periode/master yang sama.
- Simpan menggunakan transaksi PostgreSQL revision-safe. **Riwayat lama bukan data ganda yang boleh dihapus.**
- Dokumentasi versi lama tetap tersimpan dalam riwayat Git untuk pemulihan, tetapi aplikasi dan database live tidak menambahkan duplikat saat deploy.

## v5.4 • Tempel Rupiah langsung dari website

Paste `Rp3.179.571`, `**Rp3.179.571**`, `Rp 3.179.571,00`, atau `IDR 3,179,571` langsung ke kolom Tagihan atau formulir ✏️ Edit. Input segera diformat menjadi Rupiah, dan angka bulat `3179571` dipakai dalam total pembayaran dan auto-save PostgreSQL. Nilai tidak valid (termasuk dua nominal tergabung atau pecahan selain `,00`) ditolak. Riwayat periode lama dan migrasi database tidak disentuh.

Default lebar kolom Tagihan menjadi 204px; pengguna tetap bebas memperbesar/menggeser kolom. Pengaturan lebar yang sebelumnya disimpan di browser tetap dihormati.
