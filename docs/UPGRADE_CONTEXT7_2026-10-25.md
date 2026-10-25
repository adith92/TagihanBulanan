# Context7 upgrade report · 25 Oktober 2026

## Referensi diverifikasi
- Context7 /websites/expressjs: [Express 5 migration guide](https://expressjs.com/en/guide/migrating-5/). Perubahan penting: catch-all route `/{*splat}` menggantikan route `*`.
- Context7 /brianc/node-postgres: [Pool and transaction documentation](https://node-postgres.com/features/transactions). Pastikan transaksi menggunakan checked-out client yang sama, dengan timeout dan ukuran pool dibatasi.
- Context7 /nodejs/nodejs.org dan jadwal resmi: Node 24 adalah LTS pada 25 Oktober 2026; Node 26 masih Current sampai 28 Oktober.
- npm registry verified latest on 25 Oktober 2026: `express@5.3.0`, `pg@8.23.1`.

## Perubahan
- Upgrade dependency ke `^5.3.0` Express dan `^8.23.1` pg, pin Node runtime `24.x`.
- SPA catch-all kompatibel Express 5; endpoint API yang tak dikenali kembali 404 JSON, bukan HTML.
- Pool dibatasi (4 koneksi) dengan timeout dan maxLifetimeSeconds.
- Cache PWA dirotasi ke v5.0.0; API finansial tetap network-only dan tidak disimpan cache.
- Cabut konfigurasi dan berkas lama Vercel/Apps Script dari branch utama.
- Pembaruan tidak menulis ulang PostgreSQL, tidak menghapus seed terenkripsi.

## QA
- Local: `npm test` 9 kasus lulus; `npm run lint` lulus (Node 22 local hanya untuk pemeriksaan sintaks).
- Deployment / startup / database health perlu diverifikasi setelah Render memperoleh paket terbaru.
- Tidak mengklaim pengujian browser fisik Android dan iOS.
