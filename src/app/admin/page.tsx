"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  FileText,
  Handshake,
  Star,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Shield,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { timeAgo } from "@/lib/utils";
import toast from "react-hot-toast";

type AdminStats = {
  users: number;
  ads: number;
  interests: number;
  reviews: number;
  pendingReports: number;
};

type RecentUser = {
  id: string;
  nome: string;
  email: string;
  bairro: string | null;
  ativo: boolean;
  verificado: boolean;
  createdAt: string;
};

type RecentAd = {
  id: string;
  titulo: string;
  status: string;
  categoria: string;
  bairro: string;
  createdAt: string;
  userName: string;
};

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [recentAds, setRecentAds] = useState<RecentAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "ads" | "reports">("overview");

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (user.role !== "admin") {
      router.push("/dashboard");
      return;
    }
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/admin");
      if (!res.ok) throw new Error("Acesso negado");
      const data = await res.json();
      setStats(data.stats);
      setRecentUsers(data.recentUsers || []);
      setRecentAds(data.recentAds || []);
    } catch {
      toast.error("Erro ao carregar dados");
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUser = async (userId: string, currentStatus: boolean) => {
    try {
      await fetch(`/api/admin/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !currentStatus }),
      });

      setRecentUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, ativo: !currentStatus } : u))
      );

      toast.success(
        !currentStatus ? "Usuário reativado" : "Usuário suspenso"
      );
    } catch {
      toast.error("Erro ao atualizar usuário");
    }
  };

  const handleAdStatus = async (adId: string, status: string) => {
    try {
      await fetch(`/api/admin/ads/${adId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      setRecentAds((prev) =>
        prev.map((a) => (a.id === adId ? { ...a, status } : a))
      );

      toast.success("Anúncio atualizado");
    } catch {
      toast.error("Erro ao atualizar anúncio");
    }
  };

  if (!user || user.role !== "admin") return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9FB] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9FB] pb-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => router.push("/dashboard")}
          className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-yellow-400" />
            <h1 className="font-black text-white text-lg">Painel Admin</h1>
          </div>
          <p className="text-gray-400 text-xs">TrocaBairro</p>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="bg-white border-b border-gray-100 overflow-x-auto">
        <div className="flex max-w-lg mx-auto px-4">
          {[
            { id: "overview", label: "Visão Geral" },
            { id: "users", label: "Usuários" },
            { id: "ads", label: "Anúncios" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as "overview" | "users" | "ads" | "reports")}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-purple-600 text-purple-700"
                  : "border-transparent text-gray-500"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        {/* Overview Tab */}
        {activeTab === "overview" && stats && (
          <>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { label: "Usuários", value: stats.users, icon: <Users className="w-5 h-5" />, color: "text-blue-600 bg-blue-100" },
                { label: "Anúncios", value: stats.ads, icon: <FileText className="w-5 h-5" />, color: "text-purple-600 bg-purple-100" },
                { label: "Trocas", value: stats.interests, icon: <Handshake className="w-5 h-5" />, color: "text-green-600 bg-green-100" },
                { label: "Avaliações", value: stats.reviews, icon: <Star className="w-5 h-5" />, color: "text-yellow-600 bg-yellow-100" },
              ].map(({ label, value, icon, color }) => (
                <div key={label} className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${color}`}>
                    {icon}
                  </div>
                  <p className="text-2xl font-black text-gray-900">{value}</p>
                  <p className="text-sm text-gray-500">{label}</p>
                </div>
              ))}
            </div>

            {stats.pendingReports > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4 flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
                <div>
                  <p className="font-bold text-red-800">
                    {stats.pendingReports} denúncia{stats.pendingReports > 1 ? "s" : ""} pendente{stats.pendingReports > 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-red-600">Revise e tome as devidas ações</p>
                </div>
              </div>
            )}

            <h2 className="font-bold text-gray-900 mb-3">Usuários recentes</h2>
            <div className="flex flex-col gap-2 mb-6">
              {recentUsers.slice(0, 5).map((u) => (
                <div key={u.id} className="bg-white rounded-2xl p-3 shadow-sm flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="font-bold text-purple-700 text-sm">{u.nome[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{u.nome}</p>
                    <p className="text-xs text-gray-500 truncate">{u.email}</p>
                  </div>
                  <Badge variant={u.ativo ? "green" : "red"}>
                    {u.ativo ? "Ativo" : "Suspenso"}
                  </Badge>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Users Tab */}
        {activeTab === "users" && (
          <div className="flex flex-col gap-3">
            {recentUsers.map((u) => (
              <div key={u.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-purple-700">{u.nome[0]}</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-900">{u.nome}</p>
                    <p className="text-xs text-gray-500">{u.email}</p>
                    <p className="text-xs text-gray-400">{u.bairro || "Sem bairro"} · {timeAgo(u.createdAt)}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Badge variant={u.ativo ? "green" : "red"}>
                      {u.ativo ? "Ativo" : "Suspenso"}
                    </Badge>
                    {u.verificado && <Badge variant="blue">✓ Verificado</Badge>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link href={`/perfil/${u.id}`} className="flex-1">
                    <Button variant="outline" fullWidth size="sm">
                      Ver perfil
                    </Button>
                  </Link>
                  <Button
                    variant={u.ativo ? "danger" : "primary"}
                    size="sm"
                    className="flex-1"
                    onClick={() => handleToggleUser(u.id, u.ativo)}
                  >
                    {u.ativo ? "Suspender" : "Reativar"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Ads Tab */}
        {activeTab === "ads" && (
          <div className="flex flex-col gap-3">
            {recentAds.map((ad) => (
              <div key={ad.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="font-bold text-gray-900 text-sm">{ad.titulo}</p>
                    <p className="text-xs text-gray-500">{ad.userName} · {ad.categoria} · {ad.bairro}</p>
                    <p className="text-xs text-gray-400">{timeAgo(ad.createdAt)}</p>
                  </div>
                  <Badge
                    variant={
                      ad.status === "ativo"
                        ? "green"
                        : ad.status === "rejeitado"
                        ? "red"
                        : "gray"
                    }
                  >
                    {ad.status}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Link href={`/anuncio/${ad.id}`} className="flex-1">
                    <Button variant="outline" fullWidth size="sm">
                      Ver
                    </Button>
                  </Link>
                  {ad.status !== "rejeitado" && (
                    <button
                      onClick={() => handleAdStatus(ad.id, "rejeitado")}
                      className="flex-1 py-2 text-xs font-semibold text-red-600 border-2 border-red-200 rounded-xl hover:bg-red-50 transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5 inline mr-1" />
                      Rejeitar
                    </button>
                  )}
                  {ad.status !== "ativo" && (
                    <button
                      onClick={() => handleAdStatus(ad.id, "ativo")}
                      className="flex-1 py-2 text-xs font-semibold text-green-700 border-2 border-green-200 rounded-xl hover:bg-green-50 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                      Aprovar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
