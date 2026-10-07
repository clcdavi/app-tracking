import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Enfoco · Tu día, con intención",
  description: "Tus prioridades, un plan posible y seguimiento de lo importante.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
