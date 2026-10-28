import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Nexo Assist", description: "Agent do service desk de TI da Nexo" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
