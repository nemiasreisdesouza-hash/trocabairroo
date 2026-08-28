"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2, CheckCheck, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { timeAgo } from "@/lib/utils";
import AppLayout from "@/components/layout/AppLayout";
import * as backend from "@/lib/backend";
import type { DerivedNotification } from "@/lib/backend";
import toast from "react-hot-toast";

export default function NotificacoesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<DerivedNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifs = async () => {
    if (!user) return;
    try {
      const list = await backend.listNotifications(user.id);
      setNotifications(list);
      // [NOTIF] Ao abrir a aba, zera o badge do sino automaticamente - marca todas como lidas
      if (list.length > 0) {
        const unreadIds = list.filter(n => n.unread).map(n => n.id);
        if (unreadIds.length > 0) {
          backend.markNotificationsRead(user.id, unreadIds);
          // Atualiza local para refletir lidas instantaneamente
          setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
        }
      }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    fetchNotifs();
    // Se fechar a aba (unmount) também zera
    return () => {
      if (user) {
        try { backend.markAllNotificationsRead(user.id); } catch {}
      }
    };
  }, [user]);

  // Escuta realtime de notificações para atualizar badge em outras abas
  useEffect(() => {
    const handler = (e: any) => {
      const det = e?.detail || {};
      if (det.entity === 'notification') {
        fetchNotifs();
      }
    };
    window.addEventListener('trocabairro:store' as any, handler);
    return () => window.removeEventListener('trocabairro:store' as any, handler);
  }, [user]);

  const handleClearAll = () => {
    if (!user) return;
    if (!confirm(`Limpar todas as ${notifications.length} notificações? Você pode fazer isso, são suas notificações.`)) return;
    const allIds = notifications.map(n => n.id);
    backend.clearAllNotifications(user.id, allIds);
    setNotifications([]);
    toast.success("Notificações limpas! 🧹");
  };

  const handleClearOne = (id: string) => {
    if (!user) return;
    backend.clearNotification(user.id, id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    toast.success("Notificação removida");
  };

  const handleMarkAllRead = () => {
    if (!user) return;
    const ids = notifications.map(n => n.id);
    backend.markAllNotificationsRead(user.id, ids);
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
    toast.success("Todas marcadas como lidas ✓");
  };

  if (!user) return null;

  return (
    <AppLayout>
      <div className="px-4 py-4 max-w-2xl mx-auto w-full">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (user) backend.markAllNotificationsRead(user.id, notifications.map(n=>n.id));
                router.back();
              }}
              className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
              Notificações <span className="text-lg">🔔</span>
              {notifications.filter(n=>n.unread).length > 0 && (
                <span className="bg-purple-600 text-white text-xs font-black px-2 py-0.5 rounded-full">
                  {notifications.filter(n=>n.unread).length}
                </span>
              )}
            </h1>
          </div>
          {notifications.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleMarkAllRead}
                className="w-9 h-9 rounded-full bg-purple-50 hover:bg-purple-100 flex items-center justify-center"
                title="Marcar todas como lidas"
              >
                <CheckCheck className="w-5 h-5 text-purple-700" />
              </button>
              <button
                onClick={handleClearAll}
                className="w-9 h-9 rounded-full bg-red-50 hover:bg-red-100 flex items-center justify-center"
                title="Limpar todas - você tem permissão"
              >
                <Trash2 className="w-5 h-5 text-red-600" />
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-2/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🔔</div>
            <h3 className="font-bold text-gray-900 text-lg mb-2">
              Nenhuma notificação
            </h3>
            <p className="text-gray-500 text-sm mb-4">
              As novidades das suas trocas e planos aparecem aqui. Você limpou tudo! ✨
            </p>
            <Link
              href="/buscar"
              className="text-sm text-purple-700 font-semibold"
            >
              Explorar anúncios →
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 flex items-center justify-between">
              <p className="text-xs text-blue-800 font-medium">💡 Você pode limpar suas notificações quando quiser. São suas, da sua conta autenticada.</p>
            </div>
            {notifications.map((n) => {
              const isPlano = n.id.startsWith("n-sub-");
              if (isPlano) {
                const isConexao = n.titulo.includes("Conexão");
                const isExpansao = n.titulo.includes("Expansão");
                const gradient = isExpansao ? "from-amber-400 via-yellow-400 to-amber-500" : isConexao ? "from-violet-600 via-purple-600 to-indigo-600" : "from-green-500 via-emerald-500 to-teal-500";
                return (
                  <div
                    key={n.id}
                    className={`relative overflow-hidden rounded-[20px] p-[1.5px] bg-gradient-to-r ${gradient} shadow-md hover:shadow-lg transition-shadow group`}
                  >
                    <div className="bg-white rounded-[18px] p-4">
                      <button
                        onClick={() => handleClearOne(n.id)}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-gray-50 hover:bg-red-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remover esta notificação"
                      >
                        <X className="w-4 h-4 text-gray-400 hover:text-red-500" />
                      </button>
                      {n.unread && <span className="absolute top-3 right-10 w-2.5 h-2.5 bg-purple-600 rounded-full animate-pulse" />}
                      <Link href={n.link} className="flex gap-3 items-start">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 bg-gradient-to-br ${gradient} text-white shadow-sm`}>
                          {n.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-gray-900 text-[15px] leading-tight pr-6">{n.titulo}</p>
                          <p className="text-[13px] text-gray-700 leading-relaxed mt-1.5 whitespace-pre-wrap break-words">{n.mensagem}</p>
                          <p className="text-[11px] text-gray-400 mt-2 font-medium">{timeAgo(n.createdAt)} • Plano ativo</p>
                        </div>
                      </Link>
                    </div>
                  </div>
                );
              }
              return (
                <div key={n.id} className={`relative bg-white rounded-2xl p-4 shadow-sm flex gap-3 items-start hover:shadow-md transition-shadow group ${n.unread ? "border-l-4 border-purple-600" : ""}`}>
                  <button
                    onClick={() => handleClearOne(n.id)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-gray-50 hover:bg-red-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remover"
                  >
                    <X className="w-4 h-4 text-gray-400 hover:text-red-500" />
                  </button>
                  <Link href={n.link} className="flex gap-3 items-start flex-1 min-w-0">
                    <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center text-xl flex-shrink-0">
                      {n.icon}
                    </div>
                    <div className="flex-1 min-w-0 pr-6">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-900 text-sm">{n.titulo}</p>
                        {n.unread && (
                          <span className="w-2 h-2 bg-purple-600 rounded-full flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{n.mensagem}</p>
                      <p className="text-xs text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                  </Link>
                </div>
              );
            })}
            <button
              onClick={handleClearAll}
              className="mt-2 w-full py-3 rounded-2xl border-2 border-dashed border-gray-200 text-gray-500 font-bold text-sm hover:border-red-200 hover:text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Limpar todas as notificações ({notifications.length})
            </button>
            <p className="text-center text-[11px] text-gray-400">Você tem permissão total para gerenciar suas notificações na sua conta autenticada.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
