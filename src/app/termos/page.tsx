"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TermosTexto } from "@/components/legal/TermosConteudo";

export default function TermosPage() {
  return (
    <div className="min-h-screen bg-[#FAF9FB] pb-8">
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <Link
          href="/"
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </Link>
        <div>
          <h1 className="font-black text-gray-900 text-lg">
            Termos de Uso e Isenção de Responsabilidade
          </h1>
          <p className="text-xs text-gray-500">TrocaES</p>
        </div>
      </div>
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <TermosTexto />
        </div>
      </div>
    </div>
  );
}
