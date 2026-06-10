"use client";

import { useEffect, useMemo, useState } from "react";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import defaultBillings from "@/data/default-billings.json";

type BillingStatus = "Sudah Dibayar" | "Belum Dibayar";
type BillingChannel = "Tokopedia" | "Shopee" | "Blibli" | "Website" | "Tunai";

type BillingRow = {
  id: string;
  bulan: number;
  tahun: number;
  kategori: string;
  deskripsi: string;
  nomor_tagihan: string;
  jumlah_tagihan: number;
  channel_pembayaran: BillingChannel;
  status_bayar: BillingStatus;
  createdAt: string;
  updatedAt: string;
};

type ImportPreviewRow = {
  rowNumber: number;
  data?: Partial<BillingRow>;
  errors: string[];
  reviewReasons: string[];
  safe: boolean;
};

type MonthOption = {
  key: string;
  label: string;
  available: boolean;
};

const STORAGE_KEY = "sistem-catatan-tagihan-v2";
const CHANNELS: BillingChannel[] = ["Tokopedia", "Shopee", "Blibli", "Website", "Tunai"];
const DEFAULT_CATEGORIES = ["PLN", "Internet", "Gedung", "Air", "ATK", "Lainnya"];
const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s\-./]+/g, "_");
}

function toNumber(value: unknown) {
  const raw = String(value ?? "").replace(/[^\d-]/g, "");
  return raw ? Number(raw) : NaN;
}

function parseCsv(text: string) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map(normalizeHeader);
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = (cells[index] ?? "").replace(/^"(.*)"$/, "$1").trim();
    });
    return row;
  });
}

function mapLegacyRow(raw: Record<string, string>, index: number): ImportPreviewRow {
  const aliases: Record<string, string[]> = {
    bulan: ["bulan", "bln", "month"],
    tahun: ["tahun", "year"],
    kategori: ["kategori", "category", "jenis", "nama_kategori"],
    deskripsi: ["deskripsi", "description", "uraian", "keterangan", "nama_tagihan", "tagihan"],
    nomor_tagihan: ["nomor_tagihan", "no_tagihan", "nomor", "nomor_pelanggan", "no_pelanggan", "id_tagihan"],
    jumlah_tagihan: ["jumlah_tagihan", "jumlah", "nominal", "total", "amount"],
    channel_pembayaran: ["channel_pembayaran", "channel", "metode_bayar", "pembayaran"],
    status_bayar: ["status_bayar", "status", "paid_status"],
  };

  const read = (key: keyof typeof aliases) => aliases[key].find((alias) => raw[alias] !== undefined) ?? "";
  const get = (key: keyof typeof aliases) => raw[read(key)] ?? "";

  const bulan = toNumber(get("bulan"));
  const tahun = toNumber(get("tahun"));
  const jumlah = toNumber(get("jumlah_tagihan"));
  const kategori = get("kategori").trim();
  const deskripsi = get("deskripsi").trim();
  const nomor_tagihan = get("nomor_tagihan").trim();
  const channelRaw = get("channel_pembayaran").trim();
  const statusRaw = get("status_bayar").trim();
  const channel = CHANNELS.find((item) => item.toLowerCase() === channelRaw.toLowerCase());
  const status =
    statusRaw.toLowerCase() === "sudah dibayar" || ["lunas", "paid", "yes", "ya", "1"].includes(statusRaw.toLowerCase())
      ? "Sudah Dibayar"
      : statusRaw.toLowerCase() === "belum dibayar" || ["pending", "unpaid", "no", "tidak", "0"].includes(statusRaw.toLowerCase())
        ? "Belum Dibayar"
        : undefined;

  const data: Partial<BillingRow> = {
    bulan,
    tahun,
    kategori,
    deskripsi,
    nomor_tagihan,
    jumlah_tagihan: jumlah,
    channel_pembayaran: channel,
    status_bayar: status,
  };

  const errors: string[] = [];
  const reviewReasons: string[] = [];
  if (!Number.isInteger(bulan) || bulan < 1 || bulan > 12) errors.push("bulan tidak valid");
  if (!Number.isInteger(tahun) || tahun < 1900 || tahun > 2100) errors.push("tahun tidak valid");
  if (!kategori) errors.push("kategori kosong");
  if (!deskripsi) errors.push("deskripsi kosong");
  if (!nomor_tagihan) errors.push("nomor tagihan kosong");
  if (!Number.isInteger(jumlah) || jumlah < 0) errors.push("jumlah tidak valid");
  if (!channel) reviewReasons.push("channel_pembayaran ambigu");
  if (!status) reviewReasons.push("status_bayar ambigu");

  return { rowNumber: index + 2, data, errors, reviewReasons, safe: errors.length === 0 && reviewReasons.length === 0 };
}

function cellToString(value: ExcelJS.CellValue) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("text" in value && value.text) return String(value.text);
    if ("result" in value && value.result !== undefined) return String(value.result);
    if ("richText" in value && Array.isArray(value.richText)) return value.richText.map((item) => item.text).join("");
  }
  return String(value);
}

async function parseImportFile(content: string | ArrayBuffer, fileName: string): Promise<ImportPreviewRow[]> {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "csv") {
    const text = typeof content === "string" ? content : new TextDecoder().decode(content);
    return parseCsv(text).map((row, index) => mapLegacyRow(row, index));
  }

  const workbook = new ExcelJS.Workbook();
  const buffer = typeof content === "string" ? new TextEncoder().encode(content).buffer : content;
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headers = sheet.getRow(1).values as ExcelJS.CellValue[];
  const rows: Record<string, string>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Record<string, string> = {};
    headers.slice(1).forEach((header, index) => {
      record[normalizeHeader(cellToString(header))] = cellToString(row.getCell(index + 1).value);
    });
    rows.push(record);
  });

  return rows.map((row, index) => {
    const normalized = Object.fromEntries(Object.entries(row).map(([k, v]) => [normalizeHeader(k), v]));
    return mapLegacyRow(normalized, index);
  });
}

function exportCsv(rows: BillingRow[]) {
  const header = ["bulan", "tahun", "kategori", "deskripsi", "nomor_tagihan", "jumlah_tagihan", "channel_pembayaran", "status_bayar"];
  const body = rows.map((row) => header.map((key) => JSON.stringify(row[key as keyof BillingRow] ?? "")).join(","));
  return `${header.join(",")}\n${body.join("\n")}\n`;
}

async function exportXlsx(rows: BillingRow[]) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Tagihan");
  worksheet.columns = [
    { header: "bulan", key: "bulan", width: 10 },
    { header: "tahun", key: "tahun", width: 10 },
    { header: "kategori", key: "kategori", width: 18 },
    { header: "deskripsi", key: "deskripsi", width: 34 },
    { header: "nomor_tagihan", key: "nomor_tagihan", width: 22 },
    { header: "jumlah_tagihan", key: "jumlah_tagihan", width: 18 },
    { header: "channel_pembayaran", key: "channel_pembayaran", width: 22 },
    { header: "status_bayar", key: "status_bayar", width: 18 },
  ];
  rows.forEach((row) => {
    worksheet.addRow({
      bulan: row.bulan,
      tahun: row.tahun,
      kategori: row.kategori,
      deskripsi: row.deskripsi,
      nomor_tagihan: row.nomor_tagihan,
      jumlah_tagihan: row.jumlah_tagihan,
      channel_pembayaran: row.channel_pembayaran,
      status_bayar: row.status_bayar,
    });
  });
  worksheet.getRow(1).font = { bold: true };
  return workbook.xlsx.writeBuffer();
}

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function parseMonthKey(key: string) {
  const [year, month] = key.split("-").map(Number);
  return { year, month };
}

function addMonthsToKey(key: string, offset: number) {
  const { year, month } = parseMonthKey(key);
  const date = new Date(year, month - 1 + offset, 1);
  return monthKey(date.getFullYear(), date.getMonth() + 1);
}

function monthLabelFromKey(key: string) {
  const { year, month } = parseMonthKey(key);
  return `${MONTHS[month - 1]} ${year}`;
}

function sortMonthKeys(keys: string[]) {
  return [...new Set(keys)].sort((a, b) => a.localeCompare(b));
}

function getMonthOptions(rows: BillingRow[]) {
  const monthKeys = sortMonthKeys(rows.map((row) => monthKey(row.tahun, row.bulan)));
  const latest = monthKeys.at(-1);
  const next = latest ? addMonthsToKey(latest, 1) : monthKey(new Date().getFullYear(), new Date().getMonth() + 1);
  const options = [...monthKeys, next].filter((key, index, array) => array.indexOf(key) === index);
  return options.map((key) => ({
    key,
    label: monthLabelFromKey(key),
    available: monthKeys.includes(key),
  })) satisfies MonthOption[];
}

function makeRowTemplate(source: BillingRow, patch: Partial<BillingRow> = {}): BillingRow {
  return {
    ...source,
    ...patch,
    id: patch.id ?? uid(),
    jumlah_tagihan: patch.jumlah_tagihan ?? 0,
    status_bayar: patch.status_bayar ?? "Belum Dibayar",
    createdAt: patch.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function buildMonthRows(rows: BillingRow[], targetKey: string) {
  const targetRows = rows.filter((row) => monthKey(row.tahun, row.bulan) === targetKey);
  if (targetRows.length) return targetRows;

  const monthKeys = sortMonthKeys(rows.map((row) => monthKey(row.tahun, row.bulan)));
  const latestKey = monthKeys.at(-1);
  if (!latestKey) return [] as BillingRow[];

  const sourceRows = rows.filter((row) => monthKey(row.tahun, row.bulan) === latestKey);
  const { year, month } = parseMonthKey(targetKey);
  return sourceRows.map((row) =>
    makeRowTemplate(row, {
      id: uid(),
      tahun: year,
      bulan: month,
      jumlah_tagihan: 0,
      status_bayar: "Belum Dibayar",
    }),
  );
}

export default function Home() {
  const [rows, setRows] = useState<BillingRow[]>([]);
  const [activeMonth, setActiveMonth] = useState("");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<ImportPreviewRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const raw = localStorage.getItem(STORAGE_KEY);
      const seed = raw ? (JSON.parse(raw) as BillingRow[]) : (defaultBillings as BillingRow[]);
      setRows(seed);
      if (!raw) localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      setStorageReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (storageReady) localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  }, [rows, storageReady]);

  const monthOptions = useMemo(() => getMonthOptions(rows), [rows]);
  const latestAvailableMonth = monthOptions.findLast((opt) => opt.available)?.key ?? "";
  const activeMonthKey = activeMonth || latestAvailableMonth;
  const activeRows = useMemo(() => rows.filter((row) => monthKey(row.tahun, row.bulan) === activeMonthKey), [rows, activeMonthKey]);
  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeRows.filter((row) => {
      if (!q) return true;
      return [row.kategori, row.deskripsi, row.nomor_tagihan, row.channel_pembayaran, row.status_bayar].join(" ").toLowerCase().includes(q);
    });
  }, [activeRows, search]);

  const totals = useMemo(() => {
    const total = visibleRows.reduce((sum, row) => sum + row.jumlah_tagihan, 0);
    return {
      total,
      done: visibleRows.filter((row) => row.status_bayar === "Sudah Dibayar").length,
      pending: visibleRows.filter((row) => row.status_bayar === "Belum Dibayar").length,
    };
  }, [visibleRows]);

  const categorySections = useMemo(() => {
    const order = Array.from(new Set([...DEFAULT_CATEGORIES, ...visibleRows.map((row) => row.kategori)]));
    return order
      .map((kategori) => ({
        kategori,
        rows: visibleRows.filter((row) => row.kategori === kategori),
      }))
      .filter((section) => section.rows.length > 0);
  }, [visibleRows]);

  function changeMonth(nextMonth: string) {
    setActiveMonth(nextMonth);
    const option = monthOptions.find((item) => item.key === nextMonth);
    if (!option?.available) {
      setRows((current) => {
        if (current.some((row) => monthKey(row.tahun, row.bulan) === nextMonth)) return current;
        return [...current, ...buildMonthRows(current, nextMonth)];
      });
    }
  }

  function updateRow(id: string, patch: Partial<BillingRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch, updatedAt: new Date().toISOString() } : row)));
  }

  function deleteRow(id: string) {
    setRows((current) => current.filter((row) => row.id !== id));
    setNotice("Baris dihapus.");
  }

  function toggleStatus(id: string) {
    setRows((current) =>
      current.map((row) =>
        row.id === id
          ? {
              ...row,
              status_bayar: row.status_bayar === "Sudah Dibayar" ? "Belum Dibayar" : "Sudah Dibayar",
              updatedAt: new Date().toISOString(),
            }
          : row,
      ),
    );
  }

  function addRow(kategori: string) {
    const template = [...visibleRows].reverse().find((row) => row.kategori === kategori) ?? visibleRows.at(-1);
    if (!template) return;
    const newRow = makeRowTemplate(template, {
      id: uid(),
      kategori,
      deskripsi: template.deskripsi,
      nomor_tagihan: template.nomor_tagihan,
      jumlah_tagihan: 0,
      status_bayar: "Belum Dibayar",
      bulan: parseMonthKey(activeMonthKey).month,
      tahun: parseMonthKey(activeMonthKey).year,
    });
    setRows((current) => [...current, newRow]);
    setNotice(`Baris baru ditambahkan di kategori ${kategori}.`);
  }

  function handleImport(file: File) {
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const content = reader.result;
      if (!content) {
        setImporting(false);
        setNotice("File tidak bisa dibaca.");
        return;
      }
      const parsed = await parseImportFile(content, file.name);
      setPreview(parsed);
      const safeRows = parsed.filter((item) => item.safe && item.data).map((item) => ({
        id: uid(),
        bulan: item.data!.bulan as number,
        tahun: item.data!.tahun as number,
        kategori: item.data!.kategori as string,
        deskripsi: item.data!.deskripsi as string,
        nomor_tagihan: item.data!.nomor_tagihan as string,
        jumlah_tagihan: item.data!.jumlah_tagihan as number,
        channel_pembayaran: item.data!.channel_pembayaran as BillingChannel,
        status_bayar: item.data!.status_bayar as BillingStatus,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      if (safeRows.length) {
        setRows((current) => [...current, ...safeRows]);
        setNotice(`Import selesai. ${safeRows.length} baris aman ditambahkan.`);
      } else {
        setNotice("Tidak ada baris aman untuk diimpor.");
      }
      setImporting(false);
    };
    reader.readAsArrayBuffer(file);
  }

  function exportPdf() {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text("SISTEM CATATAN TAGIHAN", 14, 16);
    doc.setFontSize(10);
    doc.text(`Bulan: ${activeMonthKey ? monthLabelFromKey(activeMonthKey) : "-"}`, 14, 24);
    doc.text(`Total baris: ${visibleRows.length} | Total nominal: ${formatCurrency(totals.total)}`, 14, 30);
    let y = 42;
    visibleRows.forEach((row) => {
      const line = `${row.kategori} | ${row.deskripsi} | ${row.nomor_tagihan} | ${formatCurrency(row.jumlah_tagihan)} | ${row.channel_pembayaran} | ${row.status_bayar}`;
      const lines = doc.splitTextToSize(line, 260);
      if (y > 180) {
        doc.addPage();
        y = 20;
      }
      doc.text(lines, 14, y);
      y += lines.length * 5 + 4;
    });
    doc.save("sistem-catatan-tagihan.pdf");
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#e2e8f0_0,_#f8fafc_28%,_#dbeafe_100%)] text-slate-900">
      <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-8">
        <header className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-slate-600">
                Sistem Catatan Tagihan
              </div>
              <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 md:text-6xl">
                Bulan aktif, tabel per kategori, dan status cepat dalam satu layar.
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 md:text-lg">
                Pilih bulan, edit nominal langsung di baris, ubah status cepat, dan tambah baris kalau ada tagihan tambahan.
              </p>
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-[460px]">
              <QuickStat label="Baris tampil" value={String(visibleRows.length)} tone="indigo" />
              <QuickStat label="Total nominal" value={formatCurrency(totals.total)} tone="emerald" />
              <QuickStat label="Sudah dibayar" value={String(totals.done)} tone="sky" />
              <QuickStat label="Belum dibayar" value={String(totals.pending)} tone="amber" />
            </div>
          </div>
        </header>

        {notice ? (
          <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sky-900 shadow-sm" aria-live="polite">
            {notice}
          </div>
        ) : null}

        <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-950">Bulan kerja</h2>
              <p className="text-sm text-slate-500">Hanya bulan yang sudah ada dan satu bulan berikutnya yang ditampilkan.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {monthOptions.map((option) => (
                <button
                  key={option.key}
                  className={`month-chip ${activeMonthKey === option.key ? "month-chip-active" : ""} ${option.available ? "" : "month-chip-next"}`}
                  onClick={() => changeMonth(option.key)}
                >
                  {option.label}
                  {!option.available ? <span className="month-chip-tag">next</span> : null}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <label className="btn-secondary cursor-pointer">
              {importing ? "Memproses..." : "Import Excel/CSV"}
              <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])} />
            </label>
            <button className="btn-secondary" onClick={() => download("tagihan.csv", new Blob([exportCsv(visibleRows)], { type: "text/csv;charset=utf-8" }))}>
              Export CSV
            </button>
            <button
              className="btn-secondary"
              onClick={() =>
                exportXlsx(visibleRows).then((data) =>
                  download("tagihan.xlsx", new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })),
                )
              }
            >
              Export Excel
            </button>
            <button className="btn-secondary" onClick={exportPdf}>
              Export PDF
            </button>
            <div className="ml-auto flex min-w-[280px] flex-1 items-center gap-3">
              <FieldInput label="Search" value={search} onChange={setSearch} placeholder="Cari nama, nomor, channel..." />
              <button className="btn-secondary h-12" onClick={() => setSearch("")}>
                Reset
              </button>
            </div>
          </div>
        </section>

        <section className="mt-6 space-y-6">
          {categorySections.length ? (
            categorySections.map((section) => (
              <Panel
                key={section.kategori}
                title={section.kategori}
                description={`${section.rows.length} baris di bulan ${activeMonthKey ? monthLabelFromKey(activeMonthKey) : "-"}`}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-slate-500">
                    Total kategori: <span className="font-semibold text-slate-900">{formatCurrency(section.rows.reduce((sum, row) => sum + row.jumlah_tagihan, 0))}</span>
                  </div>
                  <button className="btn-mini" onClick={() => addRow(section.kategori)}>
                    Tambah Baris
                  </button>
                </div>
                <div className="overflow-hidden rounded-[1.25rem] border border-slate-200">
                  <div className="overflow-auto">
                    <table className="min-w-full border-separate border-spacing-0">
                      <thead className="sticky top-0 z-10 bg-slate-950 text-left text-[11px] uppercase tracking-[0.22em] text-slate-300">
                        <tr>
                          <Th>Deskripsi</Th>
                          <Th>Nomor</Th>
                          <Th align="right">Jumlah</Th>
                          <Th>Channel</Th>
                          <Th>Status</Th>
                          <Th>Aksi</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.rows.map((row) => (
                          <tr key={row.id} className="bg-white">
                            <Td className="max-w-[320px]">
                              <input className="field-input field-input-compact" value={row.deskripsi} onChange={(e) => updateRow(row.id, { deskripsi: e.target.value })} />
                            </Td>
                            <Td className="max-w-[220px]">
                              <input className="field-input field-input-compact font-mono text-sm" value={row.nomor_tagihan} onChange={(e) => updateRow(row.id, { nomor_tagihan: e.target.value })} />
                            </Td>
                            <Td className="text-right">
                              <input
                                className="field-input field-input-compact text-right tabular-nums"
                                type="number"
                                min="0"
                                value={String(row.jumlah_tagihan ?? 0)}
                                onChange={(e) => updateRow(row.id, { jumlah_tagihan: Number(e.target.value) })}
                              />
                            </Td>
                            <Td>
                              <select className="field-input field-input-compact" value={row.channel_pembayaran} onChange={(e) => updateRow(row.id, { channel_pembayaran: e.target.value as BillingChannel })}>
                                {CHANNELS.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            </Td>
                            <Td>
                              <div className="flex gap-2">
                                <button className={`status-toggle ${row.status_bayar === "Belum Dibayar" ? "status-toggle-active" : ""}`} onClick={() => updateRow(row.id, { status_bayar: "Belum Dibayar" })}>
                                  Belum
                                </button>
                                <button className={`status-toggle ${row.status_bayar === "Sudah Dibayar" ? "status-toggle-active" : ""}`} onClick={() => updateRow(row.id, { status_bayar: "Sudah Dibayar" })}>
                                  Sudah
                                </button>
                              </div>
                            </Td>
                            <Td>
                              <div className="flex flex-wrap gap-2">
                                <button className="btn-mini" onClick={() => toggleStatus(row.id)}>
                                  Toggle
                                </button>
                                <button className="btn-mini" onClick={() => deleteRow(row.id)}>
                                  Hapus
                                </button>
                              </div>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Panel>
            ))
          ) : (
            <Panel title="Tidak ada baris" description="Belum ada data untuk bulan aktif.">
              <div className="text-sm text-slate-500">Pilih bulan berikutnya untuk menyalin template dari bulan terakhir.</div>
            </Panel>
          )}
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.9fr]">
          <Panel title="Ringkasan" description="Total tagihan bulan aktif dan distribusi status.">
            <div className="grid gap-3 md:grid-cols-3">
              <QuickStat label="Total nominal" value={formatCurrency(totals.total)} tone="indigo" />
              <QuickStat label="Sudah dibayar" value={String(totals.done)} tone="emerald" />
              <QuickStat label="Belum dibayar" value={String(totals.pending)} tone="amber" />
            </div>
          </Panel>
          <Panel title="Preview Import" description="Baris aman masuk otomatis, baris ambigu tetap review manual.">
            <div className="space-y-3">
              {preview.length ? (
                preview.slice(0, 6).map((row) => (
                  <div key={row.rowNumber} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-500">Baris {row.rowNumber}</div>
                      <span className={row.safe ? "pill pill-ok" : "pill pill-warn"}>{row.safe ? "Safe" : "Review"}</span>
                    </div>
                    <div className="mt-2 text-sm text-slate-700">{row.safe ? "Siap diimpor." : [...row.reviewReasons, ...row.errors].join(", ")}</div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">Belum ada file yang dipreview.</p>
              )}
            </div>
          </Panel>
        </section>
      </div>
    </main>
  );
}

function QuickStat({ label, value, tone }: { label: string; value: string; tone: "indigo" | "emerald" | "sky" | "amber" }) {
  return (
    <div className={`stat-card stat-${tone}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</div>
    </div>
  );
}

function Panel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
      <div className="mb-4">
        <h2 className="text-xl font-black tracking-tight text-slate-950">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      <span>{label}</span>
      <input className="field-input" type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <th className={`px-4 py-3 ${align === "right" ? "text-right" : "text-left"}`}>{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`border-t border-slate-200 px-4 py-4 align-top text-sm ${className}`}>{children}</td>;
}
