# PROJECT SPEC — Sistem Tagihan Operasional Sekolah YAKIN

## 1. Nama Aplikasi

**Sistem Tagihan Operasional Sekolah YAKIN**

Aplikasi sederhana untuk mencatat, memantau, mencari, mengimpor, dan mencetak laporan tagihan operasional bulanan sekolah.

Header utama untuk laporan cetak/PDF:

**SISTEM TAGIHAN OPERASIONAL SEKOLAH YAKIN**
Subjudul: **Tagihan Listrik Sekolah YAKIN**

---

## 2. Tujuan Utama Aplikasi

Buat aplikasi web sederhana untuk membantu admin sekolah mencatat tagihan bulanan seperti listrik, internet, PAM, Telkom, satelit, dan tagihan operasional lain.

Aplikasi harus bisa:

1. Mencatat tagihan per bulan dan tahun.
2. Menampilkan daftar tagihan dalam bentuk tabel.
3. Memfilter data berdasarkan bulan dan tahun.
4. Mencari data berdasarkan deskripsi, nomor tagihan, kategori, channel pembayaran, dan status bayar.
5. Menghitung total tagihan per kategori.
6. Menghitung total tagihan keseluruhan.
7. Menandai status pembayaran: sudah dibayar atau belum dibayar.
8. Import data dari Excel/CSV.
9. Export data ke Excel/CSV.
10. Export laporan ke PDF siap cetak.

---

## 3. Stack yang Direkomendasikan

Gunakan stack yang paling sederhana dan stabil.

Jika project baru:

* Backend: Laravel
* Database: SQLite untuk development, MySQL untuk production
* Admin UI: Filament / Laravel Blade sederhana
* Export Excel/CSV: gunakan library yang umum di Laravel
* Export PDF: gunakan library PDF yang umum di Laravel
* Styling: Tailwind atau CSS sederhana

Jika project sudah ada:

* Ikuti stack project existing.
* Jangan ubah stack besar-besaran tanpa alasan kuat.
* Prioritaskan aplikasi berjalan stabil dulu.

---

## 4. Role Pengguna

Untuk MVP awal, cukup 1 role:

### Admin

Admin bisa:

* Melihat daftar tagihan
* Menambah tagihan
* Mengedit tagihan
* Menghapus tagihan
* Import data
* Export data
* Cetak PDF
* Melihat total pembayaran per kategori

Auth/login boleh dibuat sederhana. Jika belum diminta, jangan over-engineering role permission.

---

## 5. Struktur Data Utama

Buat tabel database bernama:

`bills` atau `tagihans`

Field minimal:

| Field              | Tipe             | Keterangan                                       |
| ------------------ | ---------------- | ------------------------------------------------ |
| id                 | integer / uuid   | Primary key                                      |
| nomor_urut         | integer          | Nomor urut tampilan                              |
| bulan              | integer          | 1 sampai 12                                      |
| tahun              | integer          | Contoh: 2023, 2024, 2025, 2026                   |
| deskripsi          | string           | Nama tagihan                                     |
| nomor_tagihan      | string nullable  | Nomor pelanggan / nomor tagihan                  |
| jumlah_tagihan     | decimal / bigint | Simpan angka murni, bukan teks Rupiah            |
| channel_pembayaran | enum/string      | Tokopedia, Shopee, Blibli, Website, Tunai        |
| status_bayar       | enum/string      | Sudah Dibayar / Belum Dibayar                    |
| kategori           | enum/string      | Kategori tagihan                                 |
| tanggal_bayar      | date nullable    | Tanggal pembayaran jika sudah dibayar            |
| catatan            | text nullable    | Catatan tambahan                                 |
| bukti_pembayaran   | string nullable  | Path file bukti pembayaran jika nanti diperlukan |
| created_at         | timestamp        | Default                                          |
| updated_at         | timestamp        | Default                                          |

Catatan penting:

* `jumlah_tagihan` harus disimpan sebagai angka murni.
* Format Rupiah hanya untuk tampilan.
* Jangan simpan “Rp1.000.000” sebagai string di database.
* Simpan sebagai `1000000`.

---

## 6. Daftar Kategori Tetap

Kategori hanya boleh dari daftar ini:

1. Listrik
2. Telkom / Telepon / Satelit
3. Tagihan PAM Jakarta
4. Tagihan PAM Cianjur
5. Tagihan Internet
6. Listrik Puncak

Gunakan dropdown untuk kategori.

Jangan biarkan user mengetik kategori bebas pada MVP awal, supaya data tidak berantakan.

---

## 7. Daftar Channel Pembayaran

Channel pembayaran hanya boleh dari daftar ini:

1. Tokopedia
2. Shopee
3. Blibli
4. Website
5. Tunai

Gunakan dropdown.

---

## 8. Status Pembayaran

Status pembayaran wajib ada.

Pilihan:

1. Belum Dibayar
2. Sudah Dibayar

Tampilan:

* Bisa pakai checkbox.
* Bisa pakai badge.
* Bisa pakai dropdown.

Aturan:

* Jika status menjadi “Sudah Dibayar”, user boleh mengisi `tanggal_bayar`.
* Jika status “Belum Dibayar”, `tanggal_bayar` boleh kosong.

---

## 9. Format Tampilan Rupiah

Semua nominal di UI harus tampil sebagai format Rupiah.

Contoh:

* Rp1.000.000
* Rp250.000
* Rp12.500.000

Saat input:

* User boleh mengetik angka biasa.
* Sistem menampilkan format Rupiah di tabel dan laporan.
* Di database tetap angka murni.

---

## 10. Halaman Utama / Dashboard

Buat halaman dashboard utama dengan komponen berikut:

### A. Filter Bulan dan Tahun

Di bagian atas halaman harus ada:

* Dropdown Bulan
* Dropdown Tahun

Default:

* Bulan berjalan
* Tahun berjalan

User bisa memilih bulan/tahun lain untuk melihat data historis.

### B. Search Bar

Kolom pencarian harus bisa mencari berdasarkan:

* Deskripsi
* Nomor tagihan
* Kategori
* Channel pembayaran
* Status bayar

### C. Summary Cards

Tampilkan kartu ringkasan:

1. Total Tagihan Bulan Ini
2. Total Sudah Dibayar
3. Total Belum Dibayar
4. Jumlah Item Tagihan
5. Jumlah Item Belum Dibayar

### D. Total Per Kategori

Tampilkan total jumlah pembayaran per kategori.

Contoh:

| Kategori         |       Total |
| ---------------- | ----------: |
| Listrik          | Rp8.500.000 |
| Tagihan Internet | Rp1.200.000 |
| PAM Jakarta      |   Rp600.000 |

### E. Tabel Tagihan

Kolom tabel:

1. Nomor
2. Deskripsi / Nama Tagihan
3. Nomor Tagihan
4. Jumlah Tagihan
5. Channel Pembayaran
6. Status Bayar
7. Kategori
8. Tanggal Bayar
9. Catatan
10. Aksi: Edit / Hapus

---

## 11. Fitur CRUD

Admin harus bisa:

### Tambah Tagihan

Form input:

* Bulan
* Tahun
* Deskripsi
* Nomor Tagihan
* Jumlah Tagihan
* Channel Pembayaran
* Status Bayar
* Kategori
* Tanggal Bayar
* Catatan

### Edit Tagihan

Semua field bisa diedit.

### Hapus Tagihan

Sediakan konfirmasi sebelum hapus.

### Duplikasi Tagihan ke Bulan Berikutnya

Jika mudah dibuat, tambahkan fitur:

* Copy data bulan ini ke bulan berikutnya
* Status bayar hasil copy otomatis menjadi “Belum Dibayar”
* Tanggal bayar dikosongkan
* Jumlah tagihan boleh tetap sama dan bisa diedit kemudian

Fitur ini sangat berguna karena tagihan sekolah biasanya berulang tiap bulan.

---

## 12. Import Data

Aplikasi harus bisa import data dari:

* Excel `.xlsx`
* CSV `.csv`

### Format Template Import Baru

Buat template import resmi dengan kolom:

| bulan | tahun | deskripsi | nomor_tagihan | jumlah_tagihan | channel_pembayaran | status_bayar | kategori | tanggal_bayar | catatan |
| ----- | ----- | --------- | ------------- | -------------: | ------------------ | ------------ | -------- | ------------- | ------- |

Contoh isi:

| bulan | tahun | deskripsi        | nomor_tagihan | jumlah_tagihan | channel_pembayaran | status_bayar  | kategori         | tanggal_bayar | catatan       |
| ----- | ----: | ---------------- | ------------- | -------------: | ------------------ | ------------- | ---------------- | ------------- | ------------- |
| 1     |  2026 | PLN Gedung Utama | 1234567890    |        1500000 | Tokopedia          | Sudah Dibayar | Listrik          | 2026-01-10    | Dibayar admin |
| 1     |  2026 | Internet Sekolah | 9876543210    |         550000 | Website            | Belum Dibayar | Tagihan Internet |               |               |

### Validasi Import

Saat import:

* `bulan` wajib 1-12.
* `tahun` wajib angka.
* `deskripsi` wajib.
* `jumlah_tagihan` wajib angka.
* `kategori` wajib cocok dengan daftar kategori.
* `channel_pembayaran` wajib cocok dengan daftar channel.
* `status_bayar` wajib “Sudah Dibayar” atau “Belum Dibayar”.
* Jika data salah, tampilkan error yang jelas.
* Jangan langsung import data rusak.

### Import Preview

Sebelum menyimpan ke database, tampilkan preview data yang akan diimport.

Preview harus menampilkan:

* Jumlah baris valid
* Jumlah baris error
* Daftar error per baris
* Tombol “Lanjut Import” hanya aktif jika data valid

---

## 13. Konversi Data Lama 3 Tahun

Nanti user akan memberikan tabel lama yang sudah berjalan sekitar 3 tahun.

Tugas aplikasi/developer:

1. Buat sistem import yang fleksibel.
2. Data lama kemungkinan format kolomnya berbeda.
3. Jangan menghapus data lama.
4. Bantu mapping kolom lama ke format baru.
5. Jika nama kategori lama berbeda, buat normalisasi ke kategori baru.
6. Jika format Rupiah lama berupa teks seperti “Rp1.250.000”, ubah menjadi angka `1250000`.
7. Jika bulan/tahun ada di nama sheet atau judul tabel, ambil bulan/tahun dari sana.
8. Jika status bayar tidak ada, default menjadi “Sudah Dibayar” hanya jika jelas data tersebut adalah data pembayaran historis. Jika tidak jelas, default menjadi “Belum Dibayar” dan beri tanda review.
9. Buat catatan import batch supaya bisa dilacak data mana yang berasal dari file lama.

Rekomendasi tambahan:

* Buat tabel `import_batches` jika memungkinkan.
* Simpan nama file, tanggal import, jumlah baris sukses, jumlah baris gagal.

---

## 14. Export Data

Aplikasi harus bisa export:

### A. Export Excel / CSV

Export mengikuti filter aktif.

Jika user memilih:

* Bulan: Januari
* Tahun: 2026

Maka export hanya data Januari 2026.

Jika search/filter aktif, export mengikuti hasil filter yang sedang tampil.

### B. Export PDF Cetak

PDF harus siap print.

Header PDF:

**SISTEM TAGIHAN OPERASIONAL SEKOLAH YAKIN**
**Tagihan Listrik Sekolah YAKIN**
Periode: [Nama Bulan] [Tahun]

Isi PDF:

1. Ringkasan total
2. Total per kategori
3. Tabel tagihan detail
4. Tanggal cetak

Format tabel PDF:

| No | Deskripsi | Nomor Tagihan | Kategori | Channel | Status | Jumlah |
| -- | --------- | ------------- | -------- | ------- | ------ | -----: |

Footer:

* Total keseluruhan
* Total sudah dibayar
* Total belum dibayar

---

## 15. Desain UI

Gunakan desain sederhana, bersih, dan mudah dipakai admin sekolah.

Prioritas:

* Tidak ramai
* Mudah dibaca
* Tabel jelas
* Tombol import/export mudah ditemukan
* Filter bulan/tahun terlihat jelas
* Status bayar mudah dikenali

Warna:

* Biru tua / navy untuk header
* Putih untuk background
* Abu-abu muda untuk border/tabel
* Hijau untuk “Sudah Dibayar”
* Merah/oranye untuk “Belum Dibayar”

---

## 16. Aturan Penting untuk Developer

Jangan over-engineering.

Prioritas pengerjaan:

### Phase 1 — Core

1. Database tagihan
2. CRUD tagihan
3. Filter bulan/tahun
4. Search
5. Total per kategori
6. Total sudah/belum bayar

### Phase 2 — Import/Export

1. Import Excel/CSV
2. Preview import
3. Validasi import
4. Export Excel/CSV
5. Export PDF

### Phase 3 — Data Lama

1. Baca contoh tabel lama dari user
2. Buat mapping kolom lama ke struktur baru
3. Normalisasi kategori
4. Normalisasi Rupiah
5. Import data historis 3 tahun

### Phase 4 — Polish

1. Dashboard lebih rapi
2. Upload bukti pembayaran jika dibutuhkan
3. Fitur copy bulan sebelumnya
4. Print layout lebih bagus

---

## 17. Acceptance Criteria

Aplikasi dianggap selesai MVP jika:

1. Admin bisa tambah/edit/hapus tagihan.
2. Admin bisa memilih bulan dan tahun.
3. Admin bisa mencari data tagihan.
4. Nominal tampil format Rupiah.
5. Data tersimpan sebagai angka murni di database.
6. Kategori menggunakan dropdown.
7. Channel pembayaran menggunakan dropdown.
8. Status pembayaran jelas.
9. Total per kategori muncul.
10. Total keseluruhan muncul.
11. Total sudah dibayar muncul.
12. Total belum dibayar muncul.
13. Import Excel/CSV berjalan.
14. Import punya validasi error.
15. Export PDF bisa dicetak.
16. Export Excel/CSV berjalan.
17. Header PDF sesuai:

    * SISTEM TAGIHAN OPERASIONAL SEKOLAH YAKIN
    * Tagihan Listrik Sekolah YAKIN
18. Data bisa difilter berdasarkan bulan dan tahun.

---

## 18. Instruksi untuk Codex

Kerjakan project ini secara bertahap.

Jangan langsung membuat fitur terlalu banyak sekaligus.

Urutan kerja:

1. Baca seluruh file project.
2. Identifikasi stack yang digunakan.
3. Jika project kosong, buat struktur aplikasi sederhana.
4. Buat database dan model tagihan.
5. Buat halaman CRUD tagihan.
6. Buat filter bulan/tahun.
7. Buat search.
8. Buat summary total.
9. Buat total per kategori.
10. Buat import Excel/CSV.
11. Buat export Excel/CSV.
12. Buat export PDF.
13. Tes semua fitur utama.

Setelah selesai, berikan laporan:

* File apa saja yang dibuat/diubah
* Fitur apa saja yang sudah jalan
* Cara menjalankan aplikasi
* Cara import data
* Cara export PDF
* Sisa pekerjaan jika ada
* Risiko atau bug yang perlu dicek manual

Jangan mengubah fitur di luar scope tanpa alasan.
Jangan hapus file existing tanpa izin.
Jangan hardcode data bulan/tahun tertentu.
Pastikan aplikasi bisa dipakai untuk tahun berikutnya.
