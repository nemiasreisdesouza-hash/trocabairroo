"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  FileText,
  Handshake,
  Star,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Shield,
  BadgeCheck,
  CreditCard,
  LayoutTemplate,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { timeAgo } from "@/lib/utils";
import toast from "react-hot-toast";
import CmsEditor from "@/components/admin/CmsEditor";
import * as backend from "@/lib/backend";
import type { AdminAd, AdminReview } from "@/lib/backend";
import type { UserAd } from "@/lib/backend";
import type {
  AdminStats,
  AuthUser,
  Subscription,
  Trade,
} from "@/lib/types";
import { TRADE_STATUS_LABEL } from "@/lib/types";
import { SUPER_ADMIN_EMAIL } from "@/lib/constants";

/** 👑 Conta Mestra do Proprietário */
const isMasterOwner = (email: string) =>
  email.toLowerCase() === SUPER_ADMIN_EMAIL;

type TabId =
  | "overview"
  | "users"
  | "ads"
  | "trades"
  | "reviews"
  | "subs"
  | "verified"
  | "cms";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Visão Geral" },
  { id: "users", label: "Usuários" },
  { id: "ads", label: "Anúncios" },
  { id: "trades", label: "Trocas" },
  { id: "reviews", label: "Avaliações" },
  { id: "subs", label: "Assinaturas" },
  { id: "verified", label: "Verificados" },
  { id: "cms", label: "CMS" },
];

export default function AdminPage() {
  const { user, demoMode } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [ads, setAds] = useState<AdminAd[]>([]);
  const [trades, setTrades] = useState<
    (Trade & { requesterNome: string; ownerNome: string })[]
  >([]);
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  // 🗑️ Exclusão de usuário
  const [deleteModal, setDeleteModal] = useState<AuthUser | null>(null);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [s, u, a, t, r, sub] = await Promise.all([
        backend.adminStats(),
        backend.adminListUsers(),
        backend.adminListAds(),
        backend.adminListTrades(),
        backend.adminListReviews(),
        backend.listSubscriptions(),
      ]);
      setStats(s);
      setUsers(u);
      setAds(a);
      setTrades(t);
      setReviews(r);
      setSubs(sub);
    } catch {
      toast.error("Erro ao carregar dados do painel");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      router.push("/login");
      return;
    }
    if (user.role !== "admin") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      router.push("/dashboard");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll();
  }, [user, router, fetchAll]);

  const handleToggleUser = async (userId: string, currentStatus: boolean) => {
    try {
      await backend.adminToggleUserActive(userId, !currentStatus);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, ativo: !currentStatus } : u))
      );
      toast.success(!currentStatus ? "Usuário reativado" : "Usuário suspenso");
    } catch {
      toast.error("Erro ao atualizar usuário");
    }
  };

  /**
   * 🗑️ EXCLUSÃO COMPLETA E PERMANENTE
   * Supabase → RPC SECURITY DEFINER delete_user_by_admin(target_user_id):
   * apaga auth.users + profiles + ads + trades + messages + reviews.
   * Demo → remoção equivalente no banco local.
   */
  const handleDeleteUser = async () => {
    if (!deleteModal || confirmEmail.trim().toLowerCase() !== deleteModal.email.toLowerCase())
      return;
    setDeleting(true);
    try {
      await backend.adminDeleteUser(deleteModal.id);
      setUsers((prev) => prev.filter((u) => u.id !== deleteModal.id));
      toast.success(`Usuário ${deleteModal.nome} excluído permanentemente 🗑️`);
      setDeleteModal(null);
      setConfirmEmail("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao excluir";
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  const handleSetVerified = async (userId: string, verificado: boolean) => {
    try {
      await backend.adminSetVerified(userId, verificado);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, verificado } : u))
      );
      toast.success(verificado ? "Usuário verificado ✓" : "Verificação removida");
    } catch {
      toast.error("Erro ao atualizar verificação");
    }
  };

  const handleAdStatus = async (adId: string, status: string) => {
    try {
      await backend.updateAdStatus(adId, status);
      setAds((prev) =>
        prev.map((a) => (a.id === adId ? { ...a, status } : a))
      );
      toast.success("Anúncio atualizado");
    } catch {
      toast.error("Erro ao atualizar anúncio");
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    try {
      await backend.adminDeleteReview(reviewId);
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
      toast.success("Avaliação removida");
    } catch {
      toast.error("Erro ao remover avaliação");
    }
  };

  const handleSubStatus = async (id: string, status: string) => {
    try {
      await backend.updateSubscriptionStatus(id, status);
      setSubs((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status } : s))
      );
      toast.success("Assinatura atualizada");
    } catch {
      toast.error("Erro ao atualizar assinatura");
    }
  };

  const handleResetDemo = async () => {
    try {
      backend.adminResetDemo();
      toast.success("Banco demo restaurado! Recarregando...");
      setTimeout(() => window.location.reload(), 800);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro";
      toast.error(message);
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

  const verifiedUsers = users.filter((u) => u.verificado);

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
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-yellow-400" />
            <h1 className="font-black text-white text-lg">Painel Admin</h1>
          </div>
          <p className="text-gray-400 text-xs">
            TrocaES{demoMode ? " · Modo Demo" : " · Supabase"}
          </p>
        </div>
        {demoMode && (
          <button
            onClick={handleResetDemo}
            className="flex items-center gap-1.5 text-xs font-semibold text-yellow-400 bg-white/10 px-3 py-2 rounded-xl"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reset demo
          </button>
        )}
      </div>

      {/* Tab navigation */}
      <div className="bg-white border-b border-gray-100 overflow-x-auto sticky top-0 z-20">
        <div className="flex max-w-lg mx-auto px-4">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
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
        {/* ─────────── VISÃO GERAL ─────────── */}
        {activeTab === "overview" && stats && (
          <>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { label: "Usuários", value: stats.users, icon: <Users className="w-5 h-5" />, color: "text-blue-600 bg-blue-100" },
                { label: "Anúncios", value: stats.ads, icon: <FileText className="w-5 h-5" />, color: "text-purple-600 bg-purple-100" },
                { label: "Trocas", value: stats.trades, icon: <Handshake className="w-5 h-5" />, color: "text-green-600 bg-green-100" },
                { label: "Avaliações", value: stats.reviews, icon: <Star className="w-5 h-5" />, color: "text-yellow-600 bg-yellow-100" },
                { label: "Assinaturas ativas", value: stats.subscriptions, icon: <CreditCard className="w-5 h-5" />, color: "text-red-600 bg-red-100" },
                { label: "Verificados", value: verifiedUsers.length, icon: <BadgeCheck className="w-5 h-5" />, color: "text-emerald-600 bg-emerald-100" },
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

            {(stats.pendingTrades > 0 || stats.awaitingReviews > 0) && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-4 flex items-center gap-3">
                <Handshake className="w-6 h-6 text-yellow-600 flex-shrink-0" />
                <div>
                  <p className="font-bold text-yellow-800">
                    {stats.pendingTrades} proposta(s) pendente(s) ·{" "}
                    {stats.awaitingReviews} aguardando avaliação
                  </p>
                  <p className="text-xs text-yellow-700">
                    Acompanhe na aba Trocas
                  </p>
                </div>
              </div>
            )}

            <h2 className="font-bold text-gray-900 mb-3">Usuários recentes</h2>
            <div className="flex flex-col gap-2 mb-6">
              {users.slice(0, 5).map((u) => (
                <div key={u.id} className="bg-white rounded-2xl p-3 shadow-sm flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="font-bold text-purple-700 text-sm">
                      {u.nome[0]}
                    </span>
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

        {/* ─────────── USUÁRIOS ─────────── */}
        {activeTab === "users" && (
          <div className="flex flex-col gap-3">
            {users.map((u) => (
              <div key={u.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-purple-700">{u.nome[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm flex items-center gap-1.5 flex-wrap">
                      {u.nome}
                      {isMasterOwner(u.email) ? (
                        <span className="inline-flex items-center font-bold text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-purple-950 border border-amber-300 shadow-sm">
                          👑 Dono / Fundador
                        </span>
                      ) : (
                        u.role === "admin" && (
                          <Badge variant="purple">👑 admin</Badge>
                        )
                      )}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    <p className="text-xs text-gray-400">
                      {u.bairro || "Sem bairro"} · {u.cidade}/{u.uf} ·{" "}
                      {timeAgo(u.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <Badge variant={u.ativo ? "green" : "red"}>
                      {u.ativo ? "Ativo" : "Suspenso"}
                    </Badge>
                    <span className="text-xs text-gray-400">
                      ⭐ {u.mediaAvaliacao.toFixed(1)} · {Math.round(u.aprovacao)}%
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <Link href={`/perfil/${u.id}`} className="flex-1">
                    <Button variant="outline" fullWidth size="sm">
                      Ver perfil
                    </Button>
                  </Link>
                  {isMasterOwner(u.email) ? (
                    <span
                      className="flex-1 text-center text-[10px] font-semibold text-gray-400 bg-gray-50 border border-gray-100 rounded-xl px-2 py-2 leading-snug"
                      title="Conta Mestra protegida por triggers no banco de dados"
                    >
                      🔒 Conta Mestra protegida
                    </span>
                  ) : (
                    <>
                      <Button
                        variant={u.ativo ? "danger" : "primary"}
                        size="sm"
                        className="flex-1"
                        onClick={() => handleToggleUser(u.id, u.ativo)}
                      >
                        {u.ativo ? "Suspender" : "Reativar"}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={u.role === "admin" || u.id === user.id}
                        title={
                          u.role === "admin" || u.id === user.id
                            ? "Não é permitido excluir administradores"
                            : "Exclusão completa e permanente (perfil, anúncios, trocas, chat e autenticação)"
                        }
                        onClick={() => {
                          setConfirmEmail("");
                          setDeleteModal(u);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ─────────── ANÚNCIOS ─────────── */}
        {activeTab === "ads" && (
          <div className="flex flex-col gap-3">
            {ads.map((ad) => (
              <div key={ad.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm truncate">
                      {ad.titulo}
                    </p>
                    <p className="text-xs text-gray-500">
                      {ad.userName} · {ad.categoria} · {ad.bairro}
                    </p>
                    <p className="text-xs text-gray-400">
                      {timeAgo(ad.createdAt)} · 👁 {ad.visualizacoes}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
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
                    {ad.topoFeed && <Badge variant="purple">🚀 Topo</Badge>}
                    {ad.destaque && <Badge variant="yellow">⭐ Destaque</Badge>}
                  </div>
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
                  {ad.status === "ativo" && (
                    <button
                      onClick={() => handleAdStatus(ad.id, "pausado")}
                      className="flex-1 py-2 text-xs font-semibold text-yellow-700 border-2 border-yellow-200 rounded-xl hover:bg-yellow-50 transition-colors"
                    >
                      Pausar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ─────────── TROCAS ─────────── */}
        {activeTab === "trades" && (
          <div className="flex flex-col gap-3">
            {trades.length === 0 && (
              <p className="text-center text-gray-500 text-sm py-8">
                Nenhuma troca ainda
              </p>
            )}
            {trades.map((t) => (
              <div key={t.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">
                      {t.adTitulo}
                    </p>
                    <p className="text-xs text-gray-500">
                      🙋 {t.requesterNome} ⇄ 📢 {t.ownerNome}
                    </p>
                    <p className="text-xs text-gray-400">{timeAgo(t.updatedAt)}</p>
                  </div>
                  <Badge
                    variant={
                      t.status === "finished"
                        ? "green"
                        : t.status === "rejected" || t.status === "cancelled"
                        ? "red"
                        : t.status === "awaiting_reviews"
                        ? "yellow"
                        : "purple"
                    }
                  >
                    {TRADE_STATUS_LABEL[t.status] ?? t.status}
                  </Badge>
                </div>
                <div className="flex gap-3 text-xs text-gray-400">
                  <span>
                    ✓ solicitante: {t.requesterCompleted ? "concluiu" : "—"}
                  </span>
                  <span>
                    ✓ dono: {t.ownerCompleted ? "concluiu" : "—"}
                  </span>
                  <span>
                    ⭐ aval: {t.requesterReviewed && t.ownerReviewed
                      ? "2/2"
                      : t.requesterReviewed || t.ownerReviewed
                      ? "1/2"
                      : "0/2"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ─────────── AVALIAÇÕES ─────────── */}
        {activeTab === "reviews" && (
          <div className="flex flex-col gap-3">
            {reviews.length === 0 && (
              <p className="text-center text-gray-500 text-sm py-8">
                Nenhuma avaliação ainda
              </p>
            )}
            {reviews.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900">
                      {"⭐".repeat(r.nota)}{"☆".repeat(5 - r.nota)}
                    </p>
                    <p className="text-xs text-gray-600">
                      {r.avaliadorNome} → {r.avaliadoNome}
                    </p>
                    {r.comentario && (
                      <p className="text-sm text-gray-500 mt-1 italic">
                        &quot;{r.comentario}&quot;
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {r.cumprimento === "sim"
                        ? "✓ cumpriu"
                        : r.cumprimento === "parcialmente"
                        ? "~ parcialmente"
                        : "✗ não cumpriu"}{" "}
                      · {timeAgo(r.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteReview(r.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-xl"
                    title="Remover avaliação"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ─────────── ASSINATURAS ─────────── */}
        {activeTab === "subs" && (
          <div className="flex flex-col gap-3">
            {subs.length === 0 && (
              <p className="text-center text-gray-500 text-sm py-8">
                Nenhuma assinatura/impulsionamento ainda
              </p>
            )}
            {subs.map((s) => (
              <div key={s.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900">
                      {s.plano === "conexao"
                        ? "🚀 Conexão"
                        : s.plano === "expansao"
                        ? "👑 Expansão"
                        : s.plano === "topo_feed"
                        ? "🚀 Topo do Feed"
                        : s.plano === "destaque"
                        ? "⭐ Selo Destaque"
                        : s.plano === "verificado"
                        ? "✅ Verificado"
                        : "🌱 Experimente"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {s.userName ?? s.userId.slice(0, 8)} · R$ {s.valor.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {timeAgo(s.createdAt)}
                      {s.expiresAt
                        ? ` · expira ${new Date(s.expiresAt).toLocaleDateString("pt-BR")}`
                        : ""}
                    </p>
                  </div>
                  <Badge
                    variant={
                      s.status === "ativo"
                        ? "green"
                        : s.status === "cancelado"
                        ? "red"
                        : "gray"
                    }
                  >
                    {s.status}
                  </Badge>
                </div>
                {s.status === "ativo" && (
                  <Button
                    variant="outline"
                    size="sm"
                    fullWidth
                    onClick={() => handleSubStatus(s.id, "cancelado")}
                  >
                    Cancelar assinatura
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ─────────── VERIFICADOS ─────────── */}
        {activeTab === "verified" && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-gray-500 bg-purple-50 border border-purple-100 rounded-2xl p-3">
              Conceda ou remova o selo <strong>✓ Verificado</strong>. A verificação
              manual nunca expira.
            </p>
            {users.map((u) => (
              <div
                key={u.id}
                className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3"
              >
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="font-bold text-purple-700">{u.nome[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-sm truncate">
                    {u.nome}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {u.email} · {u.bairro}
                  </p>
                </div>
                <Button
                  variant={u.verificado ? "danger" : "primary"}
                  size="sm"
                  onClick={() => handleSetVerified(u.id, !u.verificado)}
                >
                  {u.verificado ? (
                    <>
                      <XCircle className="w-4 h-4 inline mr-1" /> Remover selo
                    </>
                  ) : (
                    <>
                      <BadgeCheck className="w-4 h-4 inline mr-1" /> Verificar
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* ─────────── CMS ─────────── */}
        {activeTab === "cms" && (
          <div className="flex flex-col gap-4">
            <Link
              href="/admin/cms"
              className="bg-purple-50 border border-purple-200 rounded-2xl p-4 flex items-center gap-3"
            >
              <LayoutTemplate className="w-6 h-6 text-purple-700" />
              <div className="flex-1">
                <p className="font-bold text-purple-900 text-sm">
                  Abrir módulo completo do CMS
                </p>
                <p className="text-xs text-purple-600">
                  /admin/cms — editor em tela cheia
                </p>
              </div>
              <span className="text-purple-400">›</span>
            </Link>
            <CmsEditor />
          </div>
        )}
      </div>

      {/* 🗑️ MODAL · Confirmação de segurança para excluir usuário */}
      <Modal
        isOpen={!!deleteModal}
        onClose={() => {
          setDeleteModal(null);
          setConfirmEmail("");
        }}
        title="Excluir Usuário 🗑️"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-3 flex items-start gap-2.5">
            <span className="text-xl flex-shrink-0">⚠️</span>
            <p className="text-xs text-red-700 font-medium leading-relaxed">
              Ação <strong>completa e permanente</strong>. Serão apagados de{" "}
              <strong>{deleteModal?.nome}</strong>: conta de autenticação
              (auth.users), perfil, anúncios, trocas, mensagens do chat e
              avaliações vinculadas — via RPC{" "}
              <code className="bg-red-100 px-1 rounded">
                delete_user_by_admin
              </code>
              .
            </p>
          </div>

          <p className="text-sm text-gray-600">
            Para confirmar, digite o email do usuário:
          </p>
          <input
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            placeholder={deleteModal?.email ?? ""}
            className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-red-400"
          />

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteModal(null);
                setConfirmEmail("");
              }}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={deleting}
              disabled={
                confirmEmail.trim().toLowerCase() !==
                (deleteModal?.email ?? " ").toLowerCase()
              }
              onClick={handleDeleteUser}
              className="flex-1"
            >
              Excluir definitivamente
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
