"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { appMode } from "@/lib/backend";
import { emergencyDemoReset } from "@/lib/demo-store";

/**
 * 🚨 RESET DE EMERGÊNCIA DO MODO DEMO (rodapé)
 * Se o localStorage estiver corrompido/bloqueado, limpa os dados
 * (localStorage.clear() quando necessário), restaura a lista
 * padrão de anúncios do TrocaES e recarrega a página.
 */
export default function DemoResetFooter({ className = "" }: { className?: string }) {
  const [busy, setBusy] = useState(false);

  if (appMode() !== "demo") return null;

  const handleReset = () => {
    setBusy(true);
    try {
      emergencyDemoReset();
      toast.success("Dados de exemplo restaurados! Recarregando... 🧹");
    } catch {
      toast.error("Falha ao restaurar — recarregando do zero...");
    } finally {
      setBusy(false);
    }
    window.location.reload();
  };

  return (
    <button
      onClick={handleReset}
      disabled={busy}
      className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border-2 border-dashed border-purple-300 text-purple-700 text-xs font-semibold hover:bg-purple-50 transition-colors disabled:opacity-60 ${className}`}
    >
      <RefreshCw className={`w-4 h-4 ${busy ? "animate-spin" : ""}`} />
      Modo Demo · Restaurar dados de exemplo (reset de emergência)
    </button>
  );
}
