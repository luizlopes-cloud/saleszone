import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Squad Dashboard - Seazone",
  description: "Acompanhamento de vendas por squads",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
