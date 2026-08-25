import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import Toast from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "TrocaES — Troque Serviços no Espírito Santo",
  description:
    "Plataforma de troca de serviços e conexão comunitária no ES.",
  keywords: ["troca", "serviços", "permuta", "comunidade", "espirito santo", "vitoria", "serra", "vila velha"],
  authors: [{ name: "TrocaES" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TrocaES",
  },
  openGraph: {
    title: "TrocaES — Troque Serviços no Espírito Santo",
    description:
      "Plataforma de troca de serviços e conexão comunitária no ES.",
    type: "website",
    locale: "pt_BR",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#5B2C6F",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Favicon oficial: src/app/icon.svg (roxo com setas TrocaES) */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="bg-[#FAF9FB] text-gray-900 antialiased">
        <AuthProvider>
          {children}
          <Toast />
        </AuthProvider>
      </body>
    </html>
  );
}
