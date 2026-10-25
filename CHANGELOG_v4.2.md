# TagihanBulanan v4.2.0 📒💰

## Tampilan
- ↔️ Seret header tabel untuk menukar posisi kolom di desktop.
- 📐 Seret garis/handle kanan header untuk memperbesar atau mengecilkan lebar kolom.
- 💾 Urutan dan ukuran kolom disimpan di perangkat lewat localStorage.
- 💰 Nominal tampil `Rp 1.000.000` dalam format Rupiah, saat diedit menggunakan input teks dengan keyboard numerik.
- 🛒 Link pembayaran langsung untuk Blibli dan Tokopedia di samping kolom Toko, tanpa mengubah nama Toko asli.

## Sinkronisasi PostgreSQL
- ☁️ Auto-save setelah ±1,4 detik tanpa perubahan, tetap tersedia Save manual.
- 🔁 Periksa revisi database tiap 30 detik saat tab terlihat dan tidak sedang mengedit.
- 🛡️ Gunakan pemeriksaan revisi pada server. Jika ada konflik, jangan timpa revisi lain.
- 🚦 Cegah perpindahan bulan/menu saat perubahan belum tersimpan akibat gangguan koneksi.
- 🗄️ Data transaksi tetap tersimpan di PostgreSQL Render, bukan Google Apps Script.

## Koreksi Oktober 2026
- Original Numbers memiliki September/Oktober 2026 masing-masing 31 tagihan, dengan jumlah nominal yang sama: Rp15.928.209.
- 🔒 Migrasi sekali saja, jika seluruh baris Oktober masih identik dengan September, akan mempertahankan nominal/platform dan menghapus centang `Sudah` serta `Cetak` yang terbawa salinan, bukan mengubah September.
- 📚 PostgreSQL menyimpan snapshot JSON lama sebelum koreksi pada `tracker_migration_audit.previous_state`.
- ⚠️ Jika Oktober sudah diedit dan tidak lagi cocok, migrasi otomatis dilewati tanpa mengubah data.
- 🔍 Endpoint `/api/health` menyampaikan `october2026Migration`: `applied` atau `skipped`.

## Keamanan
- Aplikasi Render saat ini terbuka tanpa login sesuai permintaan pemilik sebelumnya. Siapa pun yang mengetahui URL dapat membaca/mengubah tagihan. Disarankan pengamanan akses di depan layanan.
- Render PostgreSQL Free kedaluwarsa 24 November 2026 dan tidak termasuk backup otomatis. Simpan backup manual secara teratur, upgrade sebelum kedaluwarsa.
