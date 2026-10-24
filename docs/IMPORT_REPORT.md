# 🧾 Audit Impor Apple Numbers → Google Drive

- 🗓️ **25 Oktober 2026 (Asia/Jakarta)**
- 📄 Sumber: `Tagihan Listrik Sekolahan.numbers`
- ✅ SHA-256 file asli: `23015b90899db3f1b71a03d4b8e54dd61513cb67cc0966f051014883e6dafbe7`
- 📅 Tab bulanan: **83** (November 2019 hingga Oktober 2026; Februari 2020 tidak ada)
- 🧮 Baris tagihan yang diimpor: **2.440**
- 🗂️ Kategori dinormalisasi: **6** (Listrik, Telkom/Telepon, PAM Jakarta, PAM Cianjur, IndiHome/Internet, Listrik Puncak)
- 💾 Lokasi: **private Google Drive JSON**, serta Excel, CSV, Numbers asli dan audit JSON

### ✅ Yang dipertahankan

1. 📆 Periode asal dan nama sheet untuk setiap baris.
2. 🏷️ Kategori, nama tagihan, nomor pelanggan dalam format string agar nol di depan tidak hilang.
3. 💰 Nominal mata uang Rupiah **sebagaimana nilai angka cell**, termasuk 0.
4. ✅ Checkbox `Sudah` (bayar) dan 🖨️ `Cetak` (bukti dicetak) ditransfer terpisah.
5. 🛒 Platform pembayaran `Toko` dan informasi tambahan kolom 7 sebagai catatan.
6. 📝 Nominal kosong tercatat dengan metadata `sourceAmountBlank`, untuk membedakan cell kosong dengan angka nol asli.
7. 🧷 Snapshot setiap bulan, tanpa membalik status pembayaran saat membuat bulan baru.

### ⚠️ Temuan yang perlu diketahui

- **April 2023:** satu judul kategori `a` di sumber berada di antara kelompok Telepon dan PAM Cianjur, dengan nomor pelanggan PAM Jakarta. Kategori ditafsirkan sebagai **Tagihan PAM Jakarta**; koreksi hanya pada metadata kategori, bukan nilai tagihan.
- **Total formula berbeda dari jumlah baris di beberapa periode.** Aplikasi memakai penjumlahan semua nilai di kolom Tagihan, bukan hasil formula subtotal yang keliru/tidak mencakup semua baris. Contoh Oktober 2026: jumlah sel angka Rp15.928.209 sedangkan total tampilan lama Rp13.346.761, selisih Rp2.581.448 yang berkaitan dengan satu baris tagihan. Pengguna perlu meninjau apakah baris itu hendak dikecualikan dari total bisnis.
- **Tidak ada tab Februari 2020** pada file sumber; sistem tidak menciptakan transaksi bulan itu secara otomatis saat impor.
- Daftar pelanggannya adalah data privat dan **tidak ditambahkan ke repo GitHub publik**.

### 🔐 Pembedaan tahap impor

**Data selesai diekstrak dan disimpan di Google Drive pribadi.** Website Vercel masih memerlukan deployment dan otorisasi Google Apps Script untuk mengakses file privat tersebut. Jangan menganggap koneksi live selesai sebelum uji login → Save → refresh berhasil.
