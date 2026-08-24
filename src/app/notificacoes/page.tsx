"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { timeAgo } from "@/lib/utils";
import AppLayout from "@/components/layout/AppLayout";
import * as backend from "@/lib/backend";
import type { DerivedNotification } from "@/lib/backend";

export default function NotificacoesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<DerivedNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    backend
      .listNotifications(user.id)
      .then(setNotifications)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

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
          <h1 className="text-xl font-black text-gray-900">Notificações 🔔</h1>
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
              As novidades das suas trocas aparecem aqui
            </p>
            <Link
              href="/buscar"
              className="text-sm text-purple-700 font-semibold"
            >
              Explorar anúncios →
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {notifications.map((n) => (
              <Link
                key={n.id}
                href={n.link}
                className={`bg-white rounded-2xl p-4 shadow-sm flex gap-3 items-start ${
                  n.unread ? "border-l-4 border-purple-600" : ""
                }`}
              >
                <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center text-xl flex-shrink-0">
                  {n.icon}
                </div>
                <div className="flex-1 min-w-0">
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
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
