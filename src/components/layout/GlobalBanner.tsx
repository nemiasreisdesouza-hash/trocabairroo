"use client";

import { useEffect, useState } from "react";
import { X, Megaphone, AlertTriangle, Info } from "lucide-react";
import * as backend from "@/lib/backend";

export default function GlobalBanner() {
  const [message, setMessage] = useState<string>("");
  const [type, setType] = useState<string>("info");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const content = await backend.getSiteContent();
        const msg = content["global.banner.message"]?.trim() || "";
        const t = content["global.banner.type"]?.trim() || "info";
        if (msg) {
          setMessage(msg);
          setType(t);
          // Verifica se foi dispensado nesta sessão
          const dismissedKey = `trocabairro:banner:dismissed:${msg.slice(0,20)}`;
          if (typeof window !== "undefined" && sessionStorage.getItem(dismissedKey)) {
            setDismissed(true);
          }
        }
      } catch {
        /* noop */
      }
    };
    load();
  }, []);

  if (!message || dismissed) return null;

  const bgColor =
    type === "error"
      ? "bg-red-600"
      : type === "warning"
      ? "bg-yellow-500"
      : "bg-purple-700";

  const Icon = type === "error" ? AlertTriangle : type === "warning" ? AlertTriangle : Megaphone;

  const handleDismiss = () => {
    try {
      const dismissedKey = `trocabairro:banner:dismissed:${message.slice(0,20)}`;
      sessionStorage.setItem(dismissedKey, "1");
    } catch {}
    setDismissed(true);
  };

  return (
    <div className={`${bgColor} text-white px-4 py-2.5 flex items-center gap-3 text-sm font-medium sticky top-0 z-50`}>
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1">{message}</span>
      <button
        onClick={handleDismiss}
        className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors flex-shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
