import { BILLING_STATUSES, PAYMENT_CHANNELS, formatCurrency, monthName } from './db.js';

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function optionList(options, selected) {
  return options
    .map((item) => `<option value="${escapeHtml(item)}"${item === selected ? ' selected' : ''}>${escapeHtml(item)}</option>`)
    .join('');
}

function yearOptions(currentYear, selectedYear) {
  const years = new Set([currentYear, currentYear - 1, currentYear + 1, Number(selectedYear)].filter((year) => Number.isInteger(year)));
  return Array.from(years)
    .sort((a, b) => a - b)
    .map((year) => `<option value="${year}"${Number(year) === Number(selectedYear) ? ' selected' : ''}>${year}</option>`)
    .join('');
}

function queryParams(query, overrides = {}) {
  const params = new URLSearchParams();
  const bulan = Object.prototype.hasOwnProperty.call(overrides, 'bulan') ? overrides.bulan : query.bulan;
  const tahun = Object.prototype.hasOwnProperty.call(overrides, 'tahun') ? overrides.tahun : query.tahun;
  const q = Object.prototype.hasOwnProperty.call(overrides, 'q') ? overrides.q : query.q;

  if (bulan !== undefined && bulan !== null && bulan !== '') params.set('bulan', bulan);
  if (tahun !== undefined && tahun !== null && tahun !== '') params.set('tahun', tahun);
  if (q !== undefined && q !== null && q !== '') params.set('q', q);

  const value = params.toString();
  return value ? `?${value}` : '';
}

function activeFilterSummary(query) {
  const items = [];
  if (query.bulan) items.push(`Bulan ${monthName(Number(query.bulan))}`);
  if (query.tahun) items.push(`${query.tahun}`);
  if (query.q) items.push(`Cari "${query.q}"`);
  return items.length ? items.join(' · ') : 'Semua data aktif';
}

function groupRowsByCategory(rows, categories) {
  const byCategory = new Map();
  rows.forEach((row) => {
    const key = row.kategori || 'Tanpa kategori';
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key).push(row);
  });

  const orderedNames = categories.length ? categories.map((item) => item.kategori) : Array.from(byCategory.keys());
  const groups = orderedNames
    .filter((name) => byCategory.has(name))
    .map((name) => ({
      name,
      rows: byCategory.get(name),
      total: categories.find((item) => item.kategori === name)?.total ?? byCategory.get(name).reduce((sum, row) => sum + Number(row.jumlah_tagihan || 0), 0),
    }));

  const leftovers = Array.from(byCategory.keys())
    .filter((name) => !orderedNames.includes(name))
    .map((name) => ({
      name,
      rows: byCategory.get(name),
      total: byCategory.get(name).reduce((sum, row) => sum + Number(row.jumlah_tagihan || 0), 0),
    }));

  return [...groups, ...leftovers];
}

function renderEmptyState({ title, description, actions = '', compact = false }) {
  return `
    <div class="empty-state${compact ? ' compact' : ''}">
      <span class="empty-badge">Tidak ada data</span>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(description)}</p>
      ${actions ? `<div class="empty-actions">${actions}</div>` : ''}
    </div>
  `;
}

function statusPill(status) {
  return `<span class="pill ${status === 'Sudah Dibayar' ? 'done' : 'pending'}">${escapeHtml(status || '-')}</span>`;
}

function quickStatusAction(row, query) {
  const nextStatus = row.status_bayar === 'Sudah Dibayar' ? 'Belum Dibayar' : 'Sudah Dibayar';
  const label = row.status_bayar === 'Sudah Dibayar' ? 'Buka lagi' : 'Tandai lunas';
  const tone = row.status_bayar === 'Sudah Dibayar' ? 'btn-muted' : 'btn-success';

  return `
    <form method="post" action="/tagihan/${row.id}/status">
      <input type="hidden" name="status_bayar" value="${escapeHtml(nextStatus)}" />
      <input type="hidden" name="back" value="${escapeHtml(queryParams(query))}" />
      <button class="btn ${tone} btn-sm" type="submit" data-loading-label="Menyimpan...">${escapeHtml(label)}</button>
    </form>
  `;
}

function rowActions(row, query) {
  return `
    <div class="actions">
      <a class="btn btn-muted btn-sm" href="/tagihan/${row.id}/edit">Edit</a>
      ${quickStatusAction(row, query)}
      <form method="post" action="/tagihan/${row.id}/delete" onsubmit="return confirm('Hapus data ini?');">
        <input type="hidden" name="back" value="${escapeHtml(queryParams(query))}" />
        <button class="btn btn-danger btn-sm" type="submit" data-loading-label="Menghapus...">Hapus</button>
      </form>
    </div>
  `;
}

function renderRowTable(rows, query) {
  if (!rows.length) {
    return renderEmptyState({
      title: 'Belum ada baris pada kategori ini',
      description: 'Coba ubah filter bulan, tahun, atau kata pencarian untuk melihat data lain.',
      compact: true,
    });
  }

  const tableRows = rows
    .map(
      (row) => `
        <tr>
          <td>
            <div class="cell-stack">
              <strong>${escapeHtml(monthName(Number(row.bulan)))} ${escapeHtml(row.tahun)}</strong>
              <span class="muted">${String(row.bulan).padStart(2, '0')}/${escapeHtml(row.tahun)}</span>
            </div>
          </td>
          <td>${escapeHtml(row.nomor_tagihan || '-')}</td>
          <td>
            <div class="cell-stack">
              <strong>${escapeHtml(row.deskripsi || '-')}</strong>
              <span class="muted">${escapeHtml(row.kategori || '-')}</span>
            </div>
          </td>
          <td><strong>${formatCurrency(Number(row.jumlah_tagihan || 0))}</strong></td>
          <td>${escapeHtml(row.channel_pembayaran || '-')}</td>
          <td>${statusPill(row.status_bayar)}</td>
          <td class="no-print">${rowActions(row, query)}</td>
        </tr>
      `,
    )
    .join('');

  const mobileCards = rows
    .map(
      (row) => `
        <article class="mobile-card">
          <div class="mobile-card-head">
            <div>
              <span class="eyebrow subtle">${escapeHtml(row.kategori || 'Tanpa kategori')}</span>
              <h4>${escapeHtml(row.deskripsi || '-')}</h4>
            </div>
            ${statusPill(row.status_bayar)}
          </div>

          <div class="mobile-metrics">
            <div class="mobile-metric">
              <span>Periode</span>
              <strong>${escapeHtml(monthName(Number(row.bulan)))} ${escapeHtml(row.tahun)}</strong>
            </div>
            <div class="mobile-metric">
              <span>Nominal</span>
              <strong>${formatCurrency(Number(row.jumlah_tagihan || 0))}</strong>
            </div>
          </div>

          <dl class="mobile-details">
            <div><dt>Nomor</dt><dd>${escapeHtml(row.nomor_tagihan || '-')}</dd></div>
            <div><dt>Channel</dt><dd>${escapeHtml(row.channel_pembayaran || '-')}</dd></div>
          </dl>

          <div class="mobile-actions no-print">
            ${rowActions(row, query)}
          </div>
        </article>
      `,
    )
    .join('');

  return `
    <div class="table-wrap desktop-table">
      <table class="data-table">
        <thead>
          <tr>
            <th>Periode</th>
            <th>Nomor Tagihan</th>
            <th>Deskripsi</th>
            <th>Nominal</th>
            <th>Channel</th>
            <th>Status</th>
            <th class="no-print">Aksi</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
    <div class="mobile-card-list">${mobileCards}</div>
  `;
}

function renderCategorySection(group, query) {
  return `
    <details class="category-section panel" open>
      <summary class="category-summary">
        <div>
          <span class="eyebrow subtle">${escapeHtml(group.name)}</span>
          <h3>${escapeHtml(group.name)}</h3>
          <p>${group.rows.length} baris pada filter aktif.</p>
        </div>
        <div class="summary-stack">
          <strong>${formatCurrency(Number(group.total || 0))}</strong>
          <span>${group.rows.length} item</span>
        </div>
      </summary>
      ${renderRowTable(group.rows, query)}
    </details>
  `;
}

export function renderPage({ title, body, notice }) {
  const noticeMarkup = notice
    ? `<div class="notice ${notice.type || 'success'}" role="status">${escapeHtml(notice.message || notice)}</div>`
    : '';

  return `<!doctype html>
  <html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#06111f" />
    <title>${escapeHtml(title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <style>
      :root {
        --bg: #020617;
        --bg-soft: rgba(15, 23, 42, 0.86);
        --panel: rgba(15, 23, 42, 0.82);
        --panel-strong: rgba(15, 23, 42, 0.96);
        --line: rgba(148, 163, 184, 0.18);
        --line-strong: rgba(148, 163, 184, 0.3);
        --text: #f8fafc;
        --muted: #94a3b8;
        --soft: #cbd5e1;
        --primary: #22c55e;
        --primary-strong: #16a34a;
        --accent: #38bdf8;
        --warning: #f59e0b;
        --danger: #ef4444;
        --shadow: 0 22px 60px rgba(2, 6, 23, 0.42);
        --radius: 24px;
      }

      * { box-sizing: border-box; }
      html { scroll-behavior: smooth; }

      body {
        margin: 0;
        min-height: 100vh;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(34, 197, 94, 0.18), transparent 24%),
          radial-gradient(circle at top right, rgba(56, 189, 248, 0.14), transparent 22%),
          radial-gradient(circle at bottom left, rgba(245, 158, 11, 0.08), transparent 18%),
          linear-gradient(180deg, #020617 0%, #0b1120 100%);
        font-family: 'Fira Sans', 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      }

      body::before {
        content: '';
        position: fixed;
        inset: 0;
        pointer-events: none;
        background-image:
          linear-gradient(rgba(148, 163, 184, 0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(148, 163, 184, 0.04) 1px, transparent 1px);
        background-size: 34px 34px;
        mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.42), transparent 84%);
      }

      a { color: inherit; text-decoration: none; }
      button, input, select, textarea { font: inherit; }
      button { cursor: pointer; }

      .shell {
        position: relative;
        width: min(1280px, calc(100% - 32px));
        margin: 0 auto;
        padding: 20px 0 56px;
      }

      .notice {
        margin-bottom: 16px;
        padding: 14px 16px;
        border-radius: 18px;
        border: 1px solid var(--line);
        background: rgba(15, 23, 42, 0.88);
        box-shadow: var(--shadow);
      }

      .notice.success {
        border-color: rgba(34, 197, 94, 0.35);
        background: rgba(20, 83, 45, 0.52);
      }

      .notice.error {
        border-color: rgba(239, 68, 68, 0.4);
        background: rgba(127, 29, 29, 0.62);
      }

      .hero,
      .panel,
      .category-section {
        border: 1px solid var(--line);
        border-radius: var(--radius);
        background: var(--panel);
        box-shadow: var(--shadow);
        backdrop-filter: blur(16px);
      }

      .hero {
        display: grid;
        grid-template-columns: minmax(0, 1.15fr) minmax(300px, 0.85fr);
        gap: 16px;
        padding: 20px;
        margin-bottom: 18px;
      }

      .hero-copy,
      .hero-side,
      .section-head {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .eyebrow,
      .kbd,
      .pill,
      .month-chip,
      .muted,
      .summary-stack span,
      .empty-badge,
      .mobile-metric span,
      .mobile-details dt {
        font-family: 'Fira Code', ui-monospace, SFMono-Regular, Menlo, monospace;
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        width: fit-content;
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid rgba(34, 197, 94, 0.25);
        background: rgba(34, 197, 94, 0.12);
        color: #a7f3d0;
        font-size: 12px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      .eyebrow.subtle {
        border-color: rgba(148, 163, 184, 0.2);
        background: rgba(15, 23, 42, 0.6);
        color: var(--soft);
      }

      .hero h1 {
        margin: 0;
        font-size: clamp(2rem, 4vw, 3.6rem);
        line-height: 0.98;
        letter-spacing: -0.05em;
        max-width: 12ch;
      }

      .hero p,
      .section-head p,
      .category-summary p,
      .empty-state p {
        margin: 0;
        color: var(--soft);
        line-height: 1.65;
      }

      .hero-actions,
      .toolbar-actions,
      .actions,
      .form-actions,
      .empty-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
      }

      .stats,
      .summary-strip,
      .category-totals {
        display: grid;
        gap: 12px;
      }

      .stats {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .stat,
      .summary-tile,
      .category-total,
      .mobile-card {
        padding: 14px;
        border: 1px solid var(--line);
        border-radius: 18px;
        background: rgba(2, 6, 23, 0.22);
      }

      .stat .label,
      .summary-tile span,
      .field label,
      .field .field-label {
        color: var(--muted);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .stat .value {
        margin-top: 8px;
        font-size: 1.55rem;
        font-weight: 800;
        line-height: 1.1;
      }

      .stat .hint {
        margin-top: 6px;
        color: var(--soft);
        font-size: 0.9rem;
      }

      .summary-strip {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .summary-strip.compact {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .summary-tile strong,
      .category-total strong {
        display: block;
        margin-top: 6px;
        font-size: 1.08rem;
      }

      .grid {
        display: grid;
        gap: 18px;
      }

      .section-head {
        margin-bottom: 14px;
      }

      .section-head h2,
      .category-summary h3 {
        margin: 0;
        font-size: 1.25rem;
        line-height: 1.2;
      }

      .toolbar {
        display: grid;
        gap: 14px;
      }

      .filter-grid {
        display: grid;
        grid-template-columns: 170px minmax(0, 1fr) minmax(0, 1.3fr);
        gap: 12px;
        align-items: start;
      }

      .field {
        display: grid;
        gap: 8px;
      }

      .field-wide {
        grid-column: 1 / -1;
      }

      .field input,
      .field select,
      .field textarea {
        width: 100%;
        min-height: 48px;
        padding: 12px 14px;
        border-radius: 16px;
        border: 1px solid var(--line);
        background: rgba(2, 6, 23, 0.42);
        color: var(--text);
        outline: none;
      }

      .field textarea {
        resize: vertical;
      }

      .field input::placeholder,
      .field textarea::placeholder {
        color: #64748b;
      }

      .field input:focus,
      .field select:focus,
      .field textarea:focus {
        border-color: rgba(34, 197, 94, 0.5);
        box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.12);
      }

      .month-grid {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 10px;
      }

      .month-chip {
        min-height: 54px;
        padding: 10px 12px;
        border-radius: 16px;
        border: 1px solid var(--line);
        background: rgba(2, 6, 23, 0.32);
        color: var(--text);
        text-align: left;
        font-size: 0.82rem;
        line-height: 1.25;
        transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;
      }

      .month-chip:hover {
        transform: translateY(-1px);
        border-color: rgba(56, 189, 248, 0.35);
      }

      .month-chip.active {
        border-color: rgba(34, 197, 94, 0.6);
        background: linear-gradient(135deg, rgba(34, 197, 94, 0.24), rgba(56, 189, 248, 0.16));
        box-shadow: inset 0 0 0 1px rgba(34, 197, 94, 0.12);
      }

      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-height: 46px;
        padding: 11px 16px;
        border: 1px solid transparent;
        border-radius: 14px;
        background: rgba(15, 23, 42, 0.56);
        color: var(--text);
        font-weight: 700;
        text-decoration: none;
        transition: transform 160ms ease, border-color 160ms ease, background 160ms ease, opacity 160ms ease;
      }

      .btn:hover {
        transform: translateY(-1px);
      }

      .btn-primary {
        background: linear-gradient(135deg, var(--primary), var(--primary-strong));
        color: #052e16;
      }

      .btn-muted {
        border-color: var(--line);
        background: rgba(2, 6, 23, 0.34);
      }

      .btn-outline {
        border-color: rgba(56, 189, 248, 0.35);
        background: rgba(8, 47, 73, 0.35);
      }

      .btn-success {
        border-color: rgba(34, 197, 94, 0.3);
        background: rgba(20, 83, 45, 0.55);
      }

      .btn-danger {
        border-color: rgba(239, 68, 68, 0.35);
        background: rgba(127, 29, 29, 0.56);
      }

      .btn-sm {
        min-height: 40px;
        padding: 9px 13px;
        border-radius: 12px;
        font-size: 0.9rem;
      }

      .btn:disabled {
        opacity: 0.58;
        cursor: not-allowed;
      }

      .pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 7px 10px;
        border-radius: 999px;
        border: 1px solid var(--line);
        font-size: 0.8rem;
        white-space: nowrap;
      }

      .pill.done {
        border-color: rgba(34, 197, 94, 0.3);
        background: rgba(20, 83, 45, 0.56);
      }

      .pill.pending {
        border-color: rgba(245, 158, 11, 0.3);
        background: rgba(120, 53, 15, 0.52);
      }

      .table-wrap {
        overflow: auto;
        border-radius: 20px;
        border: 1px solid var(--line);
        background: rgba(2, 6, 23, 0.22);
      }

      .data-table {
        width: 100%;
        border-collapse: collapse;
        min-width: 980px;
      }

      .data-table th,
      .data-table td {
        padding: 14px 16px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.12);
        text-align: left;
        vertical-align: top;
      }

      .data-table th {
        position: sticky;
        top: 0;
        z-index: 1;
        background: rgba(15, 23, 42, 0.98);
        color: var(--soft);
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .data-table tbody tr:nth-child(odd) {
        background: rgba(2, 6, 23, 0.08);
      }

      .data-table tbody tr:hover {
        background: rgba(56, 189, 248, 0.08);
      }

      .cell-stack {
        display: grid;
        gap: 4px;
      }

      .muted {
        color: var(--muted);
        font-size: 0.82rem;
      }

      .actions {
        align-items: flex-start;
      }

      .actions form {
        margin: 0;
      }

      .category-section {
        overflow: hidden;
      }

      .category-summary {
        display: flex;
        justify-content: space-between;
        gap: 14px;
        align-items: flex-start;
        padding: 18px;
        cursor: pointer;
        list-style: none;
      }

      .category-summary::-webkit-details-marker {
        display: none;
      }

      .summary-stack {
        display: grid;
        justify-items: end;
        gap: 4px;
        text-align: right;
      }

      .summary-stack strong {
        font-size: 1.1rem;
      }

      .category-totals {
        grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      }

      .empty-state {
        display: grid;
        gap: 10px;
        justify-items: start;
        padding: 28px;
        border: 1px dashed var(--line-strong);
        border-radius: 22px;
        background:
          linear-gradient(135deg, rgba(56, 189, 248, 0.09), rgba(34, 197, 94, 0.08)),
          rgba(2, 6, 23, 0.22);
      }

      .empty-state.compact {
        margin: 18px;
      }

      .empty-state h3 {
        margin: 0;
        font-size: 1.15rem;
      }

      .empty-badge {
        display: inline-flex;
        align-items: center;
        padding: 5px 10px;
        border-radius: 999px;
        border: 1px solid rgba(56, 189, 248, 0.24);
        background: rgba(8, 47, 73, 0.36);
        color: #bae6fd;
        font-size: 0.76rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .desktop-table {
        display: block;
      }

      .mobile-card-list {
        display: none;
      }

      .mobile-card {
        display: grid;
        gap: 14px;
      }

      .mobile-card-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: flex-start;
      }

      .mobile-card-head h4 {
        margin: 8px 0 0;
        font-size: 1.02rem;
        line-height: 1.3;
      }

      .mobile-metrics {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }

      .mobile-metric {
        padding: 12px;
        border-radius: 16px;
        background: rgba(15, 23, 42, 0.54);
        border: 1px solid var(--line);
      }

      .mobile-metric span {
        display: block;
        color: var(--muted);
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .mobile-metric strong {
        display: block;
        margin-top: 6px;
        font-size: 0.95rem;
        line-height: 1.35;
      }

      .mobile-details {
        display: grid;
        gap: 10px;
        margin: 0;
      }

      .mobile-details div {
        display: grid;
        gap: 4px;
      }

      .mobile-details dt {
        color: var(--muted);
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .mobile-details dd {
        margin: 0;
        color: var(--text);
        line-height: 1.45;
      }

      .is-submitting {
        opacity: 0.92;
      }

      .is-submitting .btn[type='submit'][aria-busy='true'] {
        position: relative;
        overflow: hidden;
      }

      .is-submitting .btn[type='submit'][aria-busy='true']::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.14), transparent);
        transform: translateX(-100%);
        animation: shimmer 1.1s linear infinite;
      }

      .print-only {
        display: none;
      }

      .kbd {
        display: inline-flex;
        align-items: center;
        padding: 4px 8px;
        border-radius: 8px;
        border: 1px solid var(--line);
        background: rgba(2, 6, 23, 0.28);
        font-size: 0.78rem;
        color: var(--soft);
      }

      @keyframes shimmer {
        from { transform: translateX(-100%); }
        to { transform: translateX(100%); }
      }

      @media (max-width: 1080px) {
        .hero,
        .filter-grid,
        .form-grid {
          grid-template-columns: 1fr;
        }

        .stats,
        .summary-strip,
        .summary-strip.compact {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .month-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
      }

      @media (max-width: 860px) {
        .desktop-table {
          display: none;
        }

        .mobile-card-list {
          display: grid;
          gap: 12px;
          padding: 0 18px 18px;
        }
      }

      @media (max-width: 720px) {
        .shell {
          width: min(100% - 20px, 1280px);
          padding-top: 12px;
        }

        .hero,
        .panel,
        .category-summary {
          padding: 16px;
        }

        .hero {
          gap: 14px;
        }

        .hero h1 {
          max-width: none;
          font-size: clamp(1.8rem, 9vw, 2.6rem);
        }

        .stats,
        .summary-strip,
        .summary-strip.compact,
        .mobile-metrics {
          grid-template-columns: 1fr;
        }

        .month-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .month-chip {
          min-height: 58px;
          text-align: center;
          padding: 10px 8px;
        }

        .actions,
        .hero-actions,
        .toolbar-actions,
        .form-actions,
        .empty-actions {
          width: 100%;
        }

        .actions .btn,
        .hero-actions .btn,
        .toolbar-actions .btn,
        .form-actions .btn,
        .empty-actions .btn {
          width: 100%;
        }

        .actions form,
        .mobile-actions .actions {
          width: 100%;
        }

        .actions form .btn {
          width: 100%;
        }

        .category-summary,
        .mobile-card-head {
          flex-direction: column;
        }

        .summary-stack {
          justify-items: flex-start;
          text-align: left;
        }

        .mobile-card-list {
          padding: 0 0 16px;
        }

        .empty-state,
        .empty-state.compact {
          margin: 0;
          padding: 22px 18px;
        }
      }

      @media (max-width: 480px) {
        .month-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .hero,
        .panel,
        .category-summary {
          border-radius: 20px;
        }
      }

      @media print {
        body {
          background: #fff;
          color: #111827;
        }

        body::before,
        .no-print {
          display: none !important;
        }

        .shell {
          width: 100%;
          padding: 0;
        }

        .hero,
        .panel,
        .category-section {
          box-shadow: none;
          background: #fff;
          border-color: #e5e7eb;
        }

        .desktop-table {
          display: block;
        }

        .mobile-card-list {
          display: none;
        }

        .print-only {
          display: block;
        }
      }
    
.month-grid {
 align-items: end;
 display: grid;
 gap: 14px;
 grid-template-columns: minmax(260px, 0.9fr) minmax(260px, 1.1fr);
}
.month-compact {
 align-items: center;
 background: linear-gradient(135deg, rgba(15, 23, 42, 0.94), rgba(20, 83, 45, 0.9));
 border: 1px solid rgba(148, 163, 184, 0.2);
 border-radius: 28px;
 box-shadow: var(--shadow-soft);
 color: #f8fafc;
 display: grid;
 gap: 12px;
 grid-template-columns: 48px 1fr 48px;
 padding: 12px;
}
.month-current { text-align: center; }
.month-current span {
 color: rgba(226, 232, 240, 0.72);
 display: block;
 font-size: 0.76rem;
 font-weight: 800;
 letter-spacing: 0.14em;
 text-transform: uppercase;
}
.month-current strong {
 display: block;
 font-size: clamp(1.35rem, 3vw, 2.15rem);
 letter-spacing: -0.04em;
 line-height: 1.05;
 margin-top: 3px;
}
.month-nav {
 align-items: center;
 background: rgba(255, 255, 255, 0.1);
 border: 1px solid rgba(255, 255, 255, 0.14);
 border-radius: 18px;
 color: #f8fafc;
 display: inline-flex;
 font-size: 1.35rem;
 font-weight: 900;
 height: 48px;
 justify-content: center;
 text-decoration: none;
 transition: transform 0.2s ease, background 0.2s ease;
}
.month-nav:hover {
 background: rgba(255, 255, 255, 0.18);
 transform: translateY(-1px);
}
.month-inline-fields {
 display: grid;
 gap: 12px;
 grid-template-columns: minmax(150px, 1fr) minmax(120px, 0.75fr);
}
.compact-field { margin: 0; }
@media (max-width: 720px) {
 .month-grid,
 .month-inline-fields { grid-template-columns: 1fr; }
 .month-compact { grid-template-columns: 44px 1fr 44px; }
}

</style>
  </head>
  <body>
    <main class="shell">
      ${noticeMarkup}
      ${body}
    </main>
    <script>
      document.addEventListener('submit', (event) => {
        const form = event.target;
        if (!(form instanceof HTMLFormElement)) return;

        const submitter = event.submitter;
        if (submitter instanceof HTMLButtonElement) {
          if (!submitter.dataset.originalLabel) submitter.dataset.originalLabel = submitter.innerHTML;
          submitter.innerHTML = submitter.dataset.loadingLabel || 'Memproses...';
          submitter.disabled = true;
          submitter.setAttribute('aria-busy', 'true');
        }

        form.classList.add('is-submitting');

        form.querySelectorAll('button[type="submit"]').forEach((button) => {
          if (button !== submitter) button.disabled = true;
        });
      });
    </script>
  </body>
  </html>`;
}

export function renderIndex({ rows, summary, query, categories, counts, notice }) {
  const currentYear = new Date().getFullYear();
  const selectedMonth = Number(query.bulan || new Date().getMonth() + 1);
  const selectedYear = Number(query.tahun || currentYear);
  const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
  const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
  const nextMonth = selectedMonth === 12 ? 1 : selectedMonth + 1;
  const nextYear = selectedMonth === 12 ? selectedYear + 1 : selectedYear;
  const monthSelect = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    return `<option value="${month}"${month === selectedMonth ? ' selected' : ''}>${escapeHtml(monthName(month))}</option>`;
  }).join('');
  const monthControls = `
    <div class="month-compact" aria-label="Navigasi bulan kerja">
      <a class="month-nav" href="/?${queryParams(query, { bulan: prevMonth, tahun: prevYear })}" aria-label="Bulan sebelumnya">&larr;</a>
      <div class="month-current">
        <span>Bulan aktif</span>
        <strong>${escapeHtml(monthName(selectedMonth))} ${selectedYear}</strong>
      </div>
      <a class="month-nav" href="/?${queryParams(query, { bulan: nextMonth, tahun: nextYear })}" aria-label="Bulan berikutnya">&rarr;</a>
    </div>
    <div class="month-inline-fields">
      <label class="field compact-field">
        <span>Bulan</span>
        <select name="bulan">${monthSelect}</select>
      </label>
      <label class="field compact-field">
        <span>Tahun</span>
        <select name="tahun">${yearOptions(currentYear, selectedYear)}</select>
      </label>
    </div>`;

  const groupedRows = groupRowsByCategory(rows, categories);
  const totalRows = rows.length;
  const doneCount = Number(summary.done || counts?.done || 0);
  const pendingCount = Number(summary.pending || counts?.pending || 0);
  const exportQuery = queryParams(query);

  return renderPage({
    title: 'Sistem Catatan Tagihan',
    notice,
    body: `
      <section class="hero">
        <div class="hero-copy">
          <span class="eyebrow">Sistem Catatan Tagihan</span>
          <h1>Dashboard tagihan yang cepat dibaca dan cepat ditindak.</h1>
          <p>Catatan operasional, pencarian, summary nominal, dan pemantauan status dirapikan supaya nyaman dipakai di desktop maupun ponsel.</p>
          <div class="hero-actions no-print">
            <a class="btn btn-primary" href="/tagihan/new">Tambah Data</a>
            <a class="btn btn-muted" href="/import">Import</a>
            <a class="btn btn-outline" href="/export.csv${exportQuery}">CSV</a>
            <a class="btn btn-outline" href="/export.xlsx${exportQuery}">Excel</a>
            <a class="btn btn-outline" href="/export.pdf${exportQuery}">PDF</a>
          </div>
          <div class="summary-strip compact">
            <div class="summary-tile">
              <span>Filter aktif</span>
              <strong>${escapeHtml(activeFilterSummary(query))}</strong>
            </div>
            <div class="summary-tile">
              <span>Total baris</span>
              <strong>${totalRows}</strong>
            </div>
          </div>
        </div>

        <aside class="hero-side">
          <div class="stats">
            <div class="stat">
              <div class="label">Total nominal</div>
              <div class="value">${formatCurrency(Number(summary.total_amount || 0))}</div>
              <div class="hint">Akumulasi dari data yang tampil</div>
            </div>
            <div class="stat">
              <div class="label">Sudah dibayar</div>
              <div class="value">${doneCount}</div>
              <div class="hint">Status lunas</div>
            </div>
            <div class="stat">
              <div class="label">Belum dibayar</div>
              <div class="value">${pendingCount}</div>
              <div class="hint">Butuh follow-up</div>
            </div>
            <div class="stat">
              <div class="label">Kategori</div>
              <div class="value">${categories.length}</div>
              <div class="hint">Kelompok tagihan</div>
            </div>
          </div>
        </aside>
      </section>

      <section class="panel no-print">
        <div class="section-head">
          <span class="eyebrow">Filter cepat</span>
          <h2>Periode, pencarian, dan navigasi data</h2>
          <p>Chip bulan dibuat lebih padat untuk mobile, dan hasil export tetap mengikuti filter aktif yang sedang kamu pakai.</p>
        </div>

        <form class="toolbar" method="get" action="/">
          <div class="filter-grid">
            <div class="field">
              <label for="tahun">Tahun</label>
              <select id="tahun" name="tahun">
                <option value="">Semua</option>
                ${yearOptions(currentYear, query.tahun)}
              </select>
            </div>

            <div class="field">
              <label for="q">Pencarian</label>
              <input id="q" name="q" type="search" value="${escapeHtml(query.q || '')}" placeholder="Cari kategori, deskripsi, nomor, channel, atau status" />
            </div>

            <div class="field field-wide">
              <span class="field-label">Bulan</span>
              <div class="month-grid">
                <button class="month-chip ${!query.bulan ? 'active' : ''}" type="submit" name="bulan" value="" aria-pressed="${!query.bulan ? 'true' : 'false'}">Semua<br /><span>bulan</span></button>
                ${monthControls}
              </div>
            </div>
          </div>

          <div class="toolbar-actions">
            <button class="btn btn-primary" type="submit" data-loading-label="Menerapkan...">Terapkan</button>
            <a class="btn btn-muted" href="/">Reset</a>
            <span class="kbd">Enter</span>
          </div>
        </form>
      </section>

      <section class="panel">
        <div class="section-head">
          <span class="eyebrow">Total per kategori</span>
          <h2>Ringkasan kategori yang tampil</h2>
          <p>Ini membantu cepat melihat kategori yang paling besar tanpa harus buka detail satu per satu.</p>
        </div>
        <div class="category-totals">
          ${
            categories.length
              ? categories
                  .map(
                    (item) => `
                      <div class="category-total">
                        <span class="muted">${escapeHtml(item.kategori)}</span>
                        <strong>${formatCurrency(Number(item.total || 0))}</strong>
                        <div class="muted">${rows.filter((row) => row.kategori === item.kategori).length} baris</div>
                      </div>
                    `,
                  )
                  .join('')
              : renderEmptyState({
                  title: 'Belum ada kategori yang tampil',
                  description: 'Data untuk kombinasi filter ini belum tersedia. Coba reset filter atau tambahkan tagihan baru.',
                  actions: '<a class="btn btn-primary" href="/tagihan/new">Tambah Tagihan</a><a class="btn btn-muted" href="/">Reset Filter</a>',
                })
          }
        </div>
      </section>

      <section class="grid">
        ${
          groupedRows.length
            ? groupedRows.map((group) => renderCategorySection(group, query)).join('')
            : `<div class="panel">${renderEmptyState({
                title: 'Tidak ada data yang cocok',
                description: 'Belum ada tagihan yang cocok dengan filter aktif. Kamu bisa reset filter atau mulai isi data baru.',
                actions: '<a class="btn btn-primary" href="/tagihan/new">Tambah Data</a><a class="btn btn-muted" href="/">Reset Filter</a>',
              })}</div>`
        }
      </section>
    `,
  });
}

export function renderForm({ mode, item, notice }) {
  const isEdit = mode === 'edit';
  const record = item || {};

  return renderPage({
    title: isEdit ? 'Edit Tagihan' : 'Tambah Tagihan',
    notice,
    body: `
      <section class="hero">
        <div class="hero-copy">
          <span class="eyebrow">${isEdit ? 'Edit data' : 'Tambah data'}</span>
          <h1>${isEdit ? 'Perbarui catatan tagihan' : 'Tambahkan catatan tagihan baru'}</h1>
          <p>Form ini tetap sederhana: isi data inti, pilih channel pembayaran, dan tentukan status. Setelah disimpan, kembali ke dashboard dengan struktur yang sama.</p>
        </div>
        <aside class="hero-side">
          <div class="summary-strip">
            <div class="summary-tile">
              <span>Wajib</span>
              <strong>Bulan, tahun, deskripsi, nominal</strong>
            </div>
            <div class="summary-tile">
              <span>Status</span>
              <strong>Langsung pilih lunas atau belum</strong>
            </div>
            <div class="summary-tile">
              <span>Channel</span>
              <strong>Tokopedia, Shopee, Blibli, Website, Tunai</strong>
            </div>
          </div>
        </aside>
      </section>

      <section class="panel">
        <form method="post" action="${isEdit ? `/tagihan/${record.id}` : '/tagihan'}" class="toolbar">
          <div class="form-grid">
            <div class="field">
              <label for="bulan">Bulan</label>
              <input id="bulan" name="bulan" type="number" min="1" max="12" required value="${escapeHtml(record.bulan ?? '')}" />
            </div>

            <div class="field">
              <label for="tahun">Tahun</label>
              <input id="tahun" name="tahun" type="number" min="1900" max="2100" required value="${escapeHtml(record.tahun ?? '')}" />
            </div>

            <div class="field">
              <label for="kategori">Kategori</label>
              <input id="kategori" name="kategori" type="text" required value="${escapeHtml(record.kategori ?? '')}" placeholder="Contoh: Listrik" />
            </div>

            <div class="field">
              <label for="nomor_tagihan">Nomor Tagihan</label>
              <input id="nomor_tagihan" name="nomor_tagihan" type="text" required value="${escapeHtml(record.nomor_tagihan ?? '')}" placeholder="Nomor pelanggan / tagihan" />
            </div>

            <div class="field field-wide">
              <label for="deskripsi">Deskripsi</label>
              <textarea id="deskripsi" name="deskripsi" rows="4" required placeholder="Nama tagihan yang akan tampil di dashboard">${escapeHtml(record.deskripsi ?? '')}</textarea>
            </div>

            <div class="field">
              <label for="jumlah_tagihan">Jumlah Tagihan</label>
              <input id="jumlah_tagihan" name="jumlah_tagihan" type="number" min="0" step="1" required value="${escapeHtml(record.jumlah_tagihan ?? '')}" />
            </div>

            <div class="field">
              <label for="channel_pembayaran">Channel Pembayaran</label>
              <select id="channel_pembayaran" name="channel_pembayaran" required>
                <option value="">Pilih channel</option>
                ${optionList(PAYMENT_CHANNELS, record.channel_pembayaran)}
              </select>
            </div>

            <div class="field">
              <label for="status_bayar">Status Bayar</label>
              <select id="status_bayar" name="status_bayar" required>
                <option value="">Pilih status</option>
                ${optionList(BILLING_STATUSES, record.status_bayar)}
              </select>
            </div>
          </div>

          <div class="form-actions">
            <button class="btn btn-primary" type="submit" data-loading-label="Menyimpan...">${isEdit ? 'Simpan Perubahan' : 'Simpan Data'}</button>
            <a class="btn btn-muted" href="/">Batal</a>
          </div>
        </form>
      </section>
    `,
  });
}

export function renderExportPreview({ rows, summary, categories, query, title, header, notice }) {
  const exportQuery = queryParams(query);

  return renderPage({
    title,
    notice,
    body: `
      <section class="hero">
        <div class="hero-copy">
          <span class="eyebrow">Preview export</span>
          <h1>${escapeHtml(header)}</h1>
          <p>Preview ini mengikuti filter aktif sehingga hasil unduhan CSV, Excel, dan PDF tetap konsisten dengan data yang sedang kamu lihat.</p>
          <div class="hero-actions no-print">
            <a class="btn btn-primary" href="/export.pdf${exportQuery}">Unduh PDF</a>
            <a class="btn btn-muted" href="/export.xlsx${exportQuery}">Unduh Excel</a>
            <a class="btn btn-outline" href="/export.csv${exportQuery}">Unduh CSV</a>
            <a class="btn btn-muted" href="/">Kembali</a>
            <button class="btn btn-outline" type="button" onclick="window.print()">Cetak</button>
          </div>
        </div>
        <aside class="hero-side">
          <div class="summary-strip">
            <div class="summary-tile">
              <span>Baris</span>
              <strong>${rows.length}</strong>
            </div>
            <div class="summary-tile">
              <span>Nominal</span>
              <strong>${formatCurrency(Number(summary.total_amount || 0))}</strong>
            </div>
            <div class="summary-tile">
              <span>Kategori</span>
              <strong>${categories.length}</strong>
            </div>
          </div>
        </aside>
      </section>

      <section class="panel">
        <div class="section-head">
          <span class="eyebrow">Data preview</span>
          <h2>Ringkasan sebelum export</h2>
          <p>Filter aktif: ${escapeHtml(activeFilterSummary(query))}</p>
        </div>
        <div class="category-totals">
          ${
            categories.length
              ? categories
                  .map(
                    (item) => `
                      <div class="category-total">
                        <span class="muted">${escapeHtml(item.kategori)}</span>
                        <strong>${formatCurrency(Number(item.total || 0))}</strong>
                      </div>
                    `,
                  )
                  .join('')
              : renderEmptyState({
                  title: 'Belum ada data untuk diekspor',
                  description: 'Preview export masih kosong karena filter aktif belum menemukan data.',
                  actions: '<a class="btn btn-muted" href="/">Kembali ke Dashboard</a>',
                })
          }
        </div>
      </section>

      <section class="panel">
        ${rows.length
          ? renderRowTable(rows, query)
          : renderEmptyState({
              title: 'Preview export kosong',
              description: 'Tidak ada baris yang ikut ke file export untuk filter ini.',
              actions: '<a class="btn btn-primary" href="/">Atur Ulang Filter</a>',
            })}
      </section>
    `,
  });
}
