# QA lintas perangkat · v5.1.0

Perubahan 25 Oktober 2026 untuk iPhone, iPad, Android, tablet, macOS, dan Windows.

## Peningkatan yang dilakukan
- Pencarian ditampilkan sebagai fragment, tanpa mengganti input yang aktif (mencegah keyboard iOS kehilangan fokus).
- Recovery setelah offline, kembali dari background, dan pindah tab. Draf belum tersimpan tidak boleh dioverwrite.
- Font sistem lokal (San Francisco/Segoe UI/Roboto) menghindari permintaan font pihak ketiga.
- Viewport adaptif dan area safe inset; ukuran input mobile 16px; reduced motion.
- Billing period default menggunakan zona waktu Jakarta.
- Service worker cache diputar, data /api/state dan /api/health **tidak pernah di-cache**.

## Pengujian dan batasan
`npm install && npm test && npm run lint` memeriksa logic/model dan kontrak source. Workflow Quality di GitHub menguji source pada runner Linux, macOS, dan Windows (Node 24).

Uji fisik iOS Safari, Chrome Android dan macOS/Windows browser serta audit Lighthouse tidak otomatis dicakup oleh unit tests. Pengujian end-to-end dengan perangkat asli tetap direkomendasikan, khususnya Save→reload, keyboard dan PWA home-screen.

Pengembangan **hanya GitHub**. Tidak ada upload otomatis ke Google Drive.
