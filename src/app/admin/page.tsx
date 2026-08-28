"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
  Search,
  AlertTriangle,
  Flag,
  Ban,
  EyeOff,
  DollarSign,
  CalendarDays,
  Megaphone,
  ShieldAlert,
  Lock,
  Activity,
  Bug,
  Skull,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { timeAgo } from "@/lib/utils";
import toast from "react-hot-toast";
import CmsEditor from "@/components/admin/CmsEditor";
import VerifiedBadge from "@/components/ui/VerifiedBadge";
import * as backend from "@/lib/backend";
import type { AdminAd, AdminReview, Report } from "@/lib/backend";
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
  | "denuncias"
  | "trades"
  | "reviews"
  | "subs"
  | "verified"
  | "cms";

const TABS: { id: TabId; label: string; icon?: string }[] = [
  { id: "overview", label: "Visão Geral" },
  { id: "users", label: "Usuários" },
  { id: "ads", label: "Anúncios" },
  { id: "denuncias", label: "Denúncias" },
  { id: "trades", label: "Trocas" },
  { id: "reviews", label: "Avaliações" },
  { id: "subs", label: "Assinaturas" },
  { id: "verified", label: "Verificados" },
  { id: "cms", label: "CMS" },
];

type SecLog = {
  ts: string;
  type: string;
  severity: string;
  [k: string]: any;
};

function anonymizeLog(log: SecLog) {
  // [SEC-FIX] Anonimiza IP/email para exibição no painel
  const copy: any = { ...log };
  if (copy.ip) copy.ip = String(copy.ip).slice(0, 6) + "***";
  if (copy.email) copy.email = String(copy.email).slice(0, 3) + "***";
  if (copy.identifier) copy.identifier = String(copy.identifier).slice(0, 8) + "***";
  return copy;
}

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
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  // Busca e Filtros
  const [userSearch, setUserSearch] = useState("");
  const [userStatusFilter, setUserStatusFilter] = useState<"todos" | "ativos" | "suspensos">("todos");
  const [adSearch, setAdSearch] = useState("");
  const [adStatusFilter, setAdStatusFilter] = useState<"todos" | "ativo" | "pausado" | "rejeitado" | "arquivado">("todos");

  // Segurança
  const [secLogs, setSecLogs] = useState<SecLog[]>([]);
  const [emergencyLockdown, setEmergencyLockdown] = useState(false);

  // Financeiro
  const [bannerMessage, setBannerMessage] = useState("");
  const [bannerType, setBannerType] = useState("info");
  const [bannerSaving, setBannerSaving] = useState(false);

  // 🗑️ Exclusão de usuário
  const [deleteModal, setDeleteModal] = useState<AuthUser | null>(null);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [s, u, a, t, r, sub, rep, content] = await Promise.all([
        backend.adminStats(),
        backend.adminListUsers(),
        backend.adminListAds(),
        backend.adminListTrades(),
        backend.adminListReviews(),
        backend.listSubscriptions(),
        backend.listReports(),
        backend.getSiteContent(),
      ]);
      setStats(s);
      setUsers(u);
      setAds(a);
      setTrades(t);
      setReviews(r);
      setSubs(sub);
      setReports(rep);
      setBannerMessage(content["global.banner.message"] || "");
      setBannerType(content["global.banner.type"] || "info");

      // Security logs
      try {
        const raw = typeof window !== "undefined" ? localStorage.getItem("trocabairro:sec-logs") : null;
        if (raw) {
          const logs = JSON.parse(raw) as SecLog[];
          setSecLogs(logs.slice(-30).reverse());
        }
        const lock = typeof window !== "undefined" ? localStorage.getItem("trocabairro:emergency_lockdown") : null;
        setEmergencyLockdown(lock === "true");
      } catch {}
    } catch {
      toast.error("Erro ao carregar dados do painel");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (user.role !== "admin") {
      router.push("/dashboard");
      return;
    }
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

  const handleSetPartner = async (userId: string, isPartner: boolean) => {
    try {
      await backend.adminSetPartner(userId, isPartner);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isPartner } as any : u))
      );
      toast.success(isPartner ? "Parceiro concedido ⭐ ouro" : "Parceiro removido");
    } catch {
      toast.error("Erro ao atualizar parceiro");
    }
  };;


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

  // Denúncias actions
  const handleDiscardReport = async (id: string) => {
    try {
      await backend.updateReportStatus(id, "descartada");
      setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status: "descartada" as const } : r)));
      toast.success("Denúncia descartada");
    } catch {
      toast.error("Erro ao descartar denúncia");
    }
  };

  const handlePauseAdFromReport = async (report: Report) => {
    try {
      await backend.updateAdStatus(report.adId, "pausado");
      setAds((prev) => prev.map((a) => (a.id === report.adId ? { ...a, status: "pausado" } : a)));
      await backend.updateReportStatus(report.id, "resolvida");
      setReports((prev) => prev.map((r) => (r.id === report.id ? { ...r, status: "resolvida" as const } : r)));
      toast.success("Anúncio pausado e denúncia resolvida");
    } catch {
      toast.error("Erro ao pausar anúncio");
    }
  };

  const handleSuspendUserFromReport = async (report: Report) => {
    if (!report.adUserId) {
      toast.error("Usuário do anúncio não identificado");
      return;
    }
    try {
      await backend.adminToggleUserActive(report.adUserId, false);
      setUsers((prev) => prev.map((u) => (u.id === report.adUserId ? { ...u, ativo: false } : u)));
      await backend.updateReportStatus(report.id, "resolvida");
      setReports((prev) => prev.map((r) => (r.id === report.id ? { ...r, status: "resolvida" as const } : r)));
      toast.success("Usuário suspenso e denúncia resolvida");
    } catch {
      toast.error("Erro ao suspender usuário");
    }
  };

  // Toggle Kill Switch
  const handleToggleLockdown = () => {
    const newVal = !emergencyLockdown;
    setEmergencyLockdown(newVal);
    try {
      localStorage.setItem("trocabairro:emergency_lockdown", String(newVal));
      // Loga no sec log
      const raw = localStorage.getItem("trocabairro:sec-logs");
      const logs = raw ? JSON.parse(raw) : [];
      logs.push({
        ts: new Date().toISOString(),
        type: newVal ? "kill_switch_activated" : "kill_switch_deactivated",
        severity: "critical",
        action: newVal ? "lockdown_on" : "lockdown_off",
      });
      localStorage.setItem("trocabairro:sec-logs", JSON.stringify(logs.slice(-100)));
      setSecLogs(logs.slice(-30).reverse());
    } catch {}
    toast.success(newVal ? "🔒 EMERGENCY LOCKDOWN ATIVADO" : "🔓 Lockdown desativado");
  };

  // Banner global save
  const handleSaveBanner = async () => {
    setBannerSaving(true);
    try {
      await backend.saveSiteContent({
        "global.banner.message": bannerMessage.trim(),
        "global.banner.type": bannerType.trim() || "info",
      });
      toast.success(bannerMessage.trim() ? "Banner global ativado 📢" : "Banner global removido");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar banner");
    } finally {
      setBannerSaving(false);
    }
  };

  // Filtros computados
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const search = userSearch.toLowerCase().trim();
      const matchesSearch =
        !search ||
        u.nome.toLowerCase().includes(search) ||
        u.email.toLowerCase().includes(search);
      const matchesStatus =
        userStatusFilter === "todos" ||
        (userStatusFilter === "ativos" && u.ativo) ||
        (userStatusFilter === "suspensos" && !u.ativo);
      return matchesSearch && matchesStatus;
    });
  }, [users, userSearch, userStatusFilter]);

  const filteredAds = useMemo(() => {
    return ads.filter((ad) => {
      const search = adSearch.toLowerCase().trim();
      const matchesSearch = !search || ad.titulo.toLowerCase().includes(search);
      const matchesStatus =
        adStatusFilter === "todos" || ad.status === adStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [ads, adSearch, adStatusFilter]);

  // Financeiro
  const receitaTotal = useMemo(() => {
    return subs.filter(s => s.status === "ativo" || s.status === "ativo").reduce((acc, s) => acc + (s.valor || 0), 0);
  }, [subs]);
  const receitaMes = useMemo(() => {
    const now = new Date();
    const m = now.getMonth();
    const y = now.getFullYear();
    return subs.filter((s) => {
      const d = new Date(s.createdAt);
      return d.getMonth() === m && d.getFullYear() === y;
    }).reduce((acc, s) => acc + (s.valor || 0), 0);
  }, [subs]);

  const honeypotBlocked = useMemo(() => {
    return secLogs.filter((l) => l.type === "honeypot_hit" || l.type === "injection_attempt" || l.type === "xss_attempt" || l.type === "crlf_attempt" || l.type === "bot_detected").length;
  }, [secLogs]);

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
        <div className="flex max-w-5xl mx-auto px-4">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? "border-purple-600 text-purple-700"
                  : "border-transparent text-gray-500"
              }`}
            >
              {tab.id === "denuncias" && <Flag className="w-3.5 h-3.5" />}
              {tab.label}
              {tab.id === "denuncias" && reports.filter(r => r.status === "pendente").length > 0 && (
                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                  {reports.filter(r => r.status === "pendente").length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-4">
        {/* ─────────── VISÃO GERAL ─────────── */}
        {activeTab === "overview" && stats && (
          <>
            {/* Financeiro */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-4 shadow-sm text-white">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-2">
                  <DollarSign className="w-5 h-5" />
                </div>
                <p className="text-2xl font-black">R$ {receitaTotal.toFixed(2)}</p>
                <p className="text-sm text-emerald-100">Receita Total</p>
                <p className="text-[10px] text-emerald-200 mt-1">Acumulada de assinaturas ativas</p>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-4 shadow-sm text-white">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-2">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <p className="text-2xl font-black">R$ {receitaMes.toFixed(2)}</p>
                <p className="text-sm text-blue-100">Receita do Mês</p>
                <p className="text-[10px] text-blue-200 mt-1">{new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
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

            {/* Central Segurança e Auditoria */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-600" />
                  Central Segurança e Auditoria
                </h2>
                <Badge variant={emergencyLockdown ? "red" : "green"}>
                  {emergencyLockdown ? "🔒 LOCKDOWN" : "🟢 Normal"}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
                  <div className="flex justify-center mb-1"><Bug className="w-5 h-5 text-red-600" /></div>
                  <p className="text-xl font-black text-red-700">{honeypotBlocked}</p>
                  <p className="text-[11px] text-red-600 font-semibold">Ataques bloqueados</p>
                  <p className="text-[10px] text-red-400">honeypot / injection / xss</p>
                </div>
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-center">
                  <div className="flex justify-center mb-1"><Activity className="w-5 h-5 text-orange-600" /></div>
                  <p className="text-xl font-black text-orange-700">{secLogs.length}</p>
                  <p className="text-[11px] text-orange-600 font-semibold">Logs recentes</p>
                  <p className="text-[10px] text-orange-400">últimos 30 eventos</p>
                </div>
                <div className="bg-gray-900 rounded-xl p-3 text-center">
                  <div className="flex justify-center mb-1"><Skull className="w-5 h-5 text-yellow-400" /></div>
                  <p className="text-sm font-bold text-white">Kill Switch</p>
                  <button
                    onClick={handleToggleLockdown}
                    className={`mt-2 w-full py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      emergencyLockdown
                        ? "bg-red-600 text-white hover:bg-red-700"
                        : "bg-white/10 text-yellow-300 hover:bg-white/20"
                    }`}
                  >
                    {emergencyLockdown ? "Desativar" : "Ativar"}
                  </button>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-3 max-h-72 overflow-y-auto">
                <p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" /> Registros anonimizados (IP/email mascarados)
                </p>
                {secLogs.length === 0 ? (
                  <p className="text-xs text-gray-400 py-4 text-center">Nenhum log de segurança ainda</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {secLogs.map((log, i) => {
                      const anon = anonymizeLog(log);
                      return (
                        <div key={i} className="bg-white rounded-lg px-3 py-2 border border-gray-100 text-[11px] font-mono flex items-start gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex-shrink-0 ${
                            log.severity === "critical" ? "bg-red-100 text-red-700" :
                            log.severity === "high" ? "bg-orange-100 text-orange-700" :
                            log.severity === "medium" ? "bg-yellow-100 text-yellow-700" :
                            "bg-gray-100 text-gray-600"
                          }`}>
                            {log.severity}
                          </span>
                          <div className="flex-1 min-w-0">
                            <span className="font-bold">{log.type}</span>
                            <span className="text-gray-400 ml-2">{new Date(log.ts).toLocaleString("pt-BR")}</span>
                            <div className="text-gray-500 truncate mt-0.5">{JSON.stringify(anon).slice(0,120)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-yellow-800 leading-snug">
                  <strong>EMERGENCY_LOCKDOWN</strong> é o Kill Switch global. Quando ativado, simula bloqueio de rotas exceto health check. Em produção, lê <code>process.env.EMERGENCY_LOCKDOWN</code>. No modo demo, persiste em <code>localStorage</code> para auditoria CISO.
                </p>
              </div>
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
            {/* Busca e Filtros */}
            <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Buscar por nome ou email..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                />
              </div>
              <div className="flex gap-2">
                {(["todos", "ativos", "suspensos"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setUserStatusFilter(f)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                      userStatusFilter === f
                        ? "bg-purple-600 text-white border-purple-600"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {f === "todos" ? "Todos" : f === "ativos" ? "Ativos" : "Suspensos"}
                  </button>
                ))}
                <span className="ml-auto text-xs text-gray-400 self-center">{filteredUsers.length} resultados</span>
              </div>
            </div>

            {filteredUsers.map((u) => (
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
                <div className="flex gap-2 items-center flex-wrap">
                  <Link href={`/perfil/${u.id}`} className="flex-1 min-w-[80px]">
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
                        className="flex-1 min-w-[80px]"
                        onClick={() => handleToggleUser(u.id, u.ativo)}
                      >
                        {u.ativo ? "Suspender" : "Reativar"}
                      </Button>
                      {(u as any).isPartner ? (
                        <button
                          onClick={() => handleSetPartner(u.id, false)}
                          className="text-[10px] font-bold px-2 py-1.5 rounded-xl border border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
                        >
                          Remover Parceiro
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSetPartner(u.id, true)}
                          className="text-[10px] font-bold px-2 py-1.5 rounded-xl border border-yellow-400 bg-yellow-400 text-gray-900 hover:bg-yellow-500"
                        >
                          Tornar Parceiro
                        </button>
                      )}
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
            {filteredUsers.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-8">Nenhum usuário encontrado</p>
            )}
          </div>
        )}

        {/* ─────────── ANÚNCIOS ─────────── */}
        {activeTab === "ads" && (
          <div className="flex flex-col gap-3">
            <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={adSearch}
                  onChange={(e) => setAdSearch(e.target.value)}
                  placeholder="Buscar por título do anúncio..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto">
                {(["todos", "ativo", "pausado", "rejeitado", "arquivado"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setAdStatusFilter(f as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border whitespace-nowrap transition-colors ${
                      adStatusFilter === f
                        ? "bg-purple-600 text-white border-purple-600"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {f === "todos" ? "Todos" : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
                <span className="ml-auto text-xs text-gray-400 self-center whitespace-nowrap">{filteredAds.length} resultados</span>
              </div>
            </div>

            {filteredAds.map((ad) => (
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
            {filteredAds.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-8">Nenhum anúncio encontrado</p>
            )}
          </div>
        )}

        {/* ─────────── DENÚNCIAS ─────────── */}
        {activeTab === "denuncias" && (
          <div className="flex flex-col gap-3">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-1">
                <Flag className="w-5 h-5 text-red-600" />
                Central de Denúncias
              </h2>
              <p className="text-xs text-gray-500">Gerencie denúncias da comunidade — mock funcional 100% compatível modo demo.</p>
            </div>

            {reports.length === 0 && (
              <p className="text-center text-gray-500 text-sm py-8">
                Nenhuma denúncia ainda 🎉
              </p>
            )}

            {reports.map((rep) => (
              <div key={rep.id} className="bg-white rounded-2xl p-4 shadow-sm border-l-4 border-l-red-400">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm flex items-center gap-2">
                      {rep.reason}
                      <Badge variant={rep.status === "pendente" ? "red" : rep.status === "resolvida" ? "green" : "gray"}>
                        {rep.status}
                      </Badge>
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      Anúncio: <Link href={`/anuncio/${rep.adId}`} className="text-purple-600 font-semibold hover:underline">{rep.adTitulo ?? rep.adId.slice(0,8)}</Link> · Reportado por {rep.reporterNome ?? "Usuário"}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 italic">&quot;{rep.description}&quot;</p>
                    <p className="text-[11px] text-gray-400 mt-1">{timeAgo(rep.createdAt)}</p>
                  </div>
                  <Flag className="w-4 h-4 text-red-400 flex-shrink-0" />
                </div>

                {rep.status === "pendente" && (
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <button
                      onClick={() => handleDiscardReport(rep.id)}
                      className="py-2 text-xs font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 flex items-center justify-center gap-1"
                    >
                      <EyeOff className="w-3.5 h-3.5" /> Descartar
                    </button>
                    <button
                      onClick={() => handlePauseAdFromReport(rep)}
                      className="py-2 text-xs font-semibold text-yellow-700 border border-yellow-200 bg-yellow-50 rounded-xl hover:bg-yellow-100 flex items-center justify-center gap-1"
                    >
                      <Ban className="w-3.5 h-3.5" /> Pausar Anúncio
                    </button>
                    <button
                      onClick={() => handleSuspendUserFromReport(rep)}
                      className="py-2 text-xs font-semibold text-red-700 border border-red-200 bg-red-50 rounded-xl hover:bg-red-100 flex items-center justify-center gap-1"
                    >
                      <Skull className="w-3.5 h-3.5" /> Suspender Usuário
                    </button>
                  </div>
                )}
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

        {/* ─────────── VERIFICADOS (inclui Parceiro Slim) ─────────── */}
        {activeTab === "verified" && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-gray-500 bg-purple-50 border border-purple-100 rounded-2xl p-3">
              Conceda ou remova selo <strong>✓ Verificado</strong> (azul) e <strong className="text-yellow-600">Parceiro</strong> (ouro). Regra slim: APENAS UM checkmark — ouro se parceiro, senão azul se verificado.
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
                  <p className="font-bold text-gray-900 text-sm truncate flex items-center gap-1">
                    {u.nome}
                    <VerifiedBadge isVerified={u.verificado} isPartner={(u as any).isPartner} size="sm" />
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {u.email} · {u.bairro}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-1.5">
                  <Button
                    variant={u.verificado ? "outline" : "primary"}
                    size="sm"
                    onClick={() => handleSetVerified(u.id, !u.verificado)}
                  >
                    {u.verificado ? "Remover selo" : "Verificar"}
                  </Button>
                  {(u as any).isPartner ? (
                    <button
                      onClick={() => handleSetPartner(u.id, false)}
                      className="text-[11px] font-bold px-2.5 py-1.5 rounded-xl border border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 transition-colors"
                    >
                      Remover Parceiro
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSetPartner(u.id, true)}
                      className="text-[11px] font-bold px-2.5 py-1.5 rounded-xl border border-yellow-400 bg-yellow-400 text-gray-900 hover:bg-yellow-500 transition-colors"
                    >
                      Tornar Parceiro
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ─────────── CMS + BANNER GLOBAL ─────────── */}
        {activeTab === "cms" && (
          <div className="flex flex-col gap-4">
            {/* Gerenciador Banners / Avisos Globais */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-purple-100">
              <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-3">
                <Megaphone className="w-5 h-5 text-purple-600" />
                Gerenciador Banners / Avisos Globais
              </h2>
              <p className="text-xs text-gray-500 mb-3">Defina uma mensagem de aviso global exibida como alerta no topo do site para todos os visitantes. Deixe vazio para desativar.</p>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Mensagem do Aviso Global</label>
                  <textarea
                    value={bannerMessage}
                    onChange={(e) => setBannerMessage(e.target.value)}
                    placeholder="Ex: 🚧 Manutenção programada hoje às 22h - voltamos em 1h"
                    rows={3}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Tipo do banner</label>
                  <select
                    value={bannerType}
                    onChange={(e) => setBannerType(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-purple-400"
                  >
                    <option value="info">Info (roxo)</option>
                    <option value="warning">Aviso (amarelo)</option>
                    <option value="error">Crítico (vermelho)</option>
                  </select>
                </div>
                <Button onClick={handleSaveBanner} loading={bannerSaving} fullWidth>
                  Salvar Aviso Global
                </Button>
                {bannerMessage.trim() && (
                  <div className={`rounded-xl px-3 py-2 text-sm text-white flex items-center gap-2 ${
                    bannerType === "error" ? "bg-red-600" : bannerType === "warning" ? "bg-yellow-500 text-gray-900" : "bg-purple-700"
                  }`}>
                    <Megaphone className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1">{bannerMessage}</span>
                  </div>
                )}
              </div>
            </div>

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
