import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import Toast from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "TrocaBairro - Troque serviços com gente do seu bairro",
  description:
    "Plataforma de permuta de serviços entre pequenos empreendedores e criadores de conteúdo do mesmo bairro. Sem dinheiro, apenas confiança e parcerias.",
  keywords: ["troca", "bairro", "serviços", "permuta", "comunidade", "vitoria", "espirito santo"],
  authors: [{ name: "TrocaBairro" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TrocaBairro",
  },
  openGraph: {
    title: "TrocaBairro - Troque serviços com gente do seu bairro",
    description: "Sem dinheiro. Apenas confiança, parcerias e oportunidades.",
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
        <link rel="icon" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
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
