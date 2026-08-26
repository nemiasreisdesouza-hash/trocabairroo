"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  CheckCircle2,
  Star,
  Edit3,
  MessageCircle,
  Calendar,
  ThumbsUp,
  Handshake,
  ShieldCheck,
  Zap,
  Trophy,
} from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import StarRating from "@/components/ui/StarRating";
import Button from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { timeAgo } from "@/lib/utils";
import AppLayout from "@/components/layout/AppLayout";
import * as backend from "@/lib/backend";
import type { AuthUser, ReviewWithReviewer } from "@/lib/types";
import toast from "react-hot-toast";

export default function PerfilPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [profile, setProfile] = useState<(AuthUser & { reviewCount: number }) | null>(null);
  const [userAds, setUserAds] = useState<
    { id: string; titulo: string; tipo: string; categoria: string; status: string; images: string[]; createdAt: string }[]
  >([]);
  const [reviews, setReviews] = useState<ReviewWithReviewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"anuncios" | "avaliacoes">("anuncios");
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const isOwner = user?.id === id;

  // 🎫 Passe do selo (cálculo fora do render)
  const [ativandoSelo, setAtivandoSelo] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [seloInfo, setSeloInfo] = useState<{ dias: number; data: string } | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      backend.getProfileById(id, user?.id),
      backend.listUserAds(id),
      backend.listUserReviews(id),
    ])
      .then(([p, ads, rvs]) => {
        if (!active) return;
        if (!p) {
          router.push("/buscar");
          return;
        }
        setProfile({ ...p, reviewCount: rvs.length });
        setUserAds(ads);
        setReviews(rvs);
      })
      .catch(() => {
        if (active) router.push("/buscar");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, router, user?.id, reloadKey]);

  useEffect(() => {
    if (!profile?.verifiedUntil) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSeloInfo(null);
      return;
    }
    const dias = Math.max(
      1,
      Math.ceil((new Date(profile.verifiedUntil).getTime() - Date.now()) / 864e5)
    );
    setSeloInfo({
      dias,
      data: new Date(profile.verifiedUntil).toLocaleDateString("pt-BR"),
    });
  }, [profile?.verifiedUntil, reloadKey]);

  const handleAtivarSelo = async () => {
    if (!user || !profile) return;
    setAtivandoSelo(true);
    try {
      await backend.activatePlan(user.id, "verificado");
      await refreshUser();
      setReloadKey((k) => k + 1);
      toast.success("Selo ativado! ✅ Válido por 30 dias.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro";
      toast.error(message);
    } finally {
      setAtivandoSelo(false);
    }
  };

  const irParaAvaliacoes = () => {
    setActiveTab("avaliacoes");
    document
      .getElementById("abas-conteudo")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="p-4 animate-pulse">
          <div className="h-48 bg-gray-200 rounded-3xl mb-4" />
          <div className="h-24 bg-gray-200 rounded-2xl mb-4" />
        </div>
      </AppLayout>
    );
  }

  if (!profile) return null;

  // seloAtivo derivado de seloInfo (calculado em efeito, sem impureza)
  const seloAtivo =
    profile.verificado && (!profile.verifiedUntil || !!seloInfo);
  const anunciosAtivos = userAds.filter((a) => a.status === "ativo");

  return (
    <AppLayout wide>
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 lg:py-6 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8 items-start">
        {/* ═══════════ COLUNA ESQUERDA · Card do Usuário (sticky) ═══════════ */}
        <div className="lg:col-span-4 lg:sticky lg:top-20 flex flex-col gap-4">
          {/* Header do perfil com capa gradiente */}
          <div className="bg-gradient-to-r from-purple-900 via-purple-800 to-indigo-950 rounded-3xl overflow-hidden shadow-lg p-6 sm:p-8 text-white relative">
            <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, #fff 1px, transparent 1px), radial-gradient(circle at 80% 70%, #fff 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
            <div className="relative flex flex-col items-center lg:items-start gap-4">
              {/* Avatar com anel dourado quando verificado */}
              <div className={`rounded-full ${seloAtivo ? "ring-4 ring-amber-400/80 ring-offset-2 ring-offset-purple-900" : ""} relative z-10`}>
                <Avatar
                  src={profile.avatarUrl}
                  name={profile.nome}
                  size="xl"
                  className="w-24 h-24 sm:w-28 sm:h-28 !rounded-full border-4 border-white shadow-xl"
                />
                {profile.verificado && (
                  <span className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-blue-500 border-[3px] border-purple-900 flex items-center justify-center shadow-lg z-20">
                    <CheckCircle2 className="w-4.5 h-4.5 w-5 h-5 text-white" />
                  </span>
                )}
              </div>

              {/* Nome + selo oficial */}
              <div className="text-center lg:text-left min-w-0 w-full">
                <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center justify-center lg:justify-start gap-2 flex-wrap leading-tight break-words">
                  {profile.nome}
                  {profile.verificado && (
                    <CheckCircle2 className="w-6 h-6 text-blue-300 flex-shrink-0" />
                  )}
                </h1>
                <div className="flex items-center gap-2 mt-2 justify-center lg:justify-start flex-wrap">
                  <span className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-purple-200">
                    {profile.tipoPerfil === "empreendedor"
                      ? "🏪 Empreendedor"
                      : profile.tipoPerfil === "criador"
                      ? "🎨 Criador"
                      : "⚡ Empreendedor & Criador"}
                  </span>
                  <span className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-purple-200 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {[profile.bairro, profile.cidade].filter(Boolean).join(" · ")}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card de métricas (Trust) */}
          <div className="bg-white rounded-2xl border border-purple-100 p-4 shadow-sm grid grid-cols-3 divide-x divide-purple-100 text-center">
            <button
              onClick={irParaAvaliacoes}
              className="px-1 sm:px-2 hover:bg-purple-50/50 rounded-l-xl transition-colors py-1"
            >
              <p className="text-xl sm:text-2xl font-black text-gray-900 flex items-center justify-center gap-1">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                {(profile.mediaAvaliacao || 0).toFixed(1)}
              </p>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 leading-tight">
                {profile.totalAvaliacoes || 0} avaliações
              </p>
            </button>
            <div className="px-1 sm:px-2 py-1">
              <p className="text-xl sm:text-2xl font-black text-gray-900 flex items-center justify-center gap-1">
                <ThumbsUp className="w-4 h-4 text-emerald-500" />
                {Math.round(profile.aprovacao ?? 100)}%
              </p>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">aprovação</p>
            </div>
            <div className="px-1 sm:px-2 py-1">
              <p className="text-xl sm:text-2xl font-black text-gray-900 flex items-center justify-center gap-1">
                <Handshake className="w-4 h-4 text-purple-500" />
                {profile.trocasConcluidas || 0}
              </p>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 leading-tight">
                trocas concluídas
              </p>
            </div>
          </div>

          {/* 🎫 Passe VIP Verificado (elite) */}
          {isOwner &&
            (seloAtivo ? (
              <div className="bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-amber-500/5 border border-amber-300/60 rounded-2xl p-4 sm:p-5 shadow-sm">
                {/* BLOCO SUPERIOR · ícone + textos (horizontal, anti-esmagamento) */}
                <div className="flex items-start gap-3 w-full mb-3">
                  <span className="bg-amber-100 p-2.5 rounded-xl shrink-0">
                    <ShieldCheck className="w-6 h-6 text-amber-600" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-sm sm:text-base text-gray-900 leading-tight block">
                      Perfil Verificado
                    </p>
                    <p className="text-xs text-emerald-700 font-medium leading-normal mt-0.5 block">
                      Selo de Confiança Ativo · Válido por mais{" "}
                      {seloInfo?.dias ?? 30} dias (até {seloInfo?.data ?? "—"})
                    </p>
                  </div>
                </div>
                {/* BLOCO INFERIOR · botão dourado ultra premium (full width) */}
                <button
                  onClick={handleAtivarSelo}
                  disabled={ativandoSelo}
                  className="w-full bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-500 hover:to-amber-600 text-purple-950 font-black text-xs sm:text-sm py-2.5 px-4 rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 border border-amber-300/60 cursor-pointer disabled:opacity-60"
                >
                  {ativandoSelo ? "Processando PIX..." : "🔄 Estender +30 dias (R$ 29,90)"}
                </button>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-2xl p-4 sm:p-5 flex flex-col items-center text-center gap-3 shadow-sm">
                <p className="text-sm font-black text-amber-900">
                  ⭐ Destaque seu perfil no topo do seu bairro
                </p>
                <button
                  onClick={handleAtivarSelo}
                  disabled={ativandoSelo}
                  className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-xs font-bold px-4 py-2.5 rounded-xl active:scale-95 transition-all disabled:opacity-60"
                >
                  {ativandoSelo
                    ? "Processando PIX..."
                    : "Ativar Selo Verificado por 30 dias • R$ 29,90"}
                </button>
              </div>
            ))}

          {/* Bio + conquistas */}
          {profile.bio && (
            <div className="bg-white rounded-2xl border border-purple-100 p-4 shadow-sm">
              <p className="text-gray-700 text-sm leading-relaxed break-words">
                &quot;{profile.bio}&quot;
              </p>
            </div>
          )}

          {/* Categorias */}
          {profile.categorias && profile.categorias.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {profile.categorias.map((cat) => (
                <Badge key={cat} variant="purple">
                  {cat}
                </Badge>
              ))}
            </div>
          )}

          {/* Pílulas de conquista (Trust Badges) */}
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 bg-white border border-purple-100 rounded-full px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm">
              <Zap className="w-3.5 h-3.5 text-yellow-500" />
              Resposta Rápida
            </span>
            <span className="inline-flex items-center gap-1.5 bg-white border border-purple-100 rounded-full px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm">
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
              {Math.round(profile.aprovacao ?? 100) >= 90
                ? "100% Recomendado"
                : "Bem Recomendado"}
            </span>
            {profile.bairro && (
              <span className="inline-flex items-center gap-1.5 bg-white border border-purple-100 rounded-full px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm">
                <MapPin className="w-3.5 h-3.5 text-purple-500" />
                Morador de {profile.bairro}
              </span>
            )}
          </div>

          {/* Membro desde */}
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Calendar className="w-3.5 h-3.5" />
            <span>
              Membro desde{" "}
              {new Date(profile.createdAt).toLocaleDateString("pt-BR", {
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>

          {/* Ações */}
          {isOwner ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <Link href="/dashboard" className="flex-1">
                <Button variant="primary" fullWidth>
                  ⚙️ Gerenciar Conta
                </Button>
              </Link>
              <Link href="/anuncio/criar" className="flex-1">
                <Button variant="secondary" fullWidth>
                  + Anúncio
                </Button>
              </Link>
            </div>
          ) : (
            user && (
              <Button
                variant="whatsapp"
                fullWidth
                icon={<MessageCircle className="w-5 h-5" />}
                onClick={() =>
                  toast("Combine trocas pelo Chat da Plataforma 🗨️ — o contato direto é liberado após aceite + aprovação mútua.")
                }
              >
                Entrar em contato
              </Button>
            )
          )}
        </div>

        {/* ═══════════ COLUNA DIREITA · Conteúdo ═══════════ */}
        <div className="lg:col-span-8 flex flex-col gap-4" id="abas-conteudo">
          {/* Abas premium */}
          <div className="flex bg-gray-100 rounded-2xl p-1.5 sticky top-[4.5rem] z-10 shadow-sm">
            <button
              onClick={() => setActiveTab("anuncios")}
              className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${
                activeTab === "anuncios"
                  ? "bg-white text-purple-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              📢 Anúncios Ativos ({anunciosAtivos.length})
            </button>
            <button
              onClick={() => setActiveTab("avaliacoes")}
              className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${
                activeTab === "avaliacoes"
                  ? "bg-white text-purple-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              ⭐ Avaliações ({reviews.length})
            </button>
          </div>

          {/* ── Aba Anúncios ── */}
          {activeTab === "anuncios" && (
            <div className="flex flex-col gap-3">
              {anunciosAtivos.map((ad) => (
                <Link key={ad.id} href={`/anuncio/${ad.id}`}>
                  <div className="bg-white rounded-2xl border border-purple-100 overflow-hidden shadow-sm flex gap-3 p-3 hover:shadow-md transition-shadow">
                    {ad.images?.[0] ? (
                      <img
                        src={ad.images[0]}
                        alt={ad.titulo}
                        className="w-20 h-20 object-cover rounded-xl flex-shrink-0"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
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
                        <span className="text-xs text-gray-400 truncate">
                          {ad.categoria}
                        </span>
                      </div>
                      <p className="font-semibold text-gray-900 text-sm truncate">
                        {ad.titulo}
                      </p>
                      <p className="text-xs text-gray-500">{timeAgo(ad.createdAt)}</p>
                    </div>
                  </div>
                </Link>
              ))}
              {anunciosAtivos.length === 0 && (
                <div className="text-center py-12 bg-white rounded-2xl border border-purple-100 shadow-sm">
                  <div className="text-4xl mb-3">📭</div>
                  <p className="text-gray-500 text-sm">
                    {isOwner
                      ? "Você não tem anúncios ativos"
                      : "Nenhum anúncio ativo"}
                  </p>
                  {isOwner && (
                    <Link href="/anuncio/criar">
                      <Button className="mt-3" size="sm">
                        Criar anúncio
                      </Button>
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Aba Avaliações ── */}
          {activeTab === "avaliacoes" && (
            <div className="flex flex-col gap-3">
              {reviews.length > 0 && (
                <div className="bg-white rounded-2xl border border-purple-100 p-4 shadow-sm flex items-center gap-4 mb-1">
                  <div className="text-center flex-shrink-0">
                    <span className="text-4xl font-black text-gray-900">
                      {(profile.mediaAvaliacao || 0).toFixed(1)}
                    </span>
                    <StarRating
                      rating={Math.round(profile.mediaAvaliacao || 0)}
                      size="md"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {reviews.length} avaliações ·{" "}
                      {Math.round(profile.aprovacao)}% aprovação
                    </p>
                  </div>
                  <div className="flex-1">
                    {[5, 4, 3, 2, 1].map((star) => {
                      const count = reviews.filter((r) => r.nota === star).length;
                      const pct =
                        reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                      return (
                        <div key={star} className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-gray-500 w-3">{star}</span>
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-yellow-400 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400 w-4">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="bg-white rounded-2xl border border-purple-100 p-4 shadow-sm"
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <Avatar
                      src={review.avaliadorAvatar}
                      name={review.avaliadorNome}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/perfil/${review.avaliadorId}`}
                        className="text-sm font-bold text-gray-900 hover:text-purple-700 truncate block"
                      >
                        {review.avaliadorNome}
                      </Link>
                      <div className="flex items-center gap-2">
                        <StarRating rating={review.nota} size="sm" />
                        <span className="text-xs text-gray-400">
                          {timeAgo(review.createdAt)}
                        </span>
                      </div>
                    </div>
                    <Badge
                      variant={
                        review.cumprimento === "sim"
                          ? "green"
                          : review.cumprimento === "parcialmente"
                          ? "yellow"
                          : "red"
                      }
                    >
                      {review.cumprimento === "sim"
                        ? "✓ Cumpriu o combinado"
                        : review.cumprimento === "parcialmente"
                        ? "~ Parcialmente"
                        : "✗ Não cumpriu"}
                    </Badge>
                  </div>
                  {review.comentario && (
                    <p className="text-sm text-gray-600 leading-relaxed break-words">
                      {review.comentario}
                    </p>
                  )}
                </div>
              ))}

              {reviews.length === 0 && (
                <div className="text-center py-12 bg-white rounded-2xl border border-purple-100 shadow-sm">
                  <div className="text-4xl mb-3">⭐</div>
                  <p className="text-gray-500 text-sm">
                    Ainda sem avaliações — seja a primeira troca!
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
