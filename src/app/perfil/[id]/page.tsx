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
import VerifiedBadge from "@/components/ui/VerifiedBadge";
import AdThumb from "@/components/ads/AdThumb";
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
  // Slim Partner: cover upload + remove
  const [uploadingCover, setUploadingCover] = useState(false);
  const [removingCover, setRemovingCover] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

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

  // [REALTIME] DEMO: escuta mudanças no store (mesma aba + cross-tab) para atualização instantânea
  useEffect(() => {
    const handler = (e: any) => {
      const detail = e?.detail || {};
      // Se for perfil ou ads, recarrega
      if (detail.entity === 'profile' && detail.id === id) {
        setReloadKey((k) => k + 1);
      } else if (detail.entity === 'ad' || detail.entity === 'db') {
        setReloadKey((k) => k + 1);
      }
    };
    window.addEventListener('trocabairro:store' as any, handler);
    const storageHandler = (ev: StorageEvent) => {
      if (ev.key === 'trocabairro:demo:db' || ev.key === 'trocabairro:demo:signal') {
        setReloadKey((k) => k + 1);
      }
    };
    window.addEventListener('storage', storageHandler);
    return () => {
      window.removeEventListener('trocabairro:store' as any, handler);
      window.removeEventListener('storage', storageHandler);
    };
  }, [id]);

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

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !profile) return;
    if (!(profile as any).isPartner) {
      toast.error("Apenas parceiros podem ter foto de capa");
      return;
    }
    setUploadingCover(true);
    try {
      const res = await backend.uploadCoverWithCleanup(file, user.id);
      if (!res.success) throw new Error(res.error || "Falha no upload");
      await backend.updateProfile(user.id, { coverUrl: res.url, coverPath: res.path });
      setCoverPreview(res.url);
      // [REALTIME] Atualiza na hora + persiste
      setReloadKey((k) => k + 1);
      await refreshUser();
      toast.success("Capa atualizada!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar capa";
      toast.error(msg);
    } finally {
      setUploadingCover(false);
      // limpa input
      e.target.value = "";
    }
  };

  const handleRemoveCover = async () => {
    if (!user || !profile) return;
    if (!confirm("Remover foto de capa?")) return;
    setRemovingCover(true);
    try {
      const res = await backend.removeCover(user.id);
      if (!res.success) throw new Error(res.error || "Falha ao remover");
      setCoverPreview(null);
      setReloadKey((k) => k + 1);
      await refreshUser();
      toast.success("Capa removida");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao remover capa";
      toast.error(msg);
    } finally {
      setRemovingCover(false);
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
          {/* Header do perfil - slim partner com capa se parceiro */}
          <div className="rounded-3xl overflow-hidden shadow-lg relative text-white">
            {(profile as any).isPartner && ((profile as any).coverUrl || coverPreview) ? (
              <div className="absolute inset-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverPreview || (profile as any).coverUrl} alt="Capa" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-r from-purple-900/80 via-purple-800/70 to-indigo-950/80" />
              </div>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-r from-purple-900 via-purple-800 to-indigo-950" />
            )}
            <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, #fff 1px, transparent 1px), radial-gradient(circle at 80% 70%, #fff 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
            <div className="relative p-6 sm:p-8 flex flex-col items-center lg:items-start gap-4">
              {/* Avatar - design limpo original, sem anéis duplos ou coroas */}
              <div className="rounded-full relative z-10">
                <Avatar
                  src={profile.avatarUrl}
                  name={profile.nome}
                  size="xl"
                  className="w-24 h-24 sm:w-28 sm:h-28 !rounded-full border-4 border-white shadow-xl"
                />
              </div>

              {/* Nome + checkmark único slim */}
              <div className="text-center lg:text-left min-w-0 w-full">
                <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center justify-center lg:justify-start gap-2 flex-wrap leading-tight break-words">
                  {profile.nome}
                  <VerifiedBadge isVerified={profile.verificado} isPartner={(profile as any).isPartner} size="lg" />
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
                  {(profile as any).isPartner && (
                    <span className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-yellow-200 flex items-center gap-1">
                      ♾️ Ilimitado
                    </span>
                  )}
                </div>
              </div>
              {isOwner && (profile as any).isPartner && (
                <div className="mt-3 w-full flex justify-center lg:justify-start gap-2 flex-wrap">
                  <label className="cursor-pointer inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold text-white border border-white/20 transition-colors">
                    <input type="file" accept="image/*" className="hidden" onChange={handleCoverChange} disabled={uploadingCover || removingCover} />
                    {uploadingCover ? "Enviando..." : (profile as any).coverUrl || coverPreview ? "📸 Trocar capa" : "📸 Adicionar capa"}
                  </label>
                  {((profile as any).coverUrl || coverPreview) && (
                    <button
                      onClick={handleRemoveCover}
                      disabled={uploadingCover || removingCover}
                      className="inline-flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold text-white border border-red-300/30 transition-colors disabled:opacity-60"
                    >
                      {removingCover ? "Removendo..." : "🗑️ Remover capa"}
                    </button>
                  )}
                </div>
              )}
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

          {/* 🎫 Lógica de Monetização Inteligente - corrige bug parceiro */}
          {isOwner && (
            (profile as any).isPartner ? (
              /* CENÁRIO B - Parceiro Oficial Gold: NÃO vende selo azul, mostra benefícios */
              <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-300 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2.5 mb-2">
                  <span className="bg-amber-100 border border-amber-200 p-2 rounded-xl text-amber-700 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" />
                  </span>
                  <div>
                    <p className="text-sm font-black text-amber-900 leading-tight">🟡 Parceiro Oficial</p>
                    <p className="text-xs text-amber-800 font-medium">Benefícios e Trocas Ilimitadas Ativas ♾️</p>
                  </div>
                </div>
                <div className="bg-white/70 rounded-xl p-2.5 mt-2">
                  <p className="text-[11px] text-amber-900 font-semibold flex items-center gap-1.5">
                    <span>✅</span> Foto de capa personalizada
                  </p>
                  <p className="text-[11px] text-amber-900 font-semibold flex items-center gap-1.5 mt-1">
                    <span>♾️</span> Negociações ilimitadas por mês
                  </p>
                  <p className="text-[11px] text-amber-900 font-semibold flex items-center gap-1.5 mt-1">
                    <span>⭐</span> Selo dourado oficial em todo o app
                  </p>
                </div>
              </div>
            ) : seloAtivo ? (
              /* CENÁRIO C - Verificado Azul Pago: status ativo + estender */
              <div className="bg-gradient-to-br from-amber-50/60 via-purple-50/20 to-white rounded-2xl border border-amber-300/80 p-4 sm:p-5 shadow-sm relative overflow-hidden">
                <div className="flex items-start gap-3 w-full mb-3">
                  <span className="bg-amber-100/80 border border-amber-200/80 p-2.5 rounded-xl shrink-0 text-amber-700 flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sm:text-base font-black text-purple-950 leading-tight">
                      Perfil Verificado
                    </p>
                    <p className="text-xs text-gray-700 font-medium leading-normal mt-0.5">
                      Selo de Confiança Ativo · Válido por{" "}
                      <strong className="font-extrabold text-amber-900">
                        mais {seloInfo?.dias ?? 30} dias
                      </strong>{" "}
                      <span className="font-bold text-gray-500">
                        (até {seloInfo?.data ?? "—"})
                      </span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleAtivarSelo}
                  disabled={ativandoSelo}
                  className="w-full bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-500 hover:to-amber-600 text-purple-950 font-black text-xs sm:text-sm py-2.5 px-4 rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 border border-amber-300/60 cursor-pointer disabled:opacity-60"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-4 h-4 sm:w-[18px] sm:h-[18px] shrink-0"
                  >
                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                    <path d="M16 16h5v5" />
                  </svg>
                  {ativandoSelo ? "Processando PIX..." : "Estender +30 dias (R$ 29,90)"}
                </button>
              </div>
            ) : (
              /* CENÁRIO A - Usuário Comum sem selo: card promocional */
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
            )
          )}

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
                    <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-purple-100">
                      <AdThumb
                        url={ad.images?.[0]}
                        category={ad.categoria}
                        alt={ad.titulo}
                        className="w-full h-full object-cover"
                      />
                    </div>
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
