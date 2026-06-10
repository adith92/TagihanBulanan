import express from 'express';
import multer from 'multer';
import { db, BILLING_STATUSES, PAYMENT_CHANNELS } from './db.js';
import { escapeHtml, renderExportPreview, renderForm, renderIndex, renderPage } from './views.js';
import { buildPdfBuffer, exportRowsToCsv, exportRowsToXlsxBuffer, parseImportBuffer, safeImportRows } from './importExport.js';

const upload = multer({ storage: multer.memoryStorage() });
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

function parseFilters(query) {
  return {
    bulan: query.bulan ? Number(query.bulan) : null,
    tahun: query.tahun ? Number(query.tahun) : null,
    q: (query.q || '').trim(),
  };
}

function getRows(filters) {
  const where = [];
  const params = {};

  if (filters.bulan) {
    where.push('bulan = @bulan');
    params.bulan = filters.bulan;
  }

  if (filters.tahun) {
    where.push('tahun = @tahun');
    params.tahun = filters.tahun;
  }

  if (filters.q) {
    where.push(`(
      LOWER(kategori) LIKE LOWER(@qLike) OR
      LOWER(deskripsi) LIKE LOWER(@qLike) OR
      LOWER(nomor_tagihan) LIKE LOWER(@qLike) OR
      LOWER(channel_pembayaran) LIKE LOWER(@qLike) OR
      LOWER(status_bayar) LIKE LOWER(@qLike)
    )`);
    params.qLike = `%${filters.q}%`;
  }

  const sql = `SELECT *
    FROM billings
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY tahun DESC, bulan DESC, id DESC`;

  return db.prepare(sql).all(params);
}

function getSummary(filters) {
  const where = [];
  const params = {};

  if (filters.bulan) {
    where.push('bulan = @bulan');
    params.bulan = filters.bulan;
  }

  if (filters.tahun) {
    where.push('tahun = @tahun');
    params.tahun = filters.tahun;
  }

  if (filters.q) {
    where.push(`(
      LOWER(kategori) LIKE LOWER(@qLike) OR
      LOWER(deskripsi) LIKE LOWER(@qLike) OR
      LOWER(nomor_tagihan) LIKE LOWER(@qLike) OR
      LOWER(channel_pembayaran) LIKE LOWER(@qLike) OR
      LOWER(status_bayar) LIKE LOWER(@qLike)
    )`);
    params.qLike = `%${filters.q}%`;
  }

  const sql = `SELECT
      COALESCE(SUM(jumlah_tagihan), 0) AS total_amount,
      SUM(CASE WHEN status_bayar = 'Sudah Dibayar' THEN 1 ELSE 0 END) AS done,
      SUM(CASE WHEN status_bayar = 'Belum Dibayar' THEN 1 ELSE 0 END) AS pending
    FROM billings
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`;

  return db.prepare(sql).get(params);
}

function getCategoryTotals(filters) {
  const where = [];
  const params = {};

  if (filters.bulan) {
    where.push('bulan = @bulan');
    params.bulan = filters.bulan;
  }

  if (filters.tahun) {
    where.push('tahun = @tahun');
    params.tahun = filters.tahun;
  }

  if (filters.q) {
    where.push(`(
      LOWER(kategori) LIKE LOWER(@qLike) OR
      LOWER(deskripsi) LIKE LOWER(@qLike) OR
      LOWER(nomor_tagihan) LIKE LOWER(@qLike) OR
      LOWER(channel_pembayaran) LIKE LOWER(@qLike) OR
      LOWER(status_bayar) LIKE LOWER(@qLike)
    )`);
    params.qLike = `%${filters.q}%`;
  }

  const sql = `SELECT kategori, COALESCE(SUM(jumlah_tagihan), 0) AS total
    FROM billings
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    GROUP BY kategori
    ORDER BY total DESC, kategori ASC`;

  return db.prepare(sql).all(params);
}

function validateBilling(input) {
  const data = {
    bulan: Number(input.bulan),
    tahun: Number(input.tahun),
    kategori: String(input.kategori || '').trim(),
    deskripsi: String(input.deskripsi || '').trim(),
    nomor_tagihan: String(input.nomor_tagihan || '').trim(),
    jumlah_tagihan: Number(input.jumlah_tagihan),
    channel_pembayaran: String(input.channel_pembayaran || '').trim(),
    status_bayar: String(input.status_bayar || '').trim(),
  };

  const errors = [];

  if (!Number.isInteger(data.bulan) || data.bulan < 1 || data.bulan > 12) errors.push('Bulan wajib angka 1-12.');
  if (!Number.isInteger(data.tahun) || data.tahun < 1900 || data.tahun > 2100) errors.push('Tahun tidak valid.');
  if (!data.kategori) errors.push('Kategori wajib diisi.');
  if (!data.deskripsi) errors.push('Deskripsi wajib diisi.');
  if (!data.nomor_tagihan) errors.push('Nomor tagihan wajib diisi.');
  if (!Number.isInteger(data.jumlah_tagihan) || data.jumlah_tagihan < 0) errors.push('Jumlah tagihan wajib angka bulat >= 0.');
  if (!PAYMENT_CHANNELS.includes(data.channel_pembayaran)) errors.push('Channel pembayaran tidak valid.');
  if (!BILLING_STATUSES.includes(data.status_bayar)) errors.push('Status bayar tidak valid.');

  return { data, errors };
}

function sendNotice(res, path, message, type = 'success') {
  const url = new URL(`http://localhost${path}`);
  url.searchParams.set('notice', message);
  url.searchParams.set('noticeType', type);
  res.redirect(url.pathname + url.search);
}

function backPathFromRequest(req, fallback = '/') {
  const referer = req.get('referer');
  if (!referer) return fallback;

  try {
    const url = new URL(referer);
    return `${url.pathname}${url.search}` || fallback;
  } catch {
    return fallback;
  }
}

function noticeFromQuery(query) {
  return query.notice ? { message: String(query.notice), type: query.noticeType === 'error' ? 'error' : 'success' } : null;
}

function renderDashboard(req, notice = null) {
  const filters = parseFilters(req.query);
  const rows = getRows(filters);
  const summary = getSummary(filters);
  const categories = getCategoryTotals(filters);

  return renderIndex({
    rows,
    summary,
    categories,
    counts: {
      done: Number(summary.done || 0),
      pending: Number(summary.pending || 0),
    },
    query: req.query,
    notice,
  });
}

function renderPageForImport({ notice } = {}) {
  return renderPage({
    title: 'Import Tagihan',
    notice,
    body: `
      <section class="hero">
        <div class="hero-copy">
          <span class="eyebrow">Import data</span>
          <h1>Import Excel / CSV</h1>
          <p>File dipreview dulu. Baris dengan kolom ambigu atau data tidak valid akan masuk daftar review dan tidak diimpor otomatis.</p>
        </div>
        <aside class="hero-side">
          <div class="summary-strip">
            <div class="summary-tile"><span>Format</span><strong>CSV / XLSX / XLS</strong></div>
            <div class="summary-tile"><span>Safety</span><strong>Review dulu</strong></div>
            <div class="summary-tile"><span>Status</span><strong>Aman diimpor</strong></div>
          </div>
        </aside>
      </section>

      <section class="panel">
        <form method="post" action="/import/preview" enctype="multipart/form-data" class="toolbar">
          <div class="field">
            <label for="file">Pilih file</label>
            <input id="file" name="file" type="file" accept=".csv,.xlsx,.xls" required />
          </div>
          <div class="form-actions">
            <button class="btn btn-primary" type="submit" data-loading-label="Membaca file...">Preview Import</button>
            <a class="btn btn-muted" href="/">Kembali</a>
          </div>
        </form>
      </section>
    `,
  });
}

function renderImportPreviewPage({ filename, importable, review, rowsJson, notice } = {}) {
  const importableCount = importable.length;
  const reviewCount = review.length;

  return renderPage({
    title: 'Preview Import',
    notice,
    body: `
      <section class="hero">
        <div class="hero-copy">
          <span class="eyebrow">Preview import</span>
          <h1>Preview file ${escapeHtml(filename)}</h1>
          <p>Baris aman bisa langsung diimpor. Baris review ditahan dulu supaya data ambigu tidak masuk tanpa dicek manual.</p>
          <div class="hero-actions no-print">
            <a class="btn btn-muted" href="/import">Ganti file</a>
            <a class="btn btn-outline" href="/">Kembali ke dashboard</a>
          </div>
        </div>
        <aside class="hero-side">
          <div class="stats">
            <div class="stat"><div class="label">Aman</div><div class="value">${importableCount}</div><div class="hint">Siap diimpor</div></div>
            <div class="stat"><div class="label">Review</div><div class="value">${reviewCount}</div><div class="hint">Perlu cek manual</div></div>
          </div>
        </aside>
      </section>

      <section class="panel">
        <div class="section-head">
          <span class="eyebrow">Data aman</span>
          <h2>Baris yang bisa langsung masuk</h2>
        </div>
        ${
          importableCount
            ? `
              <div class="table-wrap">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Bulan</th><th>Tahun</th><th>Kategori</th><th>Deskripsi</th><th>Nomor</th><th>Nominal</th><th>Channel</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${importable
                      .map(
                        (row) => `
                          <tr>
                            <td>${escapeHtml(row.bulan)}</td>
                            <td>${escapeHtml(row.tahun)}</td>
                            <td>${escapeHtml(row.kategori)}</td>
                            <td>${escapeHtml(row.deskripsi)}</td>
                            <td>${escapeHtml(row.nomor_tagihan)}</td>
                            <td>${escapeHtml(row.jumlah_tagihan)}</td>
                            <td>${escapeHtml(row.channel_pembayaran)}</td>
                            <td>${escapeHtml(row.status_bayar)}</td>
                          </tr>
                        `,
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>
            `
            : `<div class="empty-state">Tidak ada baris aman untuk diimpor.</div>`
        }
      </section>

      <section class="panel">
        <div class="section-head">
          <span class="eyebrow">Review manual</span>
          <h2>Baris yang perlu dicek dulu</h2>
          <p>Baris ini tidak akan diimpor otomatis sebelum ditandai aman.</p>
        </div>
        ${
          reviewCount
            ? `
              <div class="table-wrap">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Baris</th><th>Masalah</th><th>Preview data</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${review
                      .map(
                        (row) => `
                          <tr>
                            <td>${escapeHtml(row.sourceRow || row.rowNumber || '-')}</td>
                            <td>${escapeHtml([...(row.errors || []), ...(row.ambiguous || [])].join(', ') || 'Perlu review')}</td>
                            <td>
                              <div class="cell-stack">
                                <strong>${escapeHtml(row.mapped?.kategori || '-')}</strong>
                                <span class="muted">${escapeHtml(row.mapped?.deskripsi || '-')}</span>
                              </div>
                            </td>
                          </tr>
                        `,
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>
            `
            : `<div class="empty-state">Tidak ada baris review. Semua data aman.</div>`
        }
      </section>

      <section class="panel no-print">
        <form method="post" action="/import/commit" class="form-actions">
          <input type="hidden" name="rows_json" value="${escapeHtml(rowsJson)}" />
          <button class="btn btn-primary" type="submit" data-loading-label="Mengimpor..."${importableCount ? '' : ' disabled'}>Impor Baris Aman</button>
          <a class="btn btn-muted" href="/import">Impor File Lain</a>
        </form>
      </section>
    `,
  });
}

app.get('/', (req, res) => {
  res.send(renderDashboard(req, noticeFromQuery(req.query)));
});

app.get('/tagihan/new', (req, res) => {
  res.send(renderForm({ mode: 'create', item: {}, notice: noticeFromQuery(req.query) }));
});

app.post('/tagihan', (req, res) => {
  const { data, errors } = validateBilling(req.body);
  if (errors.length) {
    res.status(400).send(renderForm({ mode: 'create', item: data, notice: { type: 'error', message: errors.join(' · ') } }));
    return;
  }

  db.prepare(`
    INSERT INTO billings (
      bulan, tahun, kategori, deskripsi, nomor_tagihan, jumlah_tagihan, channel_pembayaran, status_bayar, created_at, updated_at
    ) VALUES (
      @bulan, @tahun, @kategori, @deskripsi, @nomor_tagihan, @jumlah_tagihan, @channel_pembayaran, @status_bayar, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `).run(data);

  sendNotice(res, '/', 'Tagihan berhasil ditambahkan.');
});

app.get('/tagihan/:id/edit', (req, res) => {
  const item = db.prepare('SELECT * FROM billings WHERE id = ?').get(req.params.id);
  if (!item) {
    res.status(404).send(renderDashboard(req, { type: 'error', message: 'Tagihan tidak ditemukan.' }));
    return;
  }

  res.send(renderForm({ mode: 'edit', item, notice: noticeFromQuery(req.query) }));
});

app.post('/tagihan/:id', (req, res) => {
  const { data, errors } = validateBilling(req.body);
  if (errors.length) {
    res.status(400).send(renderForm({ mode: 'edit', item: { ...data, id: req.params.id }, notice: { type: 'error', message: errors.join(' · ') } }));
    return;
  }

  const result = db.prepare(`
    UPDATE billings SET
      bulan = @bulan,
      tahun = @tahun,
      kategori = @kategori,
      deskripsi = @deskripsi,
      nomor_tagihan = @nomor_tagihan,
      jumlah_tagihan = @jumlah_tagihan,
      channel_pembayaran = @channel_pembayaran,
      status_bayar = @status_bayar,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `).run({ ...data, id: req.params.id });

  if (!result.changes) {
    res.status(404).send(renderDashboard(req, { type: 'error', message: 'Tagihan tidak ditemukan.' }));
    return;
  }

  sendNotice(res, req.body.back || '/', 'Tagihan berhasil diperbarui.');
});

app.post('/tagihan/:id/status', (req, res) => {
  const status_bayar = String(req.body.status_bayar || '').trim();
  if (!BILLING_STATUSES.includes(status_bayar)) {
    res.status(400).send(renderDashboard(req, { type: 'error', message: 'Status tidak valid.' }));
    return;
  }

  const result = db.prepare(`
    UPDATE billings
    SET status_bayar = @status_bayar,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `).run({ id: req.params.id, status_bayar });

  if (!result.changes) {
    res.status(404).send(renderDashboard(req, { type: 'error', message: 'Tagihan tidak ditemukan.' }));
    return;
  }

  sendNotice(res, req.body.back || backPathFromRequest(req), `Status diperbarui menjadi ${status_bayar}.`);
});

app.post('/tagihan/:id/delete', (req, res) => {
  const result = db.prepare('DELETE FROM billings WHERE id = ?').run(req.params.id);
  if (!result.changes) {
    res.status(404).send(renderDashboard(req, { type: 'error', message: 'Tagihan tidak ditemukan.' }));
    return;
  }

  sendNotice(res, req.body.back || backPathFromRequest(req), 'Tagihan berhasil dihapus.');
});

app.get('/export.csv', (req, res) => {
  const filters = parseFilters(req.query);
  const rows = getRows(filters);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="tagihan-yakin.csv"');
  res.send(exportRowsToCsv(rows));
});

app.get('/export.xlsx', (req, res) => {
  const filters = parseFilters(req.query);
  const rows = getRows(filters);
  const buffer = exportRowsToXlsxBuffer(rows);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="tagihan-yakin.xlsx"');
  res.send(buffer);
});

app.get('/export.pdf', async (req, res) => {
  const filters = parseFilters(req.query);
  const rows = getRows(filters);
  const summary = getSummary(filters);
  const categories = getCategoryTotals(filters);
  const buffer = await buildPdfBuffer({ rows, summary, categories, query: req.query });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="tagihan-yakin.pdf"');
  res.send(buffer);
});

app.get('/import', (req, res) => {
  res.send(renderPageForImport({ notice: noticeFromQuery(req.query) }));
});

app.post('/import/preview', upload.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).send(renderPageForImport({ notice: { type: 'error', message: 'File belum dipilih.' } }));
    return;
  }

  try {
    const parsed = parseImportBuffer(req.file.buffer, req.file.originalname);
    const { importable, review } = safeImportRows(parsed);
    const rowsJson = encodeURIComponent(JSON.stringify(importable));
    res.send(renderImportPreviewPage({
      filename: req.file.originalname,
      importable,
      review,
      rowsJson,
      notice: { type: 'success', message: `Preview selesai. Baris aman: ${importable.length}. Baris review: ${review.length}.` },
    }));
  } catch (error) {
    res.status(400).send(renderPageForImport({ notice: { type: 'error', message: error.message } }));
  }
});

app.post('/import/commit', express.urlencoded({ extended: true, limit: '5mb' }), (req, res) => {
  try {
    const rows = req.body.rows_json ? JSON.parse(decodeURIComponent(req.body.rows_json)) : [];
    if (!Array.isArray(rows) || !rows.length) {
      res.status(400).send(renderPageForImport({ notice: { type: 'error', message: 'Tidak ada baris aman untuk diimpor.' } }));
      return;
    }

    const stmt = db.prepare(`
      INSERT INTO billings (
        bulan, tahun, kategori, deskripsi, nomor_tagihan, jumlah_tagihan, channel_pembayaran, status_bayar, created_at, updated_at
      ) VALUES (
        @bulan, @tahun, @kategori, @deskripsi, @nomor_tagihan, @jumlah_tagihan, @channel_pembayaran, @status_bayar, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `);

    db.transaction((items) => items.forEach((item) => stmt.run(item)))(rows);
    sendNotice(res, '/', `Import selesai. Data aman diimpor: ${rows.length}.`);
  } catch (error) {
    res.status(400).send(renderPageForImport({ notice: { type: 'error', message: error.message } }));
  }
});

app.get('/preview/export', (req, res) => {
  const filters = parseFilters(req.query);
  const rows = getRows(filters);
  const summary = getSummary(filters);
  const categories = getCategoryTotals(filters);
  res.send(renderExportPreview({
    rows,
    summary,
    categories,
    query: req.query,
    title: 'Preview Export',
    header: 'SISTEM TAGIHAN OPERASIONAL SEKOLAH YAKIN',
    notice: noticeFromQuery(req.query),
  }));
});

app.get('/health', (req, res) => res.json({ ok: true }));

export default app;

if (!process.env.VERCEL) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Tagihan YAKIN running on http://localhost:${port}`));
}
