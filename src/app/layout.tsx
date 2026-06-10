import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sistem Tagihan Operasional Sekolah YAKIN",
  description: "Aplikasi tagihan baru untuk CRUD, filter, summary, import/export, dan PDF siap cetak.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
