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
            <div className="flex-shrink-0 flex items-center gap-1.5 sm:gap-3">
              <Link
                href="/login"
                className="text-xs sm:text-sm font-bold text-purple-700 hover:text-purple-800 px-2 sm:px-3 py-1.5 sm:py-2"
              >
                Entrar
              </Link>
              <Link
                href="/cadastro"
                className="font-bold bg-purple-700 text-white rounded-2xl px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm hover:bg-purple-800 transition-colors whitespace-nowrap"
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
