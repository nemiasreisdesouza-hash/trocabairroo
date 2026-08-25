"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Avatar from "@/components/ui/Avatar";
import Logo from "@/components/Logo";
import { useState, useEffect } from "react";
import * as backend from "@/lib/backend";

export default function Header() {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

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

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-100 shadow-sm">
      <div className="w-full max-w-7xl mx-auto px-2.5 sm:px-6 flex items-center justify-between h-16 overflow-hidden">
        <Link href="/" aria-label="TrocaES — início">
          <Logo size="sm" />
        </Link>

        <div className="flex-shrink-0 flex items-center gap-2 sm:gap-3">
          {user ? (
            <>
              <Link
                href="/notificacoes"
                className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <Bell className="w-6 h-6 text-gray-600" />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
              <Link href={`/perfil/${user.id}`}>
                <Avatar src={user.avatarUrl} name={user.nome} size="sm" />
              </Link>
            </>
          ) : (
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
          )}
        </div>
      </div>
    </header>
  );
}
