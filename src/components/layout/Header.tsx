"use client";

import Link from "next/link";
import { Bell, Menu } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Avatar from "@/components/ui/Avatar";
import { useState, useEffect } from "react";

export default function Header() {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchNotifications = async () => {
      try {
        const res = await fetch("/api/notifications");
        if (res.ok) {
          const data = await res.json();
          setUnread(data.unread || 0);
        }
      } catch {}
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [user]);

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-purple-700 rounded-xl flex items-center justify-center">
            <span className="text-white text-sm font-black">TB</span>
          </div>
          <span className="font-black text-purple-700 text-lg tracking-tight">
            Troca<span className="text-yellow-500">Bairro</span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
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
            <div className="flex gap-2">
              <Link
                href="/login"
                className="text-sm font-semibold text-purple-700 hover:text-purple-800 px-3 py-2"
              >
                Entrar
              </Link>
              <Link
                href="/cadastro"
                className="text-sm font-semibold bg-purple-700 text-white rounded-2xl px-4 py-2 hover:bg-purple-800 transition-colors"
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
