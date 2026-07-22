import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pizza & Totó — Gestión de Sucursales",
  description: "Checklists, capacitación y constancias por sucursal",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
