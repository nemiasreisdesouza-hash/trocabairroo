"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Edit3,
  Trash2,
  Pause,
  Play,
  Eye,
  Star,
  TrendingUp,
  Bell,
  LogOut,
  Handshake,
  ChevronRight,
  MoreVertical,
  Settings,
} from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useAuth } from "@/contexts/AuthContext";
import { timeAgo } from "@/lib/utils";
import toast from "react-hot-toast";
import AppLayout from "@/components/layout/AppLayout";

type MyAd = {
  id: string;
  tipo: string;
  titulo: string;
  categoria: string;
  status: string;
  visualizacoes: number;
  destaque: boolean;
  topoFeed: boolean;
  createdAt: string;
  images: string[];
};

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [myAds, setMyAds] = useState<MyAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    fetchMyAds();
  }, [user]);

  const fetchMyAds = async () => {
    try {
      const res = await fetch("/api/users/me/ads");
      const data = await res.json();
      setMyAds(data.ads || []);
    } catch {
      toast.error("Erro ao carregar anúncios");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (adId: string, currentStatus: string) => {
    setActionLoading(adId);
    try {
      const newStatus = currentStatus === "ativo" ? "pausado" : "ativo";
      const res = await fetch(`/api/ads/${adId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error("Erro ao atualizar");

      setMyAds((prev) =>
        prev.map((ad) => (ad.id === adId ? { ...ad, status: newStatus } : ad))
      );

      toast.success(
        newStatus === "ativo" ? "Anúncio reativado! ✅" : "Anúncio pausado"
      );
    } catch {
      toast.error("Erro ao atualizar anúncio");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (adId: string) => {
    setActionLoading(adId);
    try {
      const res = await fetch(`/api/ads/${adId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao excluir");

      setMyAds((prev) => prev.filter((ad) => ad.id !== adId));
      setDeleteModal(null);
      toast.success("Anúncio excluído");
    } catch {
      toast.error("Erro ao excluir anúncio");
    } finally {
      setActionLoading(null);
    }
  };

  if (!user) return null;

  const activeAds = myAds.filter((a) => a.status === "ativo").length;
  const totalViews = myAds.reduce((acc, a) => acc + (a.visualizacoes || 0), 0);

  return (
    <AppLayout>
      <div className="px-4 py-4">
        {/* User card */}
        <div className="bg-gradient-to-br from-purple-700 to-purple-900 rounded-2xl p-5 mb-4 text-white">
          <div className="flex items-center gap-3 mb-4">
            <Link href={`/perfil/${user.id}`}>
              <Avatar src={user.avatarUrl} name={user.nome} size="lg" />
            </Link>
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <p className="font-black text-lg">{user.nome}</p>
                {user.verificado && (
                  <span className="text-blue-300 text-xs">✓</span>
                )}
              </div>
              <p className="text-purple-200 text-sm">{user.email}</p>
              {user.bairro && (
                <p className="text-purple-300 text-xs">📍 {user.bairro}</p>
              )}
            </div>
            <button
              onClick={logout}
              className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center"
            >
              <LogOut className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/15 rounded-xl p-3 text-center">
              <p className="text-xl font-black">{activeAds}</p>
              <p className="text-xs text-purple-200">Anúncios</p>
            </div>
            <div className="bg-white/15 rounded-xl p-3 text-center">
              <p className="text-xl font-black">{totalViews}</p>
              <p className="text-xs text-purple-200">Visualizações</p>
            </div>
            <div className="bg-white/15 rounded-xl p-3 text-center">
              <p className="text-xl font-black">
                {(user as unknown as { mediaAvaliacao?: number }).mediaAvaliacao?.toFixed(1) || "—"}
              </p>
              <p className="text-xs text-purple-200">Avaliação</p>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Link href="/anuncio/criar">
            <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                <Plus className="w-5 h-5 text-purple-700" />
              </div>
              <p className="text-xs font-semibold text-gray-800">Novo anúncio</p>
            </div>
          </Link>
          <Link href="/interesses">
            <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                <Handshake className="w-5 h-5 text-green-700" />
              </div>
              <p className="text-xs font-semibold text-gray-800">Interesses</p>
            </div>
          </Link>
          <Link href="/notificacoes">
            <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
              <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                <Bell className="w-5 h-5 text-yellow-700" />
              </div>
              <p className="text-xs font-semibold text-gray-800">Notificações</p>
            </div>
          </Link>
        </div>

        {/* Action links */}
        <div className="bg-white rounded-2xl shadow-sm mb-6 overflow-hidden">
          {[
            { href: `/perfil/${user.id}`, icon: <Eye className="w-5 h-5 text-purple-600" />, label: "Ver meu perfil" },
            { href: "/perfil/editar", icon: <Edit3 className="w-5 h-5 text-blue-600" />, label: "Editar perfil" },
            { href: "/impulsionar", icon: <TrendingUp className="w-5 h-5 text-yellow-600" />, label: "Impulsionar anúncio" },
            ...(user.role === "admin" ? [{ href: "/admin", icon: <Settings className="w-5 h-5 text-red-600" />, label: "Painel Admin" }] : []),
          ].map(({ href, icon, label }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-4 py-4 border-b border-gray-50 last:border-0 active:bg-gray-50"
            >
              <div className="w-9 h-9 bg-gray-50 rounded-xl flex items-center justify-center">
                {icon}
              </div>
              <span className="font-semibold text-gray-800 flex-1">{label}</span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </Link>
          ))}
        </div>

        {/* My Ads */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-black text-gray-900">Meus anúncios</h2>
          <Link
            href="/anuncio/criar"
            className="text-sm text-purple-700 font-semibold"
          >
            + Novo
          </Link>
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : myAds.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl shadow-sm">
            <div className="text-5xl mb-3">📭</div>
            <h3 className="font-bold text-gray-900 mb-1">Nenhum anúncio ainda</h3>
            <p className="text-gray-500 text-sm mb-4">
              Publique seu primeiro anúncio e comece a trocar!
            </p>
            <Link href="/anuncio/criar">
              <Button size="sm">Publicar agora</Button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {myAds.map((ad) => (
              <div key={ad.id} className="bg-white rounded-2xl overflow-hidden shadow-sm">
                <div className="flex items-center gap-3 p-3">
                  {ad.images?.[0] ? (
                    <img
                      src={ad.images[0]}
                      alt={ad.titulo}
                      className="w-16 h-16 object-cover rounded-xl flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-2xl">📦</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span
                        className={`text-xs font-bold ${
                          ad.tipo === "ofereço" ? "text-purple-700" : "text-blue-600"
                        }`}
                      >
                        {ad.tipo === "ofereço" ? "OFEREÇO" : "PRECISO"}
                      </span>
                      <Badge
                        variant={
                          ad.status === "ativo"
                            ? "green"
                            : ad.status === "pausado"
                            ? "yellow"
                            : "gray"
                        }
                      >
                        {ad.status}
                      </Badge>
                    </div>
                    <p className="font-semibold text-gray-900 text-sm truncate">
                      {ad.titulo}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span className="flex items-center gap-0.5">
                        <Eye className="w-3 h-3" /> {ad.visualizacoes || 0}
                      </span>
                      <span>{timeAgo(ad.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Ad actions */}
                <div className="flex border-t border-gray-50">
                  <Link
                    href={`/anuncio/${ad.id}`}
                    className="flex-1 py-3 text-xs font-semibold text-center text-gray-600 flex items-center justify-center gap-1 hover:bg-gray-50"
                  >
                    <Eye className="w-3.5 h-3.5" /> Ver
                  </Link>
                  <Link
                    href={`/anuncio/editar/${ad.id}`}
                    className="flex-1 py-3 text-xs font-semibold text-center text-blue-600 flex items-center justify-center gap-1 hover:bg-blue-50"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Editar
                  </Link>
                  <button
                    onClick={() => handleToggleStatus(ad.id, ad.status)}
                    disabled={actionLoading === ad.id}
                    className="flex-1 py-3 text-xs font-semibold text-center text-yellow-700 flex items-center justify-center gap-1 hover:bg-yellow-50"
                  >
                    {ad.status === "ativo" ? (
                      <>
                        <Pause className="w-3.5 h-3.5" /> Pausar
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" /> Ativar
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setDeleteModal(ad.id)}
                    className="flex-1 py-3 text-xs font-semibold text-center text-red-600 flex items-center justify-center gap-1 hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        title="Excluir anúncio?"
        size="sm"
      >
        <p className="text-gray-600 mb-4">
          Tem certeza? Esta ação não pode ser desfeita.
        </p>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setDeleteModal(null)}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={() => deleteModal && handleDelete(deleteModal)}
            loading={!!actionLoading}
            className="flex-1"
          >
            Excluir
          </Button>
        </div>
      </Modal>
    </AppLayout>
  );
}
