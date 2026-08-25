"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdCard from "@/components/ads/AdCard";
import Avatar from "@/components/ui/Avatar";
import {
  ArrowRight,
  MapPin,
  Star,
  CheckCircle2,
  Plus,
  MessageCircle,
  X,
} from "lucide-react";
import * as backend from "@/lib/backend";
import type { AdCardData, Trade } from "@/lib/types";
import { DEMO_HOME_ADS, DEMO_FEED_ADS, DEMO_STATIC_STATS } from "@/lib/demo-data";
import DemoResetFooter from "@/components/DemoResetFooter";
import Logo from "@/components/Logo";
import {
  DEFAULT_SITE_CONTENT,
  renderRichText,
} from "@/lib/site-content";
import { PLANOS_ASSINATURA } from "@/lib/constants";
import Modal from "@/components/ui/Modal";
import toast from "react-hot-toast";
import { generateWhatsAppLink } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import BottomNav from "@/components/layout/BottomNav";

type Stats = typeof DEMO_STATIC_STATS;

// ═══════════════════════════════════════════════════════════
// GAMIFICAÇÃO · Nível no Bairro
// ═══════════════════════════════════════════════════════════
const LEVEL_TIERS = [
  { min: 0, nome: "Novato do Bairro", selo: "🌱" },
  { min: 2, nome: "Vizinho Ativo", selo: "🤝" },
  { min: 5, nome: "Vizinho de Ouro", selo: "🏅" },
  { min: 10, nome: "Selo de Elite", selo: "💎" },
  { min: 20, nome: "Lenda do Bairro", selo: "👑" },
];

function levelInfo(trocas: number) {
  let idx = 0;
  LEVEL_TIERS.forEach((t, i) => {
    if (trocas >= t.min) idx = i;
  });
  const atual = LEVEL_TIERS[idx];
  const proxima = LEVEL_TIERS[idx + 1];
  const progresso = proxima
    ? Math.round(((trocas - atual.min) / (proxima.min - atual.min)) * 100)
    : 100;
  return {
    nivel: idx + 1,
    selo: atual.selo,
    nome: atual.nome,
    proximoNome: proxima?.nome ?? null,
    faltam: proxima ? proxima.min - trocas : 0,
    progresso: Math.max(4, Math.min(100, progresso)),
  };
}

const ACTIVE_TRADE_STATUSES = [
  "pending",
  "accepted",
  "in_progress",
  "completed",
  "awaiting_reviews",
];
const TRADE_STEP: Record<string, number> = {
  pending: 1,
  accepted: 2,
  in_progress: 3,
  completed: 3,
  awaiting_reviews: 4,
};
const TRADE_STEPS = ["Solicitado", "Aceito", "Realizado", "Avaliação"];

type TabId = "recomendados" | "bairro" | "urgente" | "destaques" | "vizinho";
const TABS: { id: TabId; label: string }[] = [
  { id: "recomendados", label: "🔥 Recomendados para Você" },
  { id: "bairro", label: "📍 No seu Bairro" },
  { id: "urgente", label: "⚡ URGENTE: Precisa Hoje" },
  { id: "destaques", label: "⭐ Em Destaque" },
];

export default function HomePage() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const router = useRouter();

  // ═══ HIDRATAÇÃO 100% LIMPA ═════════════════════════════════
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // ── Estado da LANDING (visitante) ──
  const [featuredAds, setFeaturedAds] = useState<AdCardData[]>(DEMO_HOME_ADS);
  const [stats, setStats] = useState<Stats>(DEMO_STATIC_STATS);
  const [content, setContent] = useState<Record<string, string>>(
    DEFAULT_SITE_CONTENT
  );

  // ── Estado da CENTRAL DE COMANDO (logado) ──
  const [allAds, setAllAds] = useState<AdCardData[]>(DEMO_FEED_ADS);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [planoAtivo, setPlanoAtivo] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("recomendados");
  const [vizinhoFiltro, setVizinhoFiltro] = useState<{
    id: string;
    nome: string;
  } | null>(null);
  const [verificadoModal, setVerificadoModal] = useState(false);
  const [ativandoSelo, setAtivandoSelo] = useState(false);
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);

  // Refresh da landing (somente visitante)
  useEffect(() => {
    if (!mounted || user) return;
    let cancelled = false;
    backend
      .listAds({ limit: 6, ordenacao: "recentes" })
      .then((r) => {
        if (!cancelled) setFeaturedAds(r.ads);
      })
      .catch(() => {});
    backend
      .getSiteContent()
      .then((c2) => {
        if (!cancelled) setContent(c2);
      })
      .catch(() => {});
    backend
      .getPublicStats()
      .then((st) => {
        if (!cancelled) setStats(st);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mounted, user]);

  // Dados da Central de Comando (somente logado)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    backend
      .listAds({ limit: 24 })
      .then((r) => {
        if (!cancelled) setAllAds(r.ads);
      })
      .catch(() => {});
    backend
      .listTrades(user.id, "todas")
      .then((t) => {
        if (!cancelled) setTrades(t);
      })
      .catch(() => {});
    backend
      .listSubscriptions(user.id)
      .then((subs) => {
        if (!cancelled)
          setPlanoAtivo(
            subs.some(
              (s) =>
                ["conexao", "expansao"].includes(s.plano) && s.status === "ativo"
            )
          );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, feedRefreshKey]);

  const resolvedContent = content;
  const resolvedStats = stats;

  const c = (key: string) =>
    resolvedContent[key] ?? DEFAULT_SITE_CONTENT[key] ?? "";
  const steps = [1, 2, 3].map((n) => ({
    num: String(n),
    emoji: c(`home.como_funciona.${n}.emoji`),
    title: c(`home.como_funciona.${n}.title`),
    desc: c(`home.como_funciona.${n}.desc`),
  }));
  const beneficios = [1, 2, 3, 4].map((n) => ({
    emoji: c(`home.porque.${n}.emoji`),
    text: c(`home.porque.${n}.text`),
  }));
  const depoimentos = [1, 2, 3].map((n) => ({
    name: c(`home.depoimentos.${n}.name`),
    bairro: c(`home.depoimentos.${n}.bairro`),
    text: c(`home.depoimentos.${n}.text`),
    stars: Math.max(
      1,
      Math.min(5, Number(c(`home.depoimentos.${n}.stars`)) || 5)
    ),
  }));

  // ═══════════════════════════════════════════════════════════
  // DERIVAÇÕES DA CENTRAL DE COMANDO
  // ═══════════════════════════════════════════════════════════
  const agora = new Date();
  const saudacao =
    agora.getHours() < 12
      ? "Bom dia"
      : agora.getHours() < 18
      ? "Boa tarde"
      : "Boa noite";

  const nivel = useMemo(
    () => levelInfo(user?.trocasConcluidas ?? 0),
    [user?.trocasConcluidas]
  );

  const trocasNoMes = useMemo(
    () =>
      trades.filter((t) => {
        const d = new Date(t.createdAt);
        return (
          d.getMonth() === agora.getMonth() &&
          d.getFullYear() === agora.getFullYear()
        );
      }).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trades, user?.id]
  );
  const tradesLeft = planoAtivo ? null : Math.max(0, 3 - trocasNoMes);

  const trocaAtiva = useMemo(
    () =>
      trades.find((t) => ACTIVE_TRADE_STATUSES.includes(t.status)) ?? null,
    [trades]
  );
  const passoAtual = trocaAtiva
    ? TRADE_STEP[trocaAtiva.status] ?? 1
    : 0;

  const vizinhos = useMemo(() => {
    const map = new Map<
      string,
      { id: string; nome: string; avatar: string | null; tag: string }
    >();
    // FILTRO ESTREITO: apenas Vizinhos Verificados (verificado = true)
    for (const a of allAds) {
      if (!user || a.userId === user.id || map.has(a.userId)) continue;
      if (!a.userVerificado) continue;
      map.set(a.userId, {
        id: a.userId,
        nome: a.userName,
        avatar: a.userAvatar,
        tag: a.categoria,
      });
    }
    const outros = [...map.values()];
    // ✅ Logado verificado: a própria foto entra na vitrine VIP
    if (user?.verificado) {
      return [
        {
          id: user.id,
          nome: user.nome,
          avatar: user.avatarUrl,
          tag: user.categorias?.[0] ?? "Verificado",
        },
        ...outros,
      ].slice(0, 11);
    }
    return outros.slice(0, 10);
  }, [allAds, user?.id, user?.verificado]);

  const meusAnuncios = (a: AdCardData) => !!user && a.userId === user.id;

  const categoriasUser = user?.categorias ?? [];
  const matchCount = useMemo(
    () =>
      categoriasUser.length
        ? allAds.filter(
            (a) => !meusAnuncios(a) && categoriasUser.includes(a.categoria)
          ).length
        : 0,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allAds, user?.id, user?.categorias]
  );

  const feedList = useMemo(() => {
    const outros = allAds.filter((a) => !meusAnuncios(a));
    if (vizinhoFiltro)
      return allAds.filter((a) => a.userId === vizinhoFiltro.id);
    switch (activeTab) {
      case "recomendados": {
        const rec = outros.filter((a) => categoriasUser.includes(a.categoria));
        return rec.length > 0 ? rec : outros;
      }
      case "bairro":
        return outros.filter(
          (a) =>
            (!!user?.bairro && a.bairro === user.bairro) ||
            (!user?.bairro && !!user?.cidade && a.cidade === user.cidade)
        );
      case "urgente":
        return outros.filter((a) => a.tipo === "preciso");
      case "destaques":
        return outros.filter((a) => a.destaque || a.topoFeed);
      default:
        return outros;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allAds, activeTab, vizinhoFiltro, user?.id, user?.bairro, user?.categorias]);

  /**
   * ✅ ATIVAÇÃO DIRETA DO SELO VERIFICADO (assinatura do PERFIL,
   * R$ 29,90/mês — sem seleção de anúncio). Demo: pagamento simulado,
   * perfil vira verificado na hora e a Home atualiza instantaneamente.
   */
  const handleAtivarSeloVerificado = async () => {
    if (!user) return;
    setAtivandoSelo(true);
    try {
      await backend.activatePlan(user.id, "verificado");
      await refreshUser(); // user.verificado = true no Context
      setFeedRefreshKey((k) => k + 1); // revalida feed/vitrine
      toast.success("Perfil verificado! ✅ Selo dourado ativado na hora.");
      setVerificadoModal(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao ativar";
      toast.error(message);
    } finally {
      setAtivandoSelo(false);
    }
  };

  const abrirVizinho = (v: { id: string; nome: string }) => {
    if (user && v.id === user.id) {
      router.push(`/perfil/${user.id}`);
      return;
    }
    setVizinhoFiltro(v);
    setActiveTab("vizinho");
    document
      .getElementById("feed-logado")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const irParaFeed = (tab: TabId) => {
    setVizinhoFiltro(null);
    setActiveTab(tab);
    document
      .getElementById("feed-logado")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#FAF9FB]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="w-full max-w-7xl mx-auto px-2.5 sm:px-6 flex items-center justify-between h-16 overflow-hidden">
          <span className="min-w-0 flex items-center">
            <Logo size="sm" />
          </span>
          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0 ml-auto">
            {!authLoading && user ? (
              <Link
                href={user.role === "admin" ? "/admin" : "/dashboard"}
                className="font-bold bg-purple-700 text-white rounded-2xl px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm hover:bg-purple-800 transition-colors whitespace-nowrap"
              >
                {user.role === "admin" ? "Painel Admin" : "Meu Perfil"}
              </Link>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      </header>

      {!user ? (
        <>
          {/* ═══════════════ LANDING PAGE (VISITANTE) — inalterada ═══════════════ */}
          <section className="relative overflow-hidden bg-gradient-to-br from-purple-900 via-purple-800 to-purple-700 pt-20">
            <div className="absolute inset-0 bg-black/20" />
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: `url('/images/hero-bg.jpg')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            <div className="relative max-w-lg mx-auto px-5 py-12 text-center">
              <div className="inline-flex items-center gap-2 bg-yellow-400/20 border border-yellow-400/40 rounded-full px-4 py-1.5 mb-6">
                <MapPin className="w-4 h-4 text-yellow-400" />
                <span className="text-yellow-300 text-sm font-semibold">
                  {c("home.hero.badge")}
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-4">
                {c("home.hero.title")}
                <span className="text-yellow-400">
                  {" "}
                  {c("home.hero.title_highlight")}
                </span>
              </h1>
              <p className="text-purple-100 text-lg mb-8 leading-relaxed">
                {renderRichText(c("home.hero.subtitle")).map((part, i) =>
                  part.bold ? (
                    <span key={i} className="font-bold text-white">
                      {part.part}
                    </span>
                  ) : (
                    <span key={i}>{part.part}</span>
                  )
                )}
              </p>

              <div className="flex flex-col gap-3">
                <Link
                  href="/cadastro"
                  className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold text-lg py-4 rounded-2xl transition-all active:scale-95 shadow-lg"
                >
                  {c("home.hero.cta_primary")}
                </Link>
                <Link
                  href="/buscar"
                  className="w-full bg-white/15 hover:bg-white/25 text-white font-semibold text-base py-3.5 rounded-2xl border border-white/30 transition-all"
                >
                  {c("home.hero.cta_secondary")}
                </Link>
              </div>

              {(resolvedStats.users > 0 || resolvedStats.ads > 0) && (
                <div className="flex justify-center gap-8 mt-8">
                  <div className="text-center">
                    <p className="text-2xl font-black text-white">
                      {resolvedStats.users}
                    </p>
                    <p className="text-purple-200 text-sm">Usuários</p>
                  </div>
                  <div className="w-px bg-white/20" />
                  <div className="text-center">
                    <p className="text-2xl font-black text-white">
                      {resolvedStats.ads}
                    </p>
                    <p className="text-purple-200 text-sm">Anúncios</p>
                  </div>
                  <div className="w-px bg-white/20" />
                  <div className="text-center">
                    <p className="text-2xl font-black text-white">
                      {resolvedStats.trades}
                    </p>
                    <p className="text-purple-200 text-sm">Trocas</p>
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <svg viewBox="0 0 1440 60" className="w-full" fill="#FAF9FB">
                <path d="M0,30 C360,60 1080,0 1440,30 L1440,60 L0,60 Z" />
              </svg>
            </div>
          </section>

          <main className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 pb-28">
            <div className="max-w-lg mx-auto w-full">
              {/* How it works */}
              <section className="py-8">
                <h2 className="text-2xl font-black text-gray-900 text-center mb-6">
                  {c("home.como_funciona.title")}
                </h2>
                <div className="flex flex-col gap-4">
                  {steps.map(({ emoji, num, title, desc }) => (
                    <div
                      key={num}
                      className="flex gap-4 items-start bg-white rounded-2xl p-4 shadow-sm"
                    >
                      <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl">
                        {emoji}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-base mb-1">
                          {title}
                        </h3>
                        <p className="text-gray-600 text-sm leading-relaxed">
                          {desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {featuredAds.length === 0 && (
                <section className="py-8">
                  <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                    <div className="text-5xl mb-4">🌱</div>
                    <h3 className="font-bold text-gray-900 text-lg mb-2">
                      Seja o primeiro do bairro!
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Nenhum anúncio ainda. Publique o primeiro e comece a
                      trocar!
                    </p>
                    <Link
                      href="/cadastro"
                      className="inline-block bg-purple-700 text-white font-bold py-3 px-6 rounded-2xl"
                    >
                      Publicar grátis
                    </Link>
                  </div>
                </section>
              )}
            </div>

            {featuredAds.length > 0 && (
              <section className="py-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-black text-gray-900">
                    Anúncios em destaque ✨
                  </h2>
                  <Link
                    href="/buscar"
                    className="flex items-center gap-1 text-purple-700 font-semibold text-sm"
                  >
                    Ver todos
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
                <div className="grid grid-cols-2 items-stretch gap-2.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-3 lg:gap-5 xl:grid-cols-4">
                  {featuredAds.map((ad) => (
                    <AdCard key={ad.id} ad={ad} />
                  ))}
                </div>
              </section>
            )}

            <div className="max-w-lg mx-auto w-full">
              {/* Benefits */}
              <section className="py-6">
                <h2 className="text-xl font-black text-gray-900 text-center mb-4">
                  {c("home.porque.title")}
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {beneficios.map(({ emoji, text }, i) => (
                    <div
                      key={i}
                      className="bg-white rounded-2xl p-4 shadow-sm flex flex-col items-center gap-2 text-center"
                    >
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl bg-purple-100">
                        {emoji}
                      </div>
                      <span className="text-sm font-semibold text-gray-800">
                        {text}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Testimonials */}
              <section className="py-4">
                <h2 className="text-xl font-black text-gray-900 text-center mb-4">
                  {c("home.depoimentos.title")}
                </h2>
                <div className="flex flex-col gap-3">
                  {depoimentos.map(
                    ({ name, bairro, text, stars }, i) =>
                      name && (
                        <div
                          key={i}
                          className="bg-white rounded-2xl p-4 shadow-sm"
                        >
                          <div className="flex gap-0.5 mb-2">
                            {Array.from({ length: stars }).map((_, j) => (
                              <Star
                                key={j}
                                className="w-4 h-4 fill-yellow-400 text-yellow-400"
                              />
                            ))}
                          </div>
                          <p className="text-gray-700 text-sm mb-3">
                            &quot;{text}&quot;
                          </p>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-purple-200 rounded-full flex items-center justify-center">
                              <span className="text-purple-800 text-sm font-bold">
                                {name[0]}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                {name}
                              </p>
                              <p className="text-xs text-gray-500">{bairro}</p>
                            </div>
                          </div>
                        </div>
                      )
                  )}
                </div>
              </section>

              {/* Planos Freemium */}
              <section className="py-6">
                <h2 className="text-xl font-black text-gray-900 text-center mb-1">
                  Planos para impulsionar suas trocas 🚀
                </h2>
                <p className="text-center text-gray-500 text-sm mb-4">
                  Comece grátis e aumente seu alcance quando quiser.
                </p>
                <div className="flex flex-col gap-3">
                  {PLANOS_ASSINATURA.map((plano) => (
                    <div key={plano.id} className="relative">
                      {/* 🔥 Selo VIP flutuante — Plano Conexão */}
                      {plano.destaque && (
                        <span className="absolute -top-3 left-6 z-10 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-purple-950 font-black text-[10px] sm:text-xs uppercase tracking-widest px-3 py-1 rounded-full shadow-md border border-amber-300 flex items-center gap-1.5">
                          🔥 Mais Popular
                        </span>
                      )}
                      <Link
                        href="/planos"
                        className={`block bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 active:scale-[0.99] transition-transform ${
                          plano.destaque
                            ? "border-2 border-amber-400 shadow-md ring-4 ring-amber-400/10"
                            : "border border-purple-100 shadow-sm"
                        }`}
                      >
                        {/* Cabeçalho: ícone + título | preço */}
                        <div className="flex items-center justify-between gap-3 mb-1.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-2xl flex-shrink-0">
                              {plano.badge}
                            </span>
                            <p className="text-base sm:text-xl font-extrabold text-gray-900">
                              {plano.nome}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            {plano.preco === 0 ? (
                              <p className="text-lg sm:text-2xl font-black text-purple-950">
                                Grátis
                              </p>
                            ) : (
                              <p className="text-lg sm:text-2xl font-black text-purple-950">
                                R${" "}
                                {plano.preco.toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2,
                                })}
                                <span className="text-xs text-gray-400 font-semibold">
                                  /mês
                                </span>
                              </p>
                            )}
                          </div>
                        </div>
                        {/* Descrição completa — sem cortes */}
                        <p className="break-words whitespace-normal leading-relaxed text-xs sm:text-sm text-gray-600">
                          {plano.descricao}
                        </p>
                      </Link>
                    </div>
                  ))}
                  <Link
                    href="/impulsionar"
                    className="flex items-center justify-center gap-2 py-3 border-2 border-dashed border-purple-300 rounded-2xl text-purple-700 font-semibold text-sm hover:bg-purple-50 transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Impulsionamentos a partir de R$ 3,00
                  </Link>
                </div>
              </section>

              <section className="pb-2">
                <DemoResetFooter />
                <p className="text-center text-[11px] text-gray-400 mt-2">
                  Modo demonstração — dados locais de exemplo (aqui o app roda
                  sem backend). Configure as chaves do Supabase no .env.local
                  para produção.
                </p>
              </section>

              {!user && (
                <section className="py-6">
                  <div className="bg-gradient-to-br from-purple-700 to-purple-900 rounded-3xl p-6 text-center text-white">
                    <h2 className="text-2xl font-black mb-2">
                      {c("home.cta.title")}
                    </h2>
                    <p className="text-purple-100 mb-5 text-sm">
                      {c("home.cta.subtitle")}
                    </p>
                    <Link
                      href="/cadastro"
                      className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold text-base py-4 rounded-2xl transition-all inline-block active:scale-95"
                    >
                      Criar conta grátis
                    </Link>
                  </div>
                </section>
              )}
            </div>
          </main>
        </>
      ) : (
        <>
          {/* ═══════════════ CENTRAL DE COMANDO HYPER-LOCAL (LOGADO) ═══════════════ */}
          <section className="bg-gradient-to-br from-purple-900 via-purple-800 to-purple-700 pt-16 pb-8">
            <div className="max-w-lg mx-auto px-4">
              {/* 1 · SAUDAÇÃO + GAMIFICAÇÃO */}
              <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                {saudacao}, {user.nome.split(" ")[0]}! 👋
              </h1>
              <p className="text-purple-200 text-sm mt-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {user.bairro || "Jesus de Nazaré"} · {user.cidade || "Vitória"}/
                {user.uf || "ES"}
              </p>

              {/* Badge de nível + barra de progresso */}
              <div className="mt-4 bg-white/10 border border-white/15 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-white">
                    {nivel.selo} {nivel.nome}{" "}
                    <span className="text-purple-300 font-medium">
                      (Nível {nivel.nivel})
                    </span>
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-400 text-gray-900">
                    NÍVEL NO BAIRRO
                  </span>
                </div>
                <div className="h-2.5 bg-purple-950/40 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-yellow-400 to-yellow-300 rounded-full transition-all"
                    style={{ width: `${nivel.progresso}%` }}
                  />
                </div>
                <p className="text-xs text-purple-200 mt-2">
                  {nivel.proximoNome
                    ? `Faltam ${nivel.faltam} ${
                        nivel.faltam === 1 ? "troca" : "trocas"
                      } para desbloquear o ${nivel.proximoNome} ${LEVEL_TIERS.find((t) => t.nome === nivel.proximoNome)?.selo ?? ""}`
                    : "🏆 Nível máximo alcançado — você é uma lenda do bairro!"}
                </p>
              </div>

              {/* Pílulas de status rápido */}
              <div className="flex gap-2 mt-3">
                <div className="flex-1 bg-white/10 border border-white/15 rounded-xl px-3 py-2.5 text-center">
                  <p className="text-sm font-black text-white flex items-center justify-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                    {(user.mediaAvaliacao || 0).toFixed(1)}
                  </p>
                  <p className="text-[10px] text-purple-200 mt-0.5">
                    {user.totalAvaliacoes || 0} avaliações
                  </p>
                </div>
                <div className="flex-1 bg-white/10 border border-white/15 rounded-xl px-3 py-2.5 text-center">
                  <p className="text-sm font-black text-white flex items-center justify-center gap-1">
                    ⚡ {tradesLeft === null ? "∞" : tradesLeft}
                  </p>
                  <p className="text-[10px] text-purple-200 mt-0.5">
                    {tradesLeft === null
                      ? "ilimitadas (plano ativo)"
                      : `${tradesLeft === 1 ? "troca restante" : "trocas restantes"} no mês`}
                  </p>
                </div>
                <div className="flex-1 bg-white/10 border border-white/15 rounded-xl px-3 py-2.5 text-center">
                  <p className="text-sm font-black text-white">
                    🤝 {user.trocasConcluidas || 0}
                  </p>
                  <p className="text-[10px] text-purple-200 mt-0.5">
                    trocas concluídas
                  </p>
                </div>
              </div>
            </div>
          </section>

          <main className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 pb-28">
            <div className="max-w-lg mx-auto w-full">
              {/* 2 · RASTREADOR AO VIVO DE TROCA ATIVA (estilo iFood/Uber) */}
              {trocaAtiva && (
                <section className="-mt-4 relative z-10">
                  <div className="bg-white rounded-2xl border-2 border-yellow-400 shadow-lg p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-purple-700 uppercase tracking-wide">
                          🔄 Troca em andamento
                        </p>
                        <p className="text-sm font-black text-gray-900 truncate">
                          com {trocaAtiva.otherNome}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {trocaAtiva.adTitulo}
                        </p>
                      </div>
                      <Avatar
                        src={trocaAtiva.otherAvatar}
                        name={trocaAtiva.otherNome}
                        size="sm"
                      />
                    </div>

                    {/* Passos visuais 1→4 */}
                    <div className="flex items-center justify-between mb-3 px-1">
                      {TRADE_STEPS.map((label, i) => {
                        const n = i + 1;
                        const done = n < passoAtual;
                        const atual = n === passoAtual;
                        return (
                          <div
                            key={label}
                            className="flex items-center flex-1 last:flex-none"
                          >
                            <div className="flex flex-col items-center gap-1">
                              <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border-2 ${
                                  done
                                    ? "bg-green-500 border-green-500 text-white"
                                    : atual
                                    ? "bg-yellow-400 border-yellow-400 text-gray-900 animate-pulse"
                                    : "bg-white border-gray-200 text-gray-400"
                                }`}
                              >
                                {done ? (
                                  <CheckCircle2 className="w-4 h-4" />
                                ) : (
                                  n
                                )}
                              </div>
                              <span
                                className={`text-[9px] font-semibold text-center leading-tight ${
                                  atual
                                    ? "text-gray-900"
                                    : done
                                    ? "text-green-600"
                                    : "text-gray-400"
                                }`}
                              >
                                {label}
                                {atual ? " (agora)" : ""}
                              </span>
                            </div>
                            {n < TRADE_STEPS.length && (
                              <div
                                className={`flex-1 h-0.5 mx-1 mb-4 rounded ${
                                  done ? "bg-green-400" : "bg-gray-200"
                                }`}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex gap-2">
                      {/* 💬 Chat da plataforma (tempo real) */}
                      <Link
                        href={`/trocas/${trocaAtiva.id}/chat`}
                        className="flex-1 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Chat da Plataforma
                      </Link>
                      {["accepted", "in_progress", "completed", "awaiting_reviews"].includes(
                        trocaAtiva.status
                      ) &&
                        trocaAtiva.otherWhatsapp && (
                          <button
                            onClick={() =>
                              window.open(
                                generateWhatsAppLink(
                                  trocaAtiva.otherWhatsapp!,
                                  `Olá! Sobre nossa troca "${trocaAtiva.adTitulo}" no TrocaES — vamos combinar os detalhes?`
                                ),
                                "_blank"
                              )
                            }
                            className="w-11 h-[42px] bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-xl flex items-center justify-center active:scale-95 transition-all"
                            title="Abrir WhatsApp (liberado após o aceite)"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                        )}
                      <Link
                        href="/trocas"
                        className="w-11 h-[42px] border-2 border-purple-700 text-purple-700 text-xs font-bold rounded-xl flex items-center justify-center hover:bg-purple-50 active:scale-95 transition-all"
                        title="Ver detalhes da troca"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </section>
              )}

              {/* ⭐ BANNER PROMOCIONAL · apenas logados NÃO verificados */}
              {!user.verificado && (
                <section className="pt-4 pb-1">
                  <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
                    <div>
                      <p className="text-sm font-black text-amber-900 leading-snug">
                        Destaque seu perfil no topo do seu bairro
                      </p>
                      <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                        Selo oficial de identidade confirmada e prioridade nas
                        trocas da sua região.
                      </p>
                    </div>
                    <button
                      onClick={() => setVerificadoModal(true)}
                      className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-xs font-bold py-3 rounded-xl active:scale-95 transition-all shadow-sm"
                    >
                      Assinar Selo Verificado • R$ 29,90/mês
                    </button>
                  </div>
                </section>
              )}

              {/* 3 · VITRINE VIP · Vizinhos Verificados ✅ */}
              <section className="pt-5 pb-1">
                <h2 className="text-sm font-black text-gray-900 uppercase tracking-wide mb-1">
                  Vizinhos Verificados ✅
                </h2>
                <p className="text-[11px] text-gray-500 mb-3">
                  Perfís com identidade confirmada e alta reputação na
                  comunidade.
                </p>

                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1">
                  {/* Bolinha 1: Criar anúncio */}
                  <Link
                    href="/anuncio/criar"
                    className="flex flex-col items-center gap-1.5 flex-shrink-0 w-[68px]"
                  >
                    <div className="w-16 h-16 rounded-full border-2 border-dashed border-purple-400 bg-white flex items-center justify-center">
                      <Plus className="w-6 h-6 text-purple-600" />
                    </div>
                    <span className="text-[10px] font-semibold text-purple-700 text-center leading-tight">
                      Criar Anúncio
                    </span>
                  </Link>

                  {/* Bolinha 2 · GATILHO DE MONETIZAÇÃO (se não for verificado) */}
                  {!user.verificado && (
                    <button
                      onClick={() => setVerificadoModal(true)}
                      className="flex flex-col items-center gap-1.5 flex-shrink-0 w-[68px]"
                    >
                      <div className="w-16 h-16 rounded-full border-2 border-dashed border-amber-400 bg-amber-50 flex items-center justify-center shadow-sm">
                        <span className="text-2xl">⚡</span>
                      </div>
                      <span className="text-[10px] font-bold text-amber-700 text-center leading-tight">
                        Assinar Selo
                        <span className="block font-semibold text-amber-600">
                          R$ 29,90/mês
                        </span>
                      </span>
                    </button>
                  )}

                  {/* Bolinhas VIP: anel dourado duplo + mini-selo ✅ */}
                  {vizinhos.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => abrirVizinho(v)}
                      className="flex flex-col items-center gap-1.5 flex-shrink-0 w-[72px]"
                    >
                      <div className="relative w-16 h-16">
                        <div className="w-full h-full rounded-full border-2 border-amber-400 p-0.5 shadow-sm bg-white">
                          <div className="w-full h-full rounded-full overflow-hidden border border-amber-200 bg-purple-100">
                            <Avatar
                              src={v.avatar}
                              name={v.nome}
                              size="xl"
                              className="w-full h-full"
                            />
                          </div>
                        </div>
                        {/* Mini-selo de checagem ✅ sobreposto */}
                        <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center shadow-sm">
                          <CheckCircle2 className="w-3 h-3 text-white" />
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-gray-800 text-center leading-tight truncate w-full">
                        {v.nome.split(" ")[0]}
                        <span className="block font-medium text-gray-500 truncate">
                          {v.tag}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>

                {/* ESTADO VAZIO ELEGANTE: nenhum verificado no bairro */}
                {vizinhos.length === 0 && (
                  <div className="mt-2 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl p-4 flex flex-col items-center text-center gap-3">
                    <p className="text-sm font-bold text-amber-900 leading-snug">
                      ⭐ Seja o primeiro Vizinho Verificado do seu bairro e
                      ganhe destaque no topo da comunidade!
                    </p>
                    <button
                      onClick={() => setVerificadoModal(true)}
                      className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-xs font-bold px-4 py-2.5 rounded-xl active:scale-95 transition-all"
                    >
                      Assinar Selo Verificado • R$ 29,90/mês
                    </button>
                  </div>
                )}
              </section>

              {/* 4 · SMART MATCH */}
              {matchCount > 0 && categoriasUser[0] && (
                <section className="pt-3">
                  <div className="bg-gradient-to-r from-purple-700 to-purple-900 rounded-2xl p-4 text-white flex items-center gap-3">
                    <span className="text-2xl flex-shrink-0">🎯</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold leading-snug">
                        {matchCount}{" "}
                        {matchCount === 1
                          ? "vizinho no seu bairro está precisando"
                          : "vizinhos no seu bairro estão precisando de"}{" "}
                        <span className="text-yellow-300">
                          {categoriasUser[0]}
                        </span>{" "}
                        hoje!
                      </p>
                    </div>
                    <button
                      onClick={() => irParaFeed("recomendados")}
                      className="flex-shrink-0 bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-xs font-bold px-3 py-2 rounded-xl active:scale-95 transition-all"
                    >
                      Ver oportunidades
                    </button>
                  </div>
                </section>
              )}
            </div>

            {/* 5 · FEED COM ABAS INTELIGENTES */}
            <section id="feed-logado" className="py-4 scroll-mt-20">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-black text-gray-900">
                  Anúncios para você
                </h2>
                <Link
                  href="/buscar"
                  className="flex items-center gap-1 text-purple-700 font-semibold text-sm"
                >
                  Ver todos
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {/* Abas de filtro rápido */}
              <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none">
                {vizinhoFiltro && (
                  <button
                    onClick={() => setVizinhoFiltro(null)}
                    className="flex-shrink-0 flex items-center gap-1 px-4 py-2 rounded-full text-xs font-bold bg-yellow-400 text-gray-900"
                  >
                    👤 {vizinhoFiltro.nome.split(" ")[0]}
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                {!vizinhoFiltro &&
                  TABS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                        activeTab === tab.id
                          ? "bg-purple-700 text-white shadow-sm"
                          : "bg-white border-2 border-gray-200 text-gray-600"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
              </div>

              {feedList.length > 0 ? (
                <div className="grid grid-cols-2 items-stretch gap-2.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-3 lg:gap-5 xl:grid-cols-4">
                  {feedList.map((ad) => (
                    <AdCard key={ad.id} ad={ad} />
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-8 text-center shadow-sm max-w-lg mx-auto">
                  <div className="text-4xl mb-3">🔍</div>
                  <h3 className="font-bold text-gray-900 mb-1">
                    Nada por aqui ainda
                  </h3>
                  <p className="text-gray-500 text-sm mb-4">
                    {activeTab === "bairro"
                      ? `Ainda não há anúncios no ${user.bairro || "seu bairro"}. Explore outras abas ou convide um vizinho!`
                      : activeTab === "destaques"
                      ? "Nenhum anúncio em destaque neste momento."
                      : "Tente outra aba ou veja todos os anúncios."}
                  </p>
                  <button
                    onClick={() => irParaFeed("recomendados")}
                    className="text-sm text-purple-700 font-semibold"
                  >
                    ← Voltar aos recomendados
                  </button>
                </div>
              )}
            </section>

            {/* Rodapé demo (mantido) */}
            <div className="max-w-lg mx-auto w-full">
              <section className="pb-2 pt-2">
                <DemoResetFooter />
              </section>

              {/* Upgrade discreto (substitui a tabela de planos institucional) */}
              <section className="py-3">
                <Link
                  href="/planos"
                  className="flex items-center justify-between gap-2 bg-white rounded-2xl border border-purple-100 shadow-sm p-4"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xl">🚀</span>
                    <p className="text-xs text-gray-600 leading-snug">
                      Quer mais visibilidade e trocas ilimitadas?{" "}
                      <strong className="text-purple-700">Fazer Upgrade</strong>
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-purple-400 flex-shrink-0" />
                </Link>
              </section>
            </div>
          </main>
        </>
      )}

      {/* ✅ MODAL DEDICADO · Verificação de Perfil (assinatura do PERFIL) */}
      <Modal
        isOpen={verificadoModal}
        onClose={() => setVerificadoModal(false)}
        title="Torne-se um Vizinho Verificado"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col gap-2.5">
            <div className="flex items-start gap-2.5">
              <span className="text-lg flex-shrink-0">✅</span>
              <p className="text-xs text-amber-900 font-medium leading-relaxed">
                Selo oficial de identidade confirmada no seu perfil e anúncios
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="text-lg flex-shrink-0">⭐</span>
              <p className="text-xs text-amber-900 font-medium leading-relaxed">
                Destaque permanente no topo da Home na vitrine de verificados
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="text-lg flex-shrink-0">🚀</span>
              <p className="text-xs text-amber-900 font-medium leading-relaxed">
                Até 3x mais propostas de trocas no seu bairro
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500 text-center">
            Assinatura do seu perfil — sem seleção de anúncio, ativada na hora.
          </p>
          <button
            onClick={handleAtivarSeloVerificado}
            disabled={ativandoSelo}
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold py-3.5 rounded-2xl active:scale-95 transition-all disabled:opacity-60"
          >
            {ativandoSelo ? "Ativando..." : "Ativar Selo Verificado — R$ 29,90/mês"}
          </button>
        </div>
      </Modal>

      {/* Bottom Nav */}
      <BottomNav />
    </div>
  );
}
