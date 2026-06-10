import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.resolve('data');
const dbPath = path.join(dataDir, 'tagihan.sqlite');

export function openDb() {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS billings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bulan INTEGER NOT NULL CHECK (bulan BETWEEN 1 AND 12),
      tahun INTEGER NOT NULL CHECK (tahun BETWEEN 1900 AND 2100),
      kategori TEXT NOT NULL,
      deskripsi TEXT NOT NULL,
      nomor_tagihan TEXT NOT NULL,
      jumlah_tagihan INTEGER NOT NULL CHECK (jumlah_tagihan >= 0),
      channel_pembayaran TEXT NOT NULL,
      status_bayar TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_billings_bulan_tahun ON billings(bulan, tahun);
    CREATE INDEX IF NOT EXISTS idx_billings_search ON billings(kategori, deskripsi, nomor_tagihan, channel_pembayaran, status_bayar);
  `);
  return db;
}

export const db = openDb();

export const BILLING_STATUSES = ['Sudah Dibayar', 'Belum Dibayar'];
export const PAYMENT_CHANNELS = ['Tokopedia', 'Shopee', 'Blibli', 'Website', 'Tunai'];

export function formatCurrency(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function monthName(month) {
  return new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(new Date(2024, month - 1, 1));
}
