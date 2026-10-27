# TagihanBulanan | GitHub Recovery After Render Deletion

## Important: Scope of the available backup

On 27 October 2026, the previous Render TagihanBulanan web service and its PostgreSQL database were no longer present in the connected Render workspace. A full live `pg_dump` was therefore impossible to export.

`seed/initial.enc` now contains a **newly re-encrypted original normalized Numbers import**, based on the 25 October 2026 source file, not an export of the deleted live database. It contains:

- 83 months, November 2019 to October 2026
- 2440 monthly bill rows, 71 recurring bill masters, 6 categories
- All source amounts, names, codes, status flags, and provenance rows recorded in the original normalized JSON

**Edits, payment-status changes, and audits that existed only in the deleted Render PostgreSQL instance after that source date are not backed up and may be unrecoverable.** Do not claim that GitHub contains the final live state.

## Secrets and visibility

The GitHub repo is PUBLIC. The `.enc` is encrypted using AES-256-GCM, and is unusable without the owner's new `INITIAL_SEED_KEY`. The key must never be committed to GitHub or written in documentation. A private recovery-key file was supplied to the owner separately; store it securely before disposing of anything else.

## How to restore when the owner requests a new deploy

1. Create a NEW Render PostgreSQL 18 database and Node web service from `adith92/TagihanBulanan` branch `main` or `render/postgres-v4`.
2. Build command: `npm install`. Start command: `npm start`. Node.js 24.
3. Configure `DATABASE_URL` with the **new** Render Internal Database URL.
4. Configure `INITIAL_SEED_KEY` with the secret in the owner's private recovery-key file.
5. On first startup only, the app decrypts `seed/initial.enc`, creates the `tracker_state` and related views, and loads the 83 historic months. Current October migration logic then runs from the original baseline; rows shown in the UI may be fewer than the initial 2440 raw items.
6. Validate `/api/health`, October screenshot expectations, and a careful Save / Refresh test before treating the new system as authoritative.
7. Consider converting the repo to private and protecting the web app with authentication. The old application used no real login, so confidential bills were publicly accessible to anyone who knew the URL.

## Preparing future automatic GitHub backups

Source code in `main` cannot sync PostgreSQL automatically without the database/API being online. The new optional GitHub Actions workflow `.github/workflows/encrypted-db-backup.yml` encrypts API state and writes an **encrypted latest snapshot** to the separate `data-backups` branch without deploying it.

After redeploy, configure **GitHub Actions secret** `TAGIHAN_BACKUP_KEY` using the privately held backup key and variables `TAGIHAN_API_URL=https://<new-domain>` and `TAGIHAN_AUTO_BACKUP=true`. Run workflow manually once and inspect branch `data-backups` and manifest before trusting daily backups.

Do not enable the workflow before the new deployment; the previous Render service was deleted. Keep independent backups because GitHub is not an online database and backup-job success must be monitored. To avoid losing latest edits, do not delete future Postgres instances until a fresh encrypted backup is verified to decrypt and matches counts/revisions.