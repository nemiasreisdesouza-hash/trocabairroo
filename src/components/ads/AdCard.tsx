"use client";

import Link from "next/link";
import {
  MapPin,
  Star,
  Repeat2,
  Utensils,
  Scissors,
  Palette,
  GraduationCap,
  Calendar,
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
import VerifiedBadge from "@/components/ui/VerifiedBadge";
import { timeAgo } from "@/lib/utils";

// [UX] Ícones dinâmicos por categoria para placeholders sem foto
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

type AdCardProps = {
  ad: {
    id: string;
    tipo: string;
    titulo: string;
    descricao: string;
    categoria: string;
    bairro: string;
    cidade?: string;
    aceitaEmTroca: string;
    destaque: boolean | null;
    topoFeed: boolean | null;
    isFeatured?: boolean | null;
    featuredUntil?: string | null;
    isTopFeed?: boolean | null;
    topFeedUntil?: string | null;
    boostType?: string | null;
    isUrgent?: boolean | null;
    createdAt: Date | string;
    images: string[];
    userName: string;
    userAvatar: string | null;
    userMediaAvaliacao: number | null;
    userTrocasConcluidas: number | null;
    userVerificado: boolean | null;
    userIsPartner?: boolean | null;
  };
};

export default function AdCard({ ad }: AdCardProps) {
  // [P0-B] isFeaturedActive com until + fallback legado
  const now = Date.now();
  const featActive = (() => {
    const f = (ad as any).isFeatured ?? ad.destaque;
    if (f) {
      const until = (ad as any).featuredUntil ? new Date((ad as any).featuredUntil).getTime() : null;
      if (!until || until > now) return true;
    }
    const top = (ad as any).isTopFeed ?? ad.topoFeed;
    if (top) {
      const untilTop = (ad as any).topFeedUntil ? new Date((ad as any).topFeedUntil).getTime() : null;
      if (!untilTop || untilTop > now) return true;
    }
    return !!(ad.destaque || ad.topoFeed);
  })();
  const isDestaque = featActive;
  const trocas = ad.userTrocasConcluidas || 0;
  const local = [ad.bairro, ad.cidade].filter(Boolean).join(" · ");

  return (
    <Link href={`/anuncio/${ad.id}`} className="block h-full">
      {/* Container com altura total — cards da mesma linha ficam IGUAIS */}
      <div
        className={`h-full flex flex-col justify-between rounded-2xl bg-white border shadow-sm hover:shadow-md transition-all duration-200 active:scale-98 p-3 sm:p-4 lg:p-5 ${
          isDestaque ? "border-2 border-yellow-400" : "border-purple-100"
        }`}
      >
        {/* Imagem no topo (inset com o padding do card) */}
        <div className="relative rounded-xl overflow-hidden aspect-[4/3] sm:aspect-[16/10] lg:aspect-[16/9] w-full bg-gray-100 flex-shrink-0">
          {ad.images && ad.images[0] ? (
            <img
              src={ad.images[0]}
              alt={ad.titulo}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-purple-100 to-purple-200 gap-2">
              {(() => {
                const IconCat = getCategoryIcon(ad.categoria);
                return <IconCat className="w-10 h-10 text-purple-400" />;
              })()}
              <span className="text-[10px] font-semibold text-purple-600 uppercase tracking-wider">
                {ad.categoria}
              </span>
            </div>
          )}

          {/* Badges pílula sobre a imagem */}
          <div className="absolute top-2 left-2 flex gap-1.5 flex-wrap max-w-[calc(100%-1rem)]">
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${
                ad.tipo === "ofereço"
                  ? "bg-purple-700 text-white"
                  : "bg-blue-600 text-white"
              }`}
            >
              {ad.tipo === "ofereço" ? "OFEREÇO" : "PRECISO"}
            </span>
            {isDestaque && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-yellow-400 text-gray-900 flex-shrink-0">
                ⭐ DESTAQUE
              </span>
            )}
          </div>
        </div>

        {/* Conteúdo — estica e distribui para equalizar a altura */}
        <div className="flex flex-col flex-1 justify-between mt-2.5 min-w-0 gap-2">
          <div className="flex flex-col gap-1 min-w-0">
            <p className="text-[10px] sm:text-xs text-purple-600 font-semibold truncate min-w-0 max-w-full overflow-hidden">
              {ad.categoria}
            </p>

            {/* Título — blindado: "kkkkk..." quebra e corta em 2 linhas */}
            <h3 className="text-xs sm:text-sm lg:text-base font-bold text-gray-900 line-clamp-2 break-words overflow-hidden min-w-0 max-w-full leading-snug">
              {ad.titulo}
            </h3>

            <div className="flex items-center gap-1 min-w-0">
              <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span className="text-[11px] sm:text-xs lg:text-sm text-gray-500 truncate min-w-0 max-w-full overflow-hidden">{local}</span>
            </div>

            {/* Caixinha "Troca por:" — blindada: 1 linha, corta com ... */}
            <div className="flex items-start gap-1.5 bg-slate-50 rounded-xl px-2.5 py-2 min-w-0 max-w-full overflow-hidden">
              <Repeat2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] sm:text-xs leading-snug line-clamp-2 sm:line-clamp-none break-words min-w-0 max-w-full overflow-hidden">
                <span className="text-gray-500 font-medium">Troca por: </span>
                <span className="text-emerald-600 font-semibold">
                  {ad.aceitaEmTroca}
                </span>
              </p>
            </div>
          </div>

          {/* Rodapé do autor — nome em até 2 linhas curtas + métricas */}
          <div className="flex items-start gap-2 min-w-0">
            <Avatar
              src={ad.userAvatar}
              name={ad.userName}
              size="xs"
              className="flex-shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-1 min-w-0 max-w-full overflow-hidden">
                <span className="truncate text-xs sm:text-sm font-semibold text-gray-900 max-w-[110px] sm:max-w-none">
                  {ad.userName}
                </span>
                <VerifiedBadge isVerified={ad.userVerificado} isPartner={ad.userIsPartner} size="xs" className="mt-px" />
              </div>
              {/* Linha secundária: nota + trocas | tempo */}
              <div className="flex items-center justify-between gap-2 pt-0.5 min-w-0">
                <span className="flex items-center gap-1 text-[10px] sm:text-xs text-gray-500 min-w-0">
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 flex-shrink-0" />
                  <span className="font-semibold text-gray-700 flex-shrink-0">
                    {(ad.userMediaAvaliacao || 0).toFixed(1)}
                  </span>
                  <span className="truncate">
                    · {trocas} troca{trocas === 1 ? "" : "s"}
                  </span>
                </span>
                <span
                  className="text-[10px] sm:text-xs text-gray-400 flex-shrink-0"
                  suppressHydrationWarning
                >
                  {timeAgo(ad.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
