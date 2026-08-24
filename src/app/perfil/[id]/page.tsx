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
  Lock,
  Handshake,
} from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import StarRating from "@/components/ui/StarRating";
import Button from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { generateWhatsAppLink, timeAgo } from "@/lib/utils";
import AppLayout from "@/components/layout/AppLayout";
import * as backend from "@/lib/backend";
import type { AuthUser, ReviewWithReviewer } from "@/lib/types";
import type { UserAd } from "@/lib/backend";

export default function PerfilPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [profile, setProfile] = useState<(AuthUser & { reviewCount: number }) | null>(null);
  const [userAds, setUserAds] = useState<UserAd[]>([]);
  const [reviews, setReviews] = useState<ReviewWithReviewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"anuncios" | "avaliacoes">("anuncios");
  const { user } = useAuth();
  const router = useRouter();

  const isOwner = user?.id === id;

  useEffect(() => {
    let active = true;
    Promise.all([
      backend.getProfileById(id),
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
  }, [id, router]);

  const handleWhatsApp = () => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (!profile?.whatsapp) return;
    const msg = `Olá! Encontrei seu perfil no TrocaBairro. Gostaria de saber mais sobre seus serviços!`;
    const link = generateWhatsAppLink(profile.whatsapp, msg);
    window.open(link, "_blank");
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="p-4 animate-pulse">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 bg-gray-200 rounded-full" />
            <div className="flex-1">
              <div className="h-5 bg-gray-200 rounded mb-2" />
              <div className="h-4 bg-gray-200 rounded w-2/3" />
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!profile) return null;

  return (
    <AppLayout>
      {/* Capa roxa */}
      <div className="bg-gradient-to-br from-purple-800 to-purple-900 px-4 pt-4 pb-16">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          {isOwner && (
            <Link
              href="/perfil/editar"
              className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center"
            >
              <Edit3 className="w-5 h-5 text-white" />
            </Link>
          )}
        </div>

        <div className="flex flex-col items-center text-center">
          <div className="relative">
            <Avatar src={profile.avatarUrl} name={profile.nome} size="xl" />
            {profile.verificado && (
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white">
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
              </div>
            )}
          </div>

          <h1 className="text-xl font-black text-white mt-3 mb-1">
            {profile.nome}
          </h1>

          <div className="flex items-center gap-1.5 mb-2">
            <Badge variant="purple" size="sm">
              {profile.tipoPerfil === "empreendedor"
                ? "🏪 Empreendedor"
                : profile.tipoPerfil === "criador"
                ? "🎨 Criador"
                : "⚡ Ambos"}
            </Badge>
            {profile.verificado && (
              <Badge variant="blue" size="sm">
                ✓ Verificado
              </Badge>
            )}
          </div>

          {(profile.bairro || profile.cidade) && (
            <div className="flex items-center gap-1 text-purple-200 text-sm">
              <MapPin className="w-3 h-3" />
              <span>
                {[profile.bairro, profile.cidade, profile.uf]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Reputação pública */}
      <div className="px-4 -mt-8 mb-4">
        <div className="bg-white rounded-2xl shadow-md p-4">
          <div className="grid grid-cols-3 divide-x divide-gray-100">
            <div className="text-center px-2">
              <div className="flex items-center justify-center gap-1">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span className="font-black text-gray-900 text-lg">
                  {(profile.mediaAvaliacao || 0).toFixed(1)}
                </span>
              </div>
              <StarRating rating={Math.round(profile.mediaAvaliacao)} size="sm" />
              <p className="text-xs text-gray-500 mt-0.5">
                {profile.totalAvaliacoes || profile.reviewCount || 0} avaliações
              </p>
            </div>
            <div className="text-center px-2">
              <div className="flex items-center justify-center gap-1">
                <ThumbsUp className="w-4 h-4 text-green-600" />
                <span className="font-black text-gray-900 text-lg">
                  {Math.round(profile.aprovacao ?? 100)}%
                </span>
              </div>
              <p className="text-xs text-green-600 font-semibold mt-0.5">
                aprovação
              </p>
              <p className="text-xs text-gray-500">
                positivas ÷ total × 100
              </p>
            </div>
            <div className="text-center px-2">
              <div className="flex items-center justify-center gap-1">
                <Handshake className="w-4 h-4 text-purple-600" />
                <span className="font-black text-gray-900 text-lg">
                  {profile.trocasConcluidas || 0}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">trocas concluídas</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4">
        {/* Bio */}
        {profile.bio && (
          <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
            <p className="text-gray-700 text-sm leading-relaxed">
              &quot;{profile.bio}&quot;
            </p>
          </div>
        )}

        {/* Categories */}
        {profile.categorias && profile.categorias.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {profile.categorias.map((cat) => (
              <Badge key={cat} variant="purple">
                {cat}
              </Badge>
            ))}
          </div>
        )}

        {/* Member since */}
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
          <Calendar className="w-3.5 h-3.5" />
          <span>
            Membro desde{" "}
            {new Date(profile.createdAt).toLocaleDateString("pt-BR", {
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>

        {/* Action buttons — WhatsApp apenas para autenticados */}
        {!isOwner && user && (
          <div className="flex gap-3 mb-6">
            <Button
              variant="whatsapp"
              onClick={handleWhatsApp}
              fullWidth
              icon={<MessageCircle className="w-5 h-5" />}
            >
              WhatsApp
            </Button>
          </div>
        )}
        {!isOwner && !user && (
          <Link href="/login" className="block mb-6">
            <div className="w-full py-4 rounded-2xl bg-gray-100 border-2 border-dashed border-gray-300 text-gray-500 font-semibold flex items-center justify-center gap-2">
              <Lock className="w-4 h-4" />
              Entre para ver o WhatsApp de {profile.nome.split(" ")[0]}
            </div>
          </Link>
        )}

        {isOwner && (
          <div className="flex gap-3 mb-6">
            <Link href="/dashboard" className="flex-1">
              <Button variant="primary" fullWidth>
                Meu Painel
              </Button>
            </Link>
            <Link href="/anuncio/criar" className="flex-1">
              <Button variant="secondary" fullWidth>
                + Anúncio
              </Button>
            </Link>
          </div>
        )}

        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-2xl p-1 mb-4">
          <button
            onClick={() => setActiveTab("anuncios")}
            className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all ${
              activeTab === "anuncios"
                ? "bg-white text-purple-700 shadow-sm"
                : "text-gray-600"
            }`}
          >
            Anúncios ({userAds.filter((a) => a.status === "ativo").length})
          </button>
          <button
            onClick={() => setActiveTab("avaliacoes")}
            className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all ${
              activeTab === "avaliacoes"
                ? "bg-white text-purple-700 shadow-sm"
                : "text-gray-600"
            }`}
          >
            Avaliações ({reviews.length})
          </button>
        </div>

        {/* Ads tab */}
        {activeTab === "anuncios" && (
          <div className="flex flex-col gap-3">
            {userAds
              .filter((a) => a.status === "ativo")
              .map((ad) => (
                <Link key={ad.id} href={`/anuncio/${ad.id}`}>
                  <div className="bg-white rounded-2xl overflow-hidden shadow-sm flex gap-3 p-3 active:bg-gray-50">
                    {ad.images[0] ? (
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
                        <span className="text-xs text-gray-400">{ad.categoria}</span>
                      </div>
                      <p className="font-semibold text-gray-900 text-sm truncate">
                        {ad.titulo}
                      </p>
                      <p className="text-xs text-gray-500">{timeAgo(ad.createdAt)}</p>
                    </div>
                  </div>
                </Link>
              ))}

            {userAds.filter((a) => a.status === "ativo").length === 0 && (
              <div className="text-center py-10">
                <div className="text-4xl mb-3">📭</div>
                <p className="text-gray-500 text-sm">
                  {isOwner ? "Você não tem anúncios ativos" : "Nenhum anúncio ativo"}
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

        {/* Reviews tab */}
        {activeTab === "avaliacoes" && (
          <div className="flex flex-col gap-3">
            {reviews.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4 mb-2">
                <div className="text-center">
                  <span className="text-4xl font-black text-gray-900">
                    {(profile.mediaAvaliacao || 0).toFixed(1)}
                  </span>
                  <StarRating
                    rating={Math.round(profile.mediaAvaliacao || 0)}
                    size="md"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {reviews.length} avaliações · {Math.round(profile.aprovacao)}%
                    aprovação
                  </p>
                </div>
                <div className="flex-1">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = reviews.filter((r) => r.nota === star).length;
                    const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
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
              <div key={review.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Avatar
                    src={review.avaliadorAvatar}
                    name={review.avaliadorNome}
                    size="sm"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">
                      {review.avaliadorNome}
                    </p>
                    <div className="flex items-center gap-2">
                      <StarRating rating={review.nota} size="sm" />
                      <span className="text-xs text-gray-400">
                        {timeAgo(review.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
                {review.comentario && (
                  <p className="text-sm text-gray-600">{review.comentario}</p>
                )}
                <div className="mt-2">
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

            {reviews.length === 0 && (
              <div className="text-center py-10">
                <div className="text-4xl mb-3">⭐</div>
                <p className="text-gray-500 text-sm">
                  Ainda sem avaliações — seja a primeira troca!
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
