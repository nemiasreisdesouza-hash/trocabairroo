"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { timeAgo } from "@/lib/utils";
import AppLayout from "@/components/layout/AppLayout";
import toast from "react-hot-toast";

type Notification = {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: string | null;
  visualizada: boolean;
  link: string | null;
  createdAt: string;
};

const tipoIcons: Record<string, string> = {
  interesse: "🤝",
  avaliacao: "⭐",
  aprovacao: "✅",
  rejeicao: "❌",
  pagamento: "🚀",
  boas_vindas: "🎉",
};

export default function NotificacoesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    fetchNotifications();
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      setNotifications(data.notifications || []);

      // Mark all as read
      await fetch("/api/notifications", { method: "PUT" });
    } catch {
      toast.error("Erro ao carregar notificações");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <AppLayout>
      <div className="px-4 py-4">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-xl font-black text-gray-900">Notificações</h1>
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded mb-2 w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-full" />
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <h3 className="font-bold text-gray-900 text-lg mb-2">
              Tudo limpo por aqui!
            </h3>
            <p className="text-gray-500 text-sm">
              Quando alguém demonstrar interesse no seu anúncio, você será notificado.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {notifications.map((notification) => {
              const content = (
                <div
                  className={`rounded-2xl p-4 flex items-start gap-3 transition-colors ${
                    !notification.visualizada
                      ? "bg-purple-50 border border-purple-100"
                      : "bg-white"
                  }`}
                >
                  <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0 text-xl">
                    {tipoIcons[notification.tipo || ""] || "🔔"}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-gray-900 text-sm">
                        {notification.titulo}
                      </p>
                      {!notification.visualizada && (
                        <div className="w-2 h-2 bg-purple-600 rounded-full flex-shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed mt-0.5">
                      {notification.mensagem}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {timeAgo(notification.createdAt)}
                    </p>
                  </div>
                </div>
              );

              return notification.link ? (
                <Link key={notification.id} href={notification.link}>
                  {content}
                </Link>
              ) : (
                <div key={notification.id}>{content}</div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
