"use client";

import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";

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

const STORAGE_KEY = "tagihan-yakin-v1";
const CHANNELS: BillingChannel[] = ["Tokopedia", "Shopee", "Blibli", "Website", "Tunai"];
const STATUSES: BillingStatus[] = ["Sudah Dibayar", "Belum Dibayar"];
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

function parseImportFile(text: string, fileName: string): ImportPreviewRow[] {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "csv") return parseCsv(text).map((row, index) => mapLegacyRow(row, index));

  const workbook = XLSX.read(text, { type: "string" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
  return rows.map((row, index) => {
    const normalized = Object.fromEntries(Object.entries(row).map(([k, v]) => [normalizeHeader(k), String(v ?? "")]));
    return mapLegacyRow(normalized, index);
  });
}

function exportCsv(rows: BillingRow[]) {
  const header = ["bulan", "tahun", "kategori", "deskripsi", "nomor_tagihan", "jumlah_tagihan", "channel_pembayaran", "status_bayar"];
  const body = rows.map((row) => header.map((key) => JSON.stringify(row[key as keyof BillingRow] ?? "")).join(","));
  return `${header.join(",")}\n${body.join("\n")}\n`;
}

function exportXlsx(rows: BillingRow[]) {
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
  XLSX.utils.book_append_sheet(workbook, worksheet, "Tagihan");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
}

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function initialForm(): Partial<BillingRow> {
  return {
    bulan: new Date().getMonth() + 1,
    tahun: new Date().getFullYear(),
    kategori: "PLN",
    deskripsi: "",
    nomor_tagihan: "",
    jumlah_tagihan: 0,
    channel_pembayaran: "Website",
    status_bayar: "Belum Dibayar",
  };
}

export default function Home() {
  const [rows, setRows] = useState<BillingRow[]>([]);
  const [bulan, setBulan] = useState("");
  const [tahun, setTahun] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<Partial<BillingRow>>(initialForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<ImportPreviewRow[]>([]);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      setRows(JSON.parse(raw));
      return;
    }
    const seed: BillingRow[] = [
      {
        id: uid(),
        bulan: 1,
        tahun: 2026,
        kategori: "PLN",
        deskripsi: "Listrik Gedung Utama",
        nomor_tagihan: "1234567890",
        jumlah_tagihan: 750000,
        channel_pembayaran: "Tokopedia",
        status_bayar: "Sudah Dibayar",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    setRows(seed);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  }, []);

  useEffect(() => {
    if (rows.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchBulan = bulan ? String(row.bulan) === bulan : true;
      const matchTahun = tahun ? String(row.tahun) === tahun : true;
      const q = search.trim().toLowerCase();
      const matchSearch = q
        ? [row.kategori, row.deskripsi, row.nomor_tagihan, row.channel_pembayaran, row.status_bayar].join(" ").toLowerCase().includes(q)
        : true;
      return matchBulan && matchTahun && matchSearch;
    });
  }, [rows, bulan, tahun, search]);

  const total = filteredRows.reduce((sum, item) => sum + item.jumlah_tagihan, 0);
  const done = filteredRows.filter((item) => item.status_bayar === "Sudah Dibayar").length;
  const pending = filteredRows.filter((item) => item.status_bayar === "Belum Dibayar").length;
  const categories = useMemo(() => {
    const map = new Map<string, number>();
    filteredRows.forEach((row) => map.set(row.kategori, (map.get(row.kategori) ?? 0) + row.jumlah_tagihan));
    return Array.from(map.entries()).map(([kategori, total]) => ({ kategori, total }));
  }, [filteredRows]);

  function resetForm() {
    setEditingId(null);
    setForm(initialForm());
  }

  function submitForm() {
    const payload: BillingRow = {
      id: editingId ?? uid(),
      bulan: Number(form.bulan),
      tahun: Number(form.tahun),
      kategori: String(form.kategori ?? "").trim(),
      deskripsi: String(form.deskripsi ?? "").trim(),
      nomor_tagihan: String(form.nomor_tagihan ?? "").trim(),
      jumlah_tagihan: Number(form.jumlah_tagihan),
      channel_pembayaran: form.channel_pembayaran as BillingChannel,
      status_bayar: form.status_bayar as BillingStatus,
      createdAt: editingId ? rows.find((item) => item.id === editingId)?.createdAt ?? new Date().toISOString() : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (!payload.bulan || payload.bulan < 1 || payload.bulan > 12) return setNotice("Bulan wajib 1-12.");
    if (!payload.tahun || payload.tahun < 1900) return setNotice("Tahun tidak valid.");
    if (!payload.kategori || !payload.deskripsi || !payload.nomor_tagihan) return setNotice("Field utama wajib diisi.");

    setRows((current) => (editingId ? current.map((item) => (item.id === editingId ? payload : item)) : [payload, ...current]));
    setNotice(editingId ? "Tagihan diperbarui." : "Tagihan ditambahkan.");
    resetForm();
  }

  function editRow(row: BillingRow) {
    setEditingId(row.id);
    setForm(row);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deleteRow(id: string) {
    setRows((current) => current.filter((item) => item.id !== id));
    setNotice("Tagihan dihapus.");
  }

  function handleImport(file: File) {
    setImporting(true);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const parsed = parseImportFile(text, file.name);
      setPreview(parsed);
      const safeRows = parsed
        .filter((item) => item.safe && item.data)
        .map((item) => ({
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
        setRows((current) => [...safeRows, ...current]);
        setNotice(`Import selesai. ${safeRows.length} baris aman ditambahkan. Baris ambigu tetap di review.`);
      } else {
        setNotice("Tidak ada baris aman untuk diimpor.");
      }
      setImporting(false);
    };
    reader.readAsText(file);
  }

  function exportPdf() {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text("SISTEM TAGIHAN OPERASIONAL SEKOLAH YAKIN", 14, 16);
    doc.setFontSize(10);
    doc.text(`Filter: ${bulan || "Semua bulan"} / ${tahun || "Semua tahun"} / ${search || "-"}`, 14, 24);
    doc.text(`Total baris: ${filteredRows.length} | Total nominal: ${formatCurrency(total)}`, 14, 30);
    let y = 42;
    filteredRows.forEach((row) => {
      const line = `${row.bulan}/${row.tahun} | ${row.kategori} | ${row.deskripsi} | ${row.nomor_tagihan} | ${formatCurrency(row.jumlah_tagihan)} | ${row.channel_pembayaran} | ${row.status_bayar}`;
      const lines = doc.splitTextToSize(line, 260);
      if (y > 180) {
        doc.addPage();
        y = 20;
      }
      doc.text(lines, 14, y);
      y += lines.length * 5 + 4;
    });
    doc.save("tagihan-yakin.pdf");
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#e2e8f0_0,_#f8fafc_28%,_#dbeafe_100%)] text-slate-900">
      <div className="mx-auto max-w-[1500px] px-4 py-6 md:px-8">
        <header className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-slate-600">
                Modern School Ops
              </div>
              <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 md:text-6xl">
                Sistem Tagihan Operasional Sekolah YAKIN
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
                Dashboard tagihan yang tenang, rapi, dan data-dense. Fokus ke cepat input, mudah filter, dan siap ekspor tanpa drama.
              </p>
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-[440px]">
              <QuickStat label="Data tampil" value={String(filteredRows.length)} tone="indigo" />
              <QuickStat label="Total nominal" value={formatCurrency(total)} tone="emerald" />
              <QuickStat label="Sudah dibayar" value={String(done)} tone="sky" />
              <QuickStat label="Belum dibayar" value={String(pending)} tone="amber" />
            </div>
          </div>
        </header>

        {notice ? (
          <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sky-900 shadow-sm" aria-live="polite">
            {notice}
          </div>
        ) : null}

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
          <div className="space-y-6">
            <Panel title="Filter & Aksi" description="Saring data, impor file, dan ekspor hasil yang sedang tampil.">
              <div className="grid gap-3 lg:grid-cols-4">
                <FieldSelect label="Bulan" value={bulan} onChange={setBulan}>
                  <option value="">Semua bulan</option>
                  {MONTHS.map((name, index) => (
                    <option key={name} value={index + 1}>{`${index + 1} - ${name}`}</option>
                  ))}
                </FieldSelect>
                <FieldSelect label="Tahun" value={tahun} onChange={setTahun}>
                  <option value="">Semua tahun</option>
                  {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() + 1].map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </FieldSelect>
                <FieldInput label="Search" value={search} onChange={setSearch} placeholder="Cari kategori, deskripsi, nomor..." />
                <div className="flex items-end">
                  <button className="btn-secondary h-12 w-full" onClick={() => { setBulan(""); setTahun(""); setSearch(""); }}>
                    Reset filter
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button className="btn-primary" onClick={submitForm}>
                  {editingId ? "Simpan perubahan" : "Tambah tagihan"}
                </button>
                <button className="btn-secondary" onClick={resetForm}>
                  Clear form
                </button>
                <label className="btn-secondary cursor-pointer">
                  {importing ? "Memproses..." : "Import Excel/CSV"}
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])}
                  />
                </label>
                <button className="btn-secondary" onClick={() => download("tagihan-yakin.csv", new Blob([exportCsv(filteredRows)], { type: "text/csv;charset=utf-8" }))}>
                  Export CSV
                </button>
                <button
                  className="btn-secondary"
                  onClick={() =>
                    download(
                      "tagihan-yakin.xlsx",
                      new Blob([exportXlsx(filteredRows)], {
                        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                      }),
                    )
                  }
                >
                  Export Excel
                </button>
                <button className="btn-secondary" onClick={exportPdf}>
                  Export PDF
                </button>
              </div>
            </Panel>

            <Panel title="Daftar Tagihan" description="Tabel operasional yang fokus ke data, bukan ornamen.">
              <div className="overflow-hidden rounded-[1.5rem] border border-slate-200">
                <div className="max-h-[720px] overflow-auto">
                  <table className="min-w-full border-separate border-spacing-0">
                    <thead className="sticky top-0 z-10 bg-slate-950 text-left text-[11px] uppercase tracking-[0.22em] text-slate-300">
                      <tr>
                        <Th>Bulan/Tahun</Th>
                        <Th>Kategori</Th>
                        <Th>Deskripsi</Th>
                        <Th>Nomor</Th>
                        <Th align="right">Jumlah</Th>
                        <Th>Channel</Th>
                        <Th>Status</Th>
                        <Th>Aksi</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.length ? (
                        filteredRows.map((row, index) => (
                          <tr key={row.id} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                            <Td className="font-semibold text-slate-900">{`${row.bulan}/${row.tahun}`}</Td>
                            <Td>
                              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                {row.kategori}
                              </span>
                            </Td>
                            <Td className="max-w-[260px]">
                              <div className="truncate text-slate-700">{row.deskripsi}</div>
                            </Td>
                            <Td className="font-mono text-sm text-slate-700">{row.nomor_tagihan}</Td>
                            <Td className="text-right font-semibold tabular-nums text-slate-900">{formatCurrency(row.jumlah_tagihan)}</Td>
                            <Td className="text-slate-700">{row.channel_pembayaran}</Td>
                            <Td>
                              <StatusPill value={row.status_bayar} />
                            </Td>
                            <Td>
                              <div className="flex flex-wrap gap-2">
                                <button className="btn-mini" onClick={() => editRow(row)}>
                                  Edit
                                </button>
                                <button className="btn-mini" onClick={() => deleteRow(row.id)}>
                                  Hapus
                                </button>
                              </div>
                            </Td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={8}>
                            Belum ada data tagihan yang cocok dengan filter aktif.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:hidden">
                {filteredRows.map((row) => (
                  <div key={row.id} className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-500">{`${row.bulan}/${row.tahun}`}</div>
                        <div className="mt-1 text-lg font-bold text-slate-950">{row.kategori}</div>
                      </div>
                      <StatusPill value={row.status_bayar} />
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-slate-700">
                      <div>{row.deskripsi}</div>
                      <div className="font-mono">{row.nomor_tagihan}</div>
                      <div>{row.channel_pembayaran}</div>
                      <div className="font-semibold tabular-nums text-slate-900">{formatCurrency(row.jumlah_tagihan)}</div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button className="btn-mini" onClick={() => editRow(row)}>
                        Edit
                      </button>
                      <button className="btn-mini" onClick={() => deleteRow(row.id)}>
                        Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <aside className="space-y-6">
            <Panel title="Form Tagihan" description="Satu tempat untuk tambah dan edit data.">
              <div className="grid gap-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <FieldInput label="Bulan" type="number" value={String(form.bulan ?? "")} onChange={(v) => setForm({ ...form, bulan: Number(v) })} />
                  <FieldInput label="Tahun" type="number" value={String(form.tahun ?? "")} onChange={(v) => setForm({ ...form, tahun: Number(v) })} />
                </div>
                <FieldInput label="Kategori" value={String(form.kategori ?? "")} onChange={(v) => setForm({ ...form, kategori: v })} />
                <FieldInput label="Deskripsi" value={String(form.deskripsi ?? "")} onChange={(v) => setForm({ ...form, deskripsi: v })} />
                <FieldInput label="Nomor Tagihan" value={String(form.nomor_tagihan ?? "")} onChange={(v) => setForm({ ...form, nomor_tagihan: v })} />
                <FieldInput label="Jumlah Tagihan" type="number" value={String(form.jumlah_tagihan ?? "")} onChange={(v) => setForm({ ...form, jumlah_tagihan: Number(v) })} />
                <div className="grid gap-3 md:grid-cols-2">
                  <FieldSelect label="Channel Pembayaran" value={String(form.channel_pembayaran ?? "")} onChange={(v) => setForm({ ...form, channel_pembayaran: v as BillingChannel })}>
                    {CHANNELS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </FieldSelect>
                  <FieldSelect label="Status Bayar" value={String(form.status_bayar ?? "")} onChange={(v) => setForm({ ...form, status_bayar: v as BillingStatus })}>
                    {STATUSES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </FieldSelect>
                </div>
                <p className="text-sm leading-6 text-slate-500">
                  Kategori yang umum dipakai: {DEFAULT_CATEGORIES.join(", ")}.
                </p>
              </div>
            </Panel>

            <Panel title="Total per kategori" description="Ringkas beban tagihan berdasarkan kategori aktif.">
              <div className="space-y-3">
                {categories.length ? (
                  categories.map((item) => (
                    <div key={item.kategori} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div className="font-semibold text-slate-800">{item.kategori}</div>
                      <div className="font-semibold tabular-nums text-slate-950">{formatCurrency(item.total)}</div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">Belum ada data untuk ditampilkan.</p>
                )}
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
                      <div className="mt-2 text-sm text-slate-700">
                        {row.safe ? "Siap diimpor." : [...row.reviewReasons, ...row.errors].join(", ")}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">Belum ada file yang dipreview.</p>
                )}
              </div>
            </Panel>
          </aside>
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

function FieldSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      <span>{label}</span>
      <select className="field-input" value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </label>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <th className={`px-4 py-3 ${align === "right" ? "text-right" : "text-left"}`}>{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`border-t border-slate-200 px-4 py-4 align-top text-sm ${className}`}>{children}</td>;
}

function StatusPill({ value }: { value: BillingStatus }) {
  const done = value === "Sudah Dibayar";
  return <span className={done ? "pill pill-ok" : "pill pill-warn"}>{value}</span>;
}
