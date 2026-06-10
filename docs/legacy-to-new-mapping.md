# Mapping Data Lama ke Format Baru

Saya tidak menemukan file data lama di workspace ini. Karena itu, mapping berikut disiapkan sebagai aturan aman untuk file yang akan diunggah nanti.

## Kolom target

- `bulan` -> integer `1..12`
- `tahun` -> integer tahun
- `kategori` -> nama kelompok tagihan
- `deskripsi` -> uraian tagihan
- `nomor_tagihan` -> nomor pelanggan / nomor tagihan
- `jumlah_tagihan` -> nominal numerik murni
- `channel_pembayaran` -> `Tokopedia`, `Shopee`, `Blibli`, `Website`, atau `Tunai`
- `status_bayar` -> `Sudah Dibayar` atau `Belum Dibayar`

## Alias kolom lama yang dikenali

- `bulan`, `bln`, `month`
- `tahun`, `year`
- `kategori`, `category`, `jenis`, `nama_kategori`
- `deskripsi`, `description`, `uraian`, `keterangan`, `nama_tagihan`, `tagihan`
- `nomor_tagihan`, `no_tagihan`, `nomor`, `nomor_pelanggan`, `no_pelanggan`, `id_tagihan`
- `jumlah_tagihan`, `jumlah`, `nominal`, `total`, `amount`, `tagihan`
- `channel_pembayaran`, `channel`, `metode_bayar`, `pembayaran`
- `status_bayar`, `status`, `paid_status`

## Aturan aman

- Baris dengan `bulan`, `tahun`, `kategori`, `deskripsi`, `nomor_tagihan`, atau `jumlah_tagihan` yang tidak valid tidak diimpor.
- Baris dengan `channel_pembayaran` atau `status_bayar` yang tidak bisa dipetakan otomatis ditandai `review`.
- Baris ambigu tidak masuk ke database sampai diperiksa manual.
- Nilai nominal dipaksa menjadi angka bulat tanpa awalan `Rp`.

## Catatan

Karena tidak ada file lama di repo ini, tidak ada konversi aktual yang bisa dibuat saat ini. Pipeline import tetap siap menerima file lama jika nanti diunggah.
