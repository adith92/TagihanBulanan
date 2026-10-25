# Runbook Render · TagihanBulanan v5.0.0

Aplikasi dan PostgreSQL **sudah dibuat**, jadi jangan membuat service atau database baru.

- Web: https://dashboard.render.com/web/srv-dbeqv45g1s2s73dgohtg
- Database: https://dashboard.render.com/d/dpg-dbequp9srm7s73d2g0eg-a
- Production URL: https://tagihanbulanan.onrender.com
- Workspace GoldenBirdProject; Singapore; production branch `render/postgres-v4`.
- Runtime Node 24 LTS; Build `npm install`; Start `npm start`.
- Secret di Render (jangan commit): `DATABASE_URL` (internal PostgreSQL URL), `INITIAL_SEED_KEY` (arsip recovery).
- Health: https://tagihanbulanan.onrender.com/api/health, periksa `storageReady:true`.

## Keamanan dan migrasi

Data Numbers historis **sudah** ada di `tracker_state` dan tidak diimpor ulang bila tabel terisi. File `seed/initial.enc` hanya untuk pemulihan dan `lib/october-migration.js` melindungi data Oktober yang telah diedit. Jangan jalankan reset database.

Database Free kedaluwarsa 24 November 2026 dan tidak memiliki backup bawaan. Upgrade dan siapkan backup aman sebelum akhir masa berlaku.

Akses situs tanpa login berarti seluruh data dapat dibaca atau ditulis siapa pun dengan URL. Batasi melalui gateway privat sebelum membagikannya.

## Checklist rilis

1. Jalankan `npm test` dan `npm run lint`.
2. Periksa Render deploy status `live`, startup tanpa kesalahan.
3. Periksa `/api/health` memberikan respons siap database.
4. Periksa tampilan PWA, Android, iPhone, tablet serta penulisan setelah login akses privat.
5. Jangan uji edit data produksi sembarangan.
