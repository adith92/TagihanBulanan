import test from 'node:test';
import assert from 'node:assert/strict';
import { exportRowsToCsv, safeImportRows, parseImportBuffer } from '../src/importExport.js';

test('safeImportRows keeps ambiguous rows out of importable set', () => {
  const parsedRows = [
    { importable: true, reviewRequired: false, errors: [], mapped: { bulan: 1 } },
    { importable: false, reviewRequired: true, errors: ['status'], mapped: { bulan: 2 } },
  ];
  const { importable, review } = safeImportRows(parsedRows);
  assert.equal(importable.length, 1);
  assert.equal(review.length, 1);
});

test('exportRowsToCsv emits canonical columns', () => {
  const csv = exportRowsToCsv([
    {
      bulan: 1,
      tahun: 2026,
      kategori: 'PLN',
      deskripsi: 'Listrik Gedung Utama',
      nomor_tagihan: '123',
      jumlah_tagihan: 500000,
      channel_pembayaran: 'Tokopedia',
      status_bayar: 'Sudah Dibayar',
    },
  ]);
  assert.match(csv, /bulan,tahun,kategori,deskripsi,nomor_tagihan,jumlah_tagihan,channel_pembayaran,status_bayar/);
  assert.match(csv, /Tokopedia/);
});

test('parseImportBuffer supports csv aliases', () => {
  const buffer = Buffer.from('bln,tahun,nama_kategori,uraian,no_tagihan,nominal,channel,status\n1,2026,PLN,Listrik,123,500000,Tokopedia,Sudah Dibayar\n');
  const parsed = parseImportBuffer(buffer, 'sample.csv');
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].mapped.bulan, 1);
  assert.equal(parsed[0].mapped.kategori, 'PLN');
  assert.equal(parsed[0].importable, true);
});
