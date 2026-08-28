"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, MessageCircleQuestion } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import UserHeaderMenu from "@/components/layout/UserHeaderMenu";
import HelpChatDrawer from "@/components/HelpChatDrawer";
import * as backend from "@/lib/backend";

export default function HeaderActions() {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpBadge, setHelpBadge] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchNotifications = async () => {
      try {
        const count = await backend.getUnreadCount(user.id);
        setUnread(count);
      } catch {}
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    // Badge de ajuda para novo usuário
    try {
      const seen = localStorage.getItem("trocaes_help_seen");
      if (!seen) setHelpBadge(true);
      const handler = () => {
        const s = localStorage.getItem("trocaes_help_seen");
        if (s) setHelpBadge(false);
      };
      window.addEventListener("storage", handler);
      return () => window.removeEventListener("storage", handler);
    } catch {}
  }, []);

  const openHelp = () => {
    setHelpOpen(true);
    setHelpBadge(false);
    try {
      localStorage.setItem("trocaes_help_seen", "1");
    } catch {}
  };

  if (!user) {
    return (
      <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0 ml-auto">
        <Link
          href="/login"
          className="text-purple-700 hover:text-purple-900 font-bold text-xs sm:text-sm px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl transition-all whitespace-nowrap flex-shrink-0"
        >
          Entrar
        </Link>
        <Link
          href="/cadastro"
          className="bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold transition-all shadow-sm px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm rounded-xl sm:rounded-2xl whitespace-nowrap flex-shrink-0"
        >
          Cadastrar
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        <Link
          href="/notificacoes"
          className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Notificações"
        >
          <Bell className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-violet-600" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold border-2 border-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>

        <button
          onClick={openHelp}
          className="relative p-2 rounded-full hover:bg-violet-50 transition-colors"
          aria-label="Central de Ajuda"
        >
          <MessageCircleQuestion className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-violet-600" />
          {helpBadge && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold border-2 border-white">
              1
            </span>
          )}
        </button>

        <UserHeaderMenu />
      </div>

      <HelpChatDrawer isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
