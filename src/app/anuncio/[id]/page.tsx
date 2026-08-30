"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  Repeat2,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Eye,
  Lock,
  Share2,
  Flag,
  Utensils,
  Scissors,
  Palette,
  GraduationCap,
  Camera,
  Laptop,
  Megaphone,
  Shirt,
  Music,
  Heart,
  Home,
  ShoppingBag,
  Video,
  Store,
} from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import StarRating from "@/components/ui/StarRating";
import VerifiedBadge from "@/components/ui/VerifiedBadge";
import AdThumb from "@/components/ads/AdThumb";
import { useAuth } from "@/contexts/AuthContext";
import { generateWhatsAppLink, timeAgo } from "@/lib/utils";
import toast from "react-hot-toast";
import AppLayout from "@/components/layout/AppLayout";
import * as backend from "@/lib/backend";
import type { AdDetail, Trade } from "@/lib/types";

// [UX] Ícones dinâmicos por categoria para placeholders
function getCategoryIcon(categoria: string) {
  const c = (categoria || "").toLowerCase();
  if (c.includes("aliment")) return Utensils;
  if (c.includes("beleza") || c.includes("estética")) return Scissors;
  if (c.includes("design") || c.includes("arte")) return Palette;
  if (c.includes("educa")) return GraduationCap;
  if (c.includes("evento")) return Calendar;
  if (c.includes("foto")) return Camera;
  if (c.includes("informática") || c.includes(" ti") || c.includes("tecnologia")) return Laptop;
  if (c.includes("marketing")) return Megaphone;
  if (c.includes("moda") || c.includes("costura")) return Shirt;
  if (c.includes("música") || c.includes("musica")) return Music;
  if (c.includes("saúde") || c.includes("bem-estar") || c.includes("saude")) return Heart;
  if (c.includes("doméstico") || c.includes("domestico") || c.includes("serviço")) return Home;
  if (c.includes("vendas") || c.includes("comércio") || c.includes("comercio")) return ShoppingBag;
  if (c.includes("vídeo") || c.includes("video") || c.includes("produção") || c.includes("producao")) return Video;
  return Store;
}

export default function AdDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [ad, setAd] = useState<AdDetail | null>(null);
  const [currentImage, setCurrentImage] = useState(0);
  const [interestLoading, setInterestLoading] = useState(false);
  const [myTrade, setMyTrade] = useState<Trade | null>(null);
  const [currentUrl, setCurrentUrl] = useState("");
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentUrl(window.location.href);
    }
  }, []);

  // [PROD-FIX] Timeout com retry: em rede lenta o getAdById faz vários
  // round-trips no Supabase; antes, o timeout de 9s mandava o usuário
  // DIRETO para /buscar (navegação quebrada) mesmo com o anúncio
  // existindo. Agora: timeout → retry uma vez → ainda assim, skeleton
  // (NUNCA redirect por timeout). Redirect só quando o anúncio
  // definitivamente não existe (getAdById resolve com null).
  const [fetchState, setFetchState] = useState<"loading" | "not_found" | "error">("loading");
  useEffect(() => {
    let cancelled = false;
    let retried = false;

    const attempt = (isRetry: boolean) => {
      const timeoutMs = isRetry ? 15000 : 12000;
      const timeout = new Promise<"timeout">((resolve) =>
        setTimeout(() => resolve("timeout"), timeoutMs)
      );
      Promise.race([backend.getAdById(id), timeout])
        .then((data) => {
          if (cancelled) return;
          if (data === "timeout") {
            if (!retried) {
              retried = true;
              attempt(true);
            }
            // retry esgotado: mantém skeleton (o usuário ainda consegue
            // voltar com o botão; sem redirect forçado)
            return;
          }
          if (!data) {
            setFetchState("not_found");
            router.push("/buscar");
          } else {
            setAd(data);
            setFetchState("loading");
          }
        })
        .catch(() => {
          if (cancelled) return;
          setFetchState("error");
        });
    };

    attempt(false);
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  // [REALTIME] Atualiza detalhe instantâneo quando ad muda (mesma aba ou outra)
  useEffect(() => {
    const handler = (e: any) => {
      const detail = e?.detail || {};
      if ((detail.entity === 'ad' && detail.id === id) || detail.entity === 'db') {
        backend.getAdById(id).then((data) => { if (data) setAd(data); }).catch(() => {});
      }
    };
    window.addEventListener('trocabairro:store' as any, handler);
    const storageHandler = (ev: StorageEvent) => {
      if (ev.key === 'trocabairro:demo:signal') {
        backend.getAdById(id).then((data) => { if (data) setAd(data); }).catch(() => {});
      }
    };
    window.addEventListener('storage', storageHandler);
    return () => {
      window.removeEventListener('trocabairro:store' as any, handler);
      window.removeEventListener('storage', storageHandler);
    };
  }, [id]);

  // Minha negociação com o anunciante (solicitação → aceite)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    backend
      .listTrades(user.id, "todas")
      .then((trades) => {
        if (cancelled) return;
        const aberta = trades
          .filter((t) => t.adId === id)
          .find((t) =>
            [
              "pending",
              "accepted",
              "in_progress",
              "completed",
              "awaiting_reviews",
              "finished",
            ].includes(t.status)
          );
        setMyTrade(aberta ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, id]);

  const handleProposeTrade = async () => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (user.id === ad?.userId) {
      toast.error("Este é o seu próprio anúncio");
      return;
    }

    setInterestLoading(true);
    try {
      const message = `Olá! Vi seu anúncio "${ad?.titulo}" no TrocaES e tenho interesse na troca.`;
      // 1) pending criado · 2) botão muda na hora · 3) FICA nesta tela
      const trade = await backend.proposeTrade(user.id, id, message);
      setMyTrade(trade);
      toast.success(
        "Solicitação enviada! ⏳ Use o Chat da Plataforma para combinar enquanto o anunciante avalia."
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao propor troca";
      toast.error(message);
    } finally {
      setInterestLoading(false);
    }
  };

  // 🛡️ DUPLO ESCUDO: o WhatsApp só existe com consentimento aprovado
  // (opt-in) dentro da troca — aceitar libera apenas o Chat da Plataforma.
  const whatsappLiberado = myTrade?.whatsappShareStatus === "approved";

  const handleWhatsApp = async () => {
    if (!user || !myTrade) return;
    // Contato só existe via consentimento aprovado (get_trade_contact)
    const contato = await backend.getWhatsappContact(user.id, myTrade.id);
    if (!contato) {
      toast.error("Contato ainda não autorizado nesta troca.");
      return;
    }
    const msg = `Olá! Sobre nossa troca do anúncio \"${ad?.titulo}\" no TrocaES — vamos combinar os detalhes?`;
    window.open(generateWhatsAppLink(contato, msg), "_blank");
  };

  if (!ad) {
    // [PROD-FIX] Erro de rede (não timeout): mostra tela amigável com
    // ação de voltar — antes redirecionava para /buscar sem aviso
    if (fetchState === "error") {
      return (
        <AppLayout showNav={false} showHeader={false}>
          <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 text-center">
            <div className="text-5xl mb-4">📡</div>
            <h2 className="font-bold text-gray-900 text-lg mb-2">
              Não conseguimos carregar este anúncio
            </h2>
            <p className="text-gray-500 text-sm mb-6">
              Verifique sua conexão e tente novamente em instantes.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => router.push("/buscar")}
                className="px-5 py-3 bg-purple-700 text-white font-bold text-sm rounded-2xl hover:bg-purple-800 transition-colors"
              >
                Ver anúncios
              </button>
              <button
                onClick={() => router.back()}
                className="px-5 py-3 bg-white border-2 border-gray-200 text-gray-700 font-bold text-sm rounded-2xl hover:border-purple-400 transition-colors"
              >
                Voltar
              </button>
            </div>
          </div>
        </AppLayout>
      );
    }
    return (
      <AppLayout showNav={false} showHeader={false}>
        <div className="animate-pulse">
          <div className="aspect-[4/3] bg-gray-200" />
          <div className="p-4 flex flex-col gap-3">
            <div className="h-6 bg-gray-200 rounded w-3/4" />
            <div className="h-4 bg-gray-200 rounded" />
            <div className="h-4 bg-gray-200 rounded w-5/6" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!ad) return null;

  const isOwner = user?.id === ad.userId;

  return (
    <AppLayout showHeader={false} showNav={false}>
      {/* Back button over image */}
      <div className="relative">
        {/* Image Carousel */}
        <div className="relative aspect-[4/3] bg-gray-100">
          {ad.images && ad.images.length > 0 && (ad.images[currentImage]?.startsWith('data:image/') || ad.images[currentImage]?.startsWith('https://') || ad.images[currentImage]?.startsWith('http://')) ? (
            <>
              <img
                src={ad.images[currentImage]}
                alt={ad.titulo}
                className="w-full h-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display='none'; }}
              />
              {ad.images.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentImage((p) => Math.max(0, p - 1))}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/40 rounded-full flex items-center justify-center text-white"
                    disabled={currentImage === 0}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() =>
                      setCurrentImage((p) =>
                        Math.min(ad.images.length - 1, p + 1)
                      )
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/40 rounded-full flex items-center justify-center text-white"
                    disabled={currentImage === ad.images.length - 1}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {ad.images.map((_, i) => (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-full transition-all ${
                          i === currentImage ? "bg-white" : "bg-white/50"
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-purple-100 to-purple-200 gap-3">
              {(() => {
                const IconCat = getCategoryIcon(ad.categoria);
                return <IconCat className="w-16 h-16 text-purple-400" />;
              })()}
              <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider">
                {ad.categoria}
              </span>
            </div>
          )}

          {/* Top overlay buttons */}
          <div className="absolute top-4 left-4 right-4 flex justify-between">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 bg-black/50 backdrop-blur rounded-full flex items-center justify-center text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex gap-2">
              <span
                className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                  ad.tipo === "ofereço"
                    ? "bg-purple-700 text-white"
                    : "bg-blue-600 text-white"
                }`}
              >
                {ad.tipo === "ofereço" ? "OFEREÇO" : "PRECISO"}
              </span>
              {(ad.destaque || ad.topoFeed) && (
                <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-yellow-400 text-gray-900">
                  ⭐ DESTAQUE
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content — blindado contra textos gigantes sem espaço */}
      <div className="px-4 py-4 pb-40 min-w-0 max-w-full overflow-hidden overflow-x-hidden">
        {/* Title & Category */}
        <p className="text-sm text-purple-600 font-semibold mb-1">{ad.categoria}</p>
        <h1 className="text-xl font-black text-gray-900 mb-2 break-all break-words max-w-full overflow-hidden leading-snug">
          {ad.titulo}
        </h1>

        <div className="flex items-center gap-3 text-sm text-gray-500 mb-4">
          <div className="flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            <span>
              {ad.bairro} · {ad.cidade}/{ad.uf}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Eye className="w-4 h-4" />
            <span>{ad.visualizacoes} views</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            <span>{timeAgo(ad.createdAt)}</span>
          </div>
        </div>

        {/* Aceita em troca */}
        <div className="bg-green-50 border border-green-200 rounded-2xl p-3 mb-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Repeat2 className="w-5 h-5 text-green-700" />
          </div>
          <div>
            <p className="text-xs text-green-700 font-semibold uppercase">
              Aceita em troca
            </p>
            <p className="text-sm font-bold text-gray-900 break-all break-words max-w-full overflow-hidden min-w-0">
              {ad.aceitaEmTroca}
            </p>
          </div>
        </div>

        {/* Description */}
        <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-2">Descrição</h2>
          <p className="text-gray-700 text-sm leading-relaxed break-all break-words max-w-full overflow-hidden">
            {ad.descricao}
          </p>

          {/* Compartilhamento Viral + Moderação */}
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
            <a
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                `Veja este anúncio no TrocaES: ${ad.titulo} - ${currentUrl || (typeof window !== "undefined" ? window.location.href : "")}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-semibold text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100 px-3 py-2 rounded-xl transition-colors"
            >
              <Share2 className="w-4 h-4" />
              Compartilhar no WhatsApp
            </a>
            <button
              onClick={async () => {
                try {
                  if (user) {
                    await backend.createReport(id, user.id, "Denúncia da comunidade", "Denunciado via página do anúncio");
                  }
                  toast.success("Obrigado! Nossa equipe de moderação analisará este conteúdo.");
                } catch {
                  toast.success("Obrigado! Nossa equipe de moderação analisará este conteúdo.");
                }
              }}
              className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              <Flag className="w-3.5 h-3.5" />
              Denunciar anúncio
            </button>
          </div>
        </div>

        {/* User profile */}
        <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-3">Quem anuncia</h2>
          <Link href={`/perfil/${ad.userId}`} className="flex items-center gap-3">
            <Avatar src={ad.userAvatar} name={ad.userName} size="lg" />
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-gray-900">{ad.userName}</span>
                <VerifiedBadge isVerified={ad.userVerificado} isPartner={(ad as any).userIsPartner} size="md" />
              </div>
              <div className="flex items-center gap-1 mb-1">
                <StarRating rating={Math.round(ad.userMediaAvaliacao)} size="sm" />
                <span className="text-sm text-gray-600">
                  {(ad.userMediaAvaliacao || 0).toFixed(1)} ·{" "}
                  {ad.userTrocasConcluidas} trocas
                </span>
              </div>
              {ad.userBairro && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-gray-500">{ad.userBairro}</span>
                </div>
              )}
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </Link>

          {ad.userBio && (
            <p className="text-sm text-gray-600 mt-3 pt-3 border-t border-gray-100">
              &quot;{ad.userBio}&quot;
            </p>
          )}
        </div>

        {/* Reviews */}
        {ad.reviews && ad.reviews.length > 0 && (
          <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
            <h2 className="font-bold text-gray-900 mb-3">
              Avaliações ({ad.reviews.length})
            </h2>
            <div className="flex flex-col gap-3">
              {ad.reviews.map((review) => (
                <div key={review.id} className="border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar
                      src={review.avaliadorAvatar}
                      name={review.avaliadorNome}
                      size="sm"
                    />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {review.avaliadorNome}
                      </p>
                      <StarRating rating={review.nota} size="sm" />
                    </div>
                    <span className="ml-auto text-xs text-gray-400">
                      {timeAgo(review.createdAt)}
                    </span>
                  </div>
                  {review.comentario && (
                    <p className="text-sm text-gray-600 ml-10">
                      {review.comentario}
                    </p>
                  )}
                  <div className="ml-10 mt-1">
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
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fixed bottom actions */}
      {!isOwner && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 shadow-lg">
          <div className="max-w-lg mx-auto flex gap-3">
            {!user ? (
              <Button
                onClick={() => router.push("/login")}
                className="flex-1"
                size="lg"
                variant="secondary"
                icon={<Lock className="w-5 h-5" />}
              >
                Entre para ver o contato
              </Button>
            ) : myTrade ? (
              <>
                {myTrade.status === "pending" ? (
                  <div className="flex-1 py-4 rounded-2xl bg-yellow-50 border-2 border-yellow-300 text-yellow-800 font-bold text-center text-sm">
                    Solicitação enviada ⏳
                  </div>
                ) : (
                  <Link
                    href={`/trocas/${myTrade.id}/chat`}
                    className="flex-1 bg-purple-700 hover:bg-purple-800 text-white font-bold text-sm py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    <MessageCircle className="w-5 h-5" />
                    💬 Chat da Plataforma
                  </Link>
                )}
                {whatsappLiberado ? (
                  <button
                    onClick={handleWhatsApp}
                    className="w-14 bg-green-500 hover:bg-green-600 text-white rounded-2xl flex items-center justify-center active:scale-95 transition-all"
                    title="WhatsApp liberado — troca aceita"
                  >
                    <MessageCircle className="w-6 h-6" />
                  </button>
                ) : (
                  myTrade.status === "pending" && (
                    <Link
                      href={`/trocas/${myTrade.id}/chat`}
                      className="w-14 bg-purple-700 hover:bg-purple-800 text-white rounded-2xl flex items-center justify-center active:scale-95 transition-all"
                      title="Chat da plataforma"
                    >
                      <MessageCircle className="w-6 h-6" />
                    </Link>
                  )
                )}
              </>
            ) : (
              <>
                <Button
                  onClick={handleProposeTrade}
                  loading={interestLoading}
                  className="flex-1"
                  size="lg"
                >
                  Propor troca 🤝
                </Button>
                <Button
                  variant="outline"
                  onClick={handleProposeTrade}
                  className="flex-1"
                  size="lg"
                  icon={<MessageCircle className="w-5 h-5" />}
                >
                  Conversar pelo Chat
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {isOwner && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 shadow-lg">
          <div className="max-w-lg mx-auto flex gap-3">
            <Link href={`/anuncio/editar/${ad.id}`} className="flex-1">
              <Button variant="outline" fullWidth size="lg">
                Editar
              </Button>
            </Link>
            <Link href="/dashboard" className="flex-1">
              <Button fullWidth size="lg">
                Meu Perfil
              </Button>
            </Link>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
