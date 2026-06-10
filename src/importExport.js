import { parse as parseCsv } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import { BILLING_STATUSES, PAYMENT_CHANNELS, monthName } from './db.js';

const legacyAliases = {
  bulan: ['bulan', 'bln', 'month'],
  tahun: ['tahun', 'year'],
  kategori: ['kategori', 'category', 'jenis', 'nama_kategori'],
  deskripsi: ['deskripsi', 'description', 'uraian', 'keterangan', 'nama_tagihan', 'tagihan'],
  nomor_tagihan: ['nomor_tagihan', 'no_tagihan', 'nomor', 'nomor_pelanggan', 'no_pelanggan', 'id_tagihan'],
  jumlah_tagihan: ['jumlah_tagihan', 'jumlah', 'nominal', 'total', 'amount', 'tagihan'],
  channel_pembayaran: ['channel_pembayaran', 'channel', 'metode_bayar', 'pembayaran'],
  status_bayar: ['status_bayar', 'status', 'paid_status'],
};

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-./]+/g, '_');
}

function cleanNumber(value) {
  if (typeof value === 'number') return value;
  const raw = String(value ?? '').trim();
  if (!raw) return NaN;
  const normalized = raw
    .replace(/rp\s?/gi, '')
    .replace(/\./g, '')
    .replace(/,/g, '')
    .replace(/[^\d-]/g, '');
  return Number(normalized);
}

function resolveField(row, canonical) {
  for (const alias of legacyAliases[canonical]) {
    if (alias in row) return row[alias];
  }
  return undefined;
}

function mapStatus(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return { value: '', ambiguous: true };
  if (['sudah dibayar', 'lunas', 'paid', '1', 'yes', 'ya'].includes(normalized)) {
    return { value: 'Sudah Dibayar', ambiguous: false };
  }
  if (['belum dibayar', 'pending', 'unpaid', '0', 'no', 'tidak'].includes(normalized)) {
    return { value: 'Belum Dibayar', ambiguous: false };
  }
  return { value: '', ambiguous: true };
}

function mapChannel(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return { value: '', ambiguous: true };
  const direct = PAYMENT_CHANNELS.find((item) => item.toLowerCase() === normalized.toLowerCase());
  if (direct) return { value: direct, ambiguous: false };
  return { value: '', ambiguous: true };
}

function mapRow(raw, index) {
  const normalized = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [normalizeHeader(key), value]),
  );

  const bulan = Number(resolveField(normalized, 'bulan') ?? normalized.bulan);
  const tahun = Number(resolveField(normalized, 'tahun') ?? normalized.tahun);
  const kategori = String(resolveField(normalized, 'kategori') ?? normalized.kategori ?? '').trim();
  const deskripsi = String(resolveField(normalized, 'deskripsi') ?? normalized.deskripsi ?? '').trim();
  const nomor_tagihan = String(resolveField(normalized, 'nomor_tagihan') ?? normalized.nomor_tagihan ?? '').trim();
  const jumlah_tagihan = cleanNumber(resolveField(normalized, 'jumlah_tagihan') ?? normalized.jumlah_tagihan);
  const channelInfo = mapChannel(resolveField(normalized, 'channel_pembayaran') ?? normalized.channel_pembayaran);
  const statusInfo = mapStatus(resolveField(normalized, 'status_bayar') ?? normalized.status_bayar);

  const mapped = {
    rowNumber: index + 2,
    bulan,
    tahun,
    kategori,
    deskripsi,
    nomor_tagihan,
    jumlah_tagihan,
    channel_pembayaran: channelInfo.value,
    status_bayar: statusInfo.value,
  };

  const errors = [];
  const ambiguous = [];
  if (!Number.isInteger(bulan) || bulan < 1 || bulan > 12) errors.push('bulan tidak valid');
  if (!Number.isInteger(tahun) || tahun < 1900 || tahun > 2100) errors.push('tahun tidak valid');
  if (!kategori) errors.push('kategori kosong');
  if (!deskripsi) errors.push('deskripsi kosong');
  if (!nomor_tagihan) errors.push('nomor tagihan kosong');
  if (!Number.isInteger(jumlah_tagihan) || jumlah_tagihan < 0) errors.push('jumlah tidak valid');
  if (!channelInfo.value) ambiguous.push('channel_pembayaran ambigu');
  if (!statusInfo.value) ambiguous.push('status_bayar ambigu');

  return {
    mapped,
    errors,
    ambiguous,
    reviewRequired: ambiguous.length > 0,
    importable: errors.length === 0 && ambiguous.length === 0,
  };
}

export function parseImportBuffer(buffer, filename = '') {
  const ext = filename.split('.').pop()?.toLowerCase();
  let rows = [];
  if (ext === 'csv') {
    rows = parseCsv(buffer, { columns: true, skip_empty_lines: true, trim: true });
  } else if (ext === 'xlsx' || ext === 'xls') {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  } else {
    throw new Error('Format file harus CSV atau Excel (.xlsx/.xls).');
  }
  return rows.map((row, index) => {
    const normalized = Object.fromEntries(
      Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]),
    );
    return mapRow(normalized, index);
  });
}

export function safeImportRows(parsedRows) {
  const importable = parsedRows.filter((row) => row.importable).map((row) => row.mapped);
  const review = parsedRows.filter((row) => row.reviewRequired || row.errors.length);
  return { importable, review };
}

export function exportRowsToCsv(rows) {
  const header = ['bulan', 'tahun', 'kategori', 'deskripsi', 'nomor_tagihan', 'jumlah_tagihan', 'channel_pembayaran', 'status_bayar'];
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push(header.map((key) => JSON.stringify(row[key] ?? '')).join(','));
  }
  return `${lines.join('\n')}\n`;
}

export function exportRowsToXlsxBuffer(rows) {
  const data = rows.map((row) => ({
    bulan: row.bulan,
    tahun: row.tahun,
    kategori: row.kategori,
    deskripsi: row.deskripsi,
    nomor_tagihan: row.nomor_tagihan,
    jumlah_tagihan: row.jumlah_tagihan,
    channel_pembayaran: row.channel_pembayaran,
    status_bayar: row.status_bayar,
  }));
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Tagihan');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

export function buildPdfBuffer({ rows, summary, categories, query }) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: 'A4', margin: 36, bufferPages: true });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.fontSize(18).text('SISTEM TAGIHAN OPERASIONAL SEKOLAH YAKIN', { align: 'center' });
    doc.moveDown(0.4);
    doc.fontSize(10).text(`Filter: ${query.bulan ? `Bulan ${monthName(Number(query.bulan))}` : 'Semua bulan'}${query.tahun ? `, ${query.tahun}` : ''}${query.q ? `, ${query.q}` : ''}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(11).text(`Total baris: ${rows.length}`);
    doc.text(`Total nominal: ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(summary.total_amount)}`);
    doc.moveDown();
    doc.fontSize(12).text('Total per kategori', { underline: true });
    categories.forEach((item) => {
      doc.fontSize(10).text(`${item.kategori}: ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.total)}`);
    });
    doc.moveDown();
    doc.fontSize(12).text('Data Tagihan', { underline: true });
    rows.forEach((row) => {
      doc.fontSize(9).text(`${row.bulan}/${row.tahun} | ${row.kategori} | ${row.deskripsi} | ${row.nomor_tagihan} | ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(row.jumlah_tagihan)} | ${row.channel_pembayaran} | ${row.status_bayar}`);
    });
    doc.end();
  });
}

export function exportRowsToPdfTitle() {
  return 'SISTEM TAGIHAN OPERASIONAL SEKOLAH YAKIN';
}
