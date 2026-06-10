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
const CATEGORIES = ["PLN", "Internet", "Gedung", "Air", "ATK", "Lainnya"];
const CHANNELS: BillingChannel[] = ["Tokopedia", "Shopee", "Blibli", "Website", "Tunai"];
const STATUSES: BillingStatus[] = ["Sudah Dibayar", "Belum Dibayar"];

const monthNames = [
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

function toNumber(value: unknown) {
  const raw = String(value ?? "").replace(/[^\d-]/g, "");
  return raw ? Number(raw) : NaN;
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

  const read = (field: keyof typeof aliases) => {
    const keys = aliases[field];
    const hit = keys.find((key) => raw[key] !== undefined);
    return hit ? raw[hit] : "";
  };

  const bulan = toNumber(read("bulan"));
  const tahun = toNumber(read("tahun"));
  const jumlah = toNumber(read("jumlah_tagihan"));
  const channelRaw = read("channel_pembayaran");
  const statusRaw = read("status_bayar");
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
    kategori: read("kategori"),
    deskripsi: read("deskripsi"),
    nomor_tagihan: read("nomor_tagihan"),
    jumlah_tagihan: jumlah,
    channel_pembayaran: channel,
    status_bayar: status,
  };

  const errors: string[] = [];
  const reviewReasons: string[] = [];

  if (!Number.isInteger(bulan) || bulan < 1 || bulan > 12) errors.push("bulan tidak valid");
  if (!Number.isInteger(tahun) || tahun < 1900 || tahun > 2100) errors.push("tahun tidak valid");
  if (!data.kategori) errors.push("kategori kosong");
  if (!data.deskripsi) errors.push("deskripsi kosong");
  if (!data.nomor_tagihan) errors.push("nomor tagihan kosong");
  if (!Number.isInteger(jumlah) || jumlah < 0) errors.push("jumlah tidak valid");
  if (!channel) reviewReasons.push("channel_pembayaran ambigu");
  if (!status) reviewReasons.push("status_bayar ambigu");

  return {
    rowNumber: index + 2,
    data,
    errors,
    reviewReasons,
    safe: errors.length === 0 && reviewReasons.length === 0,
  };
}

function parseImportFile(text: string, fileName: string): ImportPreviewRow[] {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "csv") {
    return parseCsv(text).map((row, index) => mapLegacyRow(row, index));
  }

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
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tagihan");
  return XLSX.write(wb, { bookType: "xlsx", type: "array" });
}

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [rows, setRows] = useState<BillingRow[]>([]);
  const [bulan, setBulan] = useState<string>("");
  const [tahun, setTahun] = useState<string>("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<Partial<BillingRow>>({
    bulan: new Date().getMonth() + 1,
    tahun: new Date().getFullYear(),
    kategori: "PLN",
    deskripsi: "",
    nomor_tagihan: "",
    jumlah_tagihan: 0,
    channel_pembayaran: "Website",
    status_bayar: "Belum Dibayar",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string>("");
  const [preview, setPreview] = useState<ImportPreviewRow[]>([]);

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
        ? [row.kategori, row.deskripsi, row.nomor_tagihan, row.channel_pembayaran, row.status_bayar]
            .join(" ")
            .toLowerCase()
            .includes(q)
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
    setForm({
      bulan: new Date().getMonth() + 1,
      tahun: new Date().getFullYear(),
      kategori: "PLN",
      deskripsi: "",
      nomor_tagihan: "",
      jumlah_tagihan: 0,
      channel_pembayaran: "Website",
      status_bayar: "Belum Dibayar",
    });
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

    setRows((current) =>
      editingId ? current.map((item) => (item.id === editingId ? payload : item)) : [payload, ...current],
    );
    setNotice(editingId ? "Tagihan diperbarui." : "Tagihan ditambahkan.");
    resetForm();
  }

  function editRow(row: BillingRow) {
    setEditingId(row.id);
    setForm(row);
  }

  function deleteRow(id: string) {
    setRows((current) => current.filter((item) => item.id !== id));
    setNotice("Tagihan dihapus.");
  }

  function handleImport(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const parsed = parseImportFile(text, file.name);
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
        setRows((current) => [...safeRows, ...current]);
        setNotice(`Import selesai. ${safeRows.length} baris aman ditambahkan. Baris ambigu tetap di review.`);
      } else {
        setNotice("Tidak ada baris aman untuk diimpor.");
      }
    };
    reader.readAsText(file);
  }

  async function exportPdf() {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text("SISTEM TAGIHAN OPERASIONAL SEKOLAH YAKIN", 14, 16);
    doc.setFontSize(10);
    doc.text(`Filter: ${bulan || "Semua bulan"} / ${tahun || "Semua tahun"} / ${search || "-"}`, 14, 24);
    doc.text(`Total baris: ${filteredRows.length} | Total nominal: ${formatCurrency(total)}`, 14, 30);
    let y = 40;
    filteredRows.forEach((row) => {
      const line = `${row.bulan}/${row.tahun} | ${row.kategori} | ${row.deskripsi} | ${row.nomor_tagihan} | ${formatCurrency(row.jumlah_tagihan)} | ${row.channel_pembayaran} | ${row.status_bayar}`;
      const lines = doc.splitTextToSize(line, 260);
      if (y > 180) {
        doc.addPage();
        y = 20;
      }
      doc.text(lines, 14, y);
      y += lines.length * 5 + 2;
    });
    doc.save("tagihan-yakin.pdf");
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#1d4ed8_0,_#0f172a_42%,_#030712_100%)] text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <section className="rounded-[2rem] border border-white/10 bg-white/8 p-8 shadow-2xl shadow-black/30 backdrop-blur">
          <p className="text-sm uppercase tracking-[0.3em] text-sky-200">Sistem Tagihan Operasional Sekolah YAKIN</p>
          <h1 className="mt-3 text-4xl font-black leading-tight md:text-6xl">CRUD, filter, summary, import/export, dan PDF siap cetak.</h1>
          <p className="mt-4 max-w-3xl text-base text-slate-200 md:text-lg">
            Semua data disimpan aman di browser via `localStorage`, cocok untuk deploy cepat ke Vercel tanpa backend tambahan.
          </p>
        </section>

        {notice ? <div className="mt-6 rounded-2xl border border-amber-300/40 bg-amber-400/15 p-4 text-amber-100">{notice}</div> : null}

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          <Card label="Data tampil" value={String(filteredRows.length)} />
          <Card label="Total nominal" value={formatCurrency(total)} />
          <Card label="Sudah dibayar" value={String(done)} />
          <Card label="Belum dibayar" value={String(pending)} />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-xl">
            <div className="flex flex-wrap gap-3">
              <select value={bulan} onChange={(e) => setBulan(e.target.value)} className="input">
                <option value="">Semua bulan</option>
                {monthNames.map((name, index) => (
                  <option key={name} value={index + 1}>{`${index + 1} - ${name}`}</option>
                ))}
              </select>
              <select value={tahun} onChange={(e) => setTahun(e.target.value)} className="input">
                <option value="">Semua tahun</option>
                {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() + 1].map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tagihan..." className="input flex-1 min-w-56" />
              <button className="btn" onClick={() => { setBulan(""); setTahun(""); setSearch(""); }}>Reset</button>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button className="btn btn-primary" onClick={submitForm}>{editingId ? "Simpan Perubahan" : "Tambah Tagihan"}</button>
              <button className="btn" onClick={resetForm}>Clear Form</button>
              <label className="btn cursor-pointer">
                Import Excel/CSV
                <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])} />
              </label>
              <button className="btn" onClick={() => {
                const blob = new Blob([exportCsv(filteredRows)], { type: "text/csv;charset=utf-8" });
                download("tagihan-yakin.csv", blob);
              }}>Export CSV</button>
              <button className="btn" onClick={() => {
                const data = exportXlsx(filteredRows);
                download("tagihan-yakin.xlsx", new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
              }}>Export Excel</button>
              <button className="btn" onClick={exportPdf}>Export PDF</button>
            </div>

            <div className="mt-6 overflow-auto rounded-2xl border border-white/10">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-white/5 text-xs uppercase tracking-[0.2em] text-slate-300">
                  <tr>
                    <th className="px-4 py-3">Bulan/Tahun</th>
                    <th className="px-4 py-3">Kategori</th>
                    <th className="px-4 py-3">Deskripsi</th>
                    <th className="px-4 py-3">Nomor</th>
                    <th className="px-4 py-3">Jumlah</th>
                    <th className="px-4 py-3">Channel</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.id} className="border-t border-white/10">
                      <td className="px-4 py-3">{`${row.bulan}/${row.tahun}`}</td>
                      <td className="px-4 py-3">{row.kategori}</td>
                      <td className="px-4 py-3">{row.deskripsi}</td>
                      <td className="px-4 py-3">{row.nomor_tagihan}</td>
                      <td className="px-4 py-3">{formatCurrency(row.jumlah_tagihan)}</td>
                      <td className="px-4 py-3">{row.channel_pembayaran}</td>
                      <td className="px-4 py-3">{row.status_bayar}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button className="btn" onClick={() => editRow(row)}>Edit</button>
                          <button className="btn" onClick={() => deleteRow(row.id)}>Hapus</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-xl">
              <h2 className="text-xl font-bold">Form Tagihan</h2>
              <div className="mt-4 grid gap-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <Input label="Bulan" type="number" value={String(form.bulan ?? "")} onChange={(v) => setForm({ ...form, bulan: Number(v) })} />
                  <Input label="Tahun" type="number" value={String(form.tahun ?? "")} onChange={(v) => setForm({ ...form, tahun: Number(v) })} />
                </div>
                <Input label="Kategori" value={String(form.kategori ?? "")} onChange={(v) => setForm({ ...form, kategori: v })} />
                <Input label="Deskripsi" value={String(form.deskripsi ?? "")} onChange={(v) => setForm({ ...form, deskripsi: v })} />
                <Input label="Nomor Tagihan" value={String(form.nomor_tagihan ?? "")} onChange={(v) => setForm({ ...form, nomor_tagihan: v })} />
                <Input label="Jumlah Tagihan" type="number" value={String(form.jumlah_tagihan ?? "")} onChange={(v) => setForm({ ...form, jumlah_tagihan: Number(v) })} />
                <div className="grid gap-3 md:grid-cols-2">
                  <Select label="Channel Pembayaran" value={String(form.channel_pembayaran ?? "")} onChange={(v) => setForm({ ...form, channel_pembayaran: v as BillingChannel })} options={CHANNELS} />
                  <Select label="Status Bayar" value={String(form.status_bayar ?? "")} onChange={(v) => setForm({ ...form, status_bayar: v as BillingStatus })} options={STATUSES} />
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-xl">
              <h2 className="text-xl font-bold">Total per kategori</h2>
              <div className="mt-4 space-y-3">
                {categories.length ? categories.map((item) => (
                  <div key={item.kategori} className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3">
                    <strong>{item.kategori}</strong>
                    <span>{formatCurrency(item.total)}</span>
                  </div>
                )) : <p className="text-slate-300">Belum ada data.</p>}
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-xl">
              <h2 className="text-xl font-bold">Preview Import</h2>
              <p className="mt-2 text-sm text-slate-300">Baris ambigu tidak otomatis dimasukkan. Mereka harus direview dulu.</p>
              <div className="mt-4 space-y-3">
                {preview.slice(0, 5).map((row) => (
                  <div key={row.rowNumber} className="rounded-2xl border border-white/10 p-3 text-sm">
                    <div className="font-semibold">Baris {row.rowNumber}</div>
                    <div className="text-slate-300">{row.safe ? "Aman untuk import" : row.reviewReasons.concat(row.errors).join(", ")}</div>
                  </div>
                ))}
                {!preview.length ? <p className="text-slate-300">Belum ada file di-preview.</p> : null}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur">
      <div className="text-xs uppercase tracking-[0.3em] text-sky-200">{label}</div>
      <div className="mt-2 text-3xl font-black text-white">{value}</div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="grid gap-2 text-sm text-slate-200">
      <span>{label}</span>
      <input className="input" type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="grid gap-2 text-sm text-slate-200">
      <span>{label}</span>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
