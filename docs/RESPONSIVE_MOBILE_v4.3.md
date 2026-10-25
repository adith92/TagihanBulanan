# 📱 TagihanBulanan v4.3.0: Responsive Mobile Web + PWA

**Web:** https://tagihanbulanan.onrender.com

- Android Chrome dan Samsung Internet; iPhone Safari; iPad Safari; tablet Android; desktop.
- Bottom navigation untuk ponsel, sidebar drawer untuk tablet, desktop menu normal.
- Input minimal 16px di smartphone (menghindari auto zoom iOS), target sentuh nyaman, safe-area untuk notch dan home indicator.
- Daftar tagihan jadi kartu editable di layar sempit (nama, Rupiah, platform, status bayar, status cetak, tautan Blibli/Tokopedia).
- Tabel master jadi kartu berlabel di smartphone; catatan riwayat tetap bisa dibuka.
- Kolom yang bisa di-drag dan di-resize tetap ada di desktop. Tablet orientasi lanskap dapat memanfaatkan tabel dan scroll internal.
- Manifest PWA + ikon 180/192/512. Tambah ke Home Screen di Android / iOS.
- Service worker network-first hanya untuk aset aplikasi. **Tidak pernah menyimpan API / transaksi/riwayat di cache.** Tanpa jaringan, perubahan tidak dapat disinkronkan ke PostgreSQL.
- Data asli 2.440 tagihan, 83 periode, dan server PostgreSQL **tidak diubah** oleh pembaruan frontend ini.

## Pengujian

Jalankan static preview dengan mock state dan Playwright di beberapa viewport: 320, 375, 390, 428, 768, 820, 1024, 1280 px. Uji kemampuan navigasi, input 16px, no horizontal overflow, modal drawer, dan status penyimpanan.

## Keamanan

Aplikasi yang dapat dibuka tanpa login masih publik. Service worker tidak menambah kontrol akses. Pertimbangkan gateway autentikasi terpisah.
