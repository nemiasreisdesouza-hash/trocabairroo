"use client";

import Link from "next/link";
import {
  MapPin,
  Star,
  Repeat2,
} from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import VerifiedBadge from "@/components/ui/VerifiedBadge";
import { timeAgo } from "@/lib/utils";
import AdThumb from "./AdThumb";

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
      <div
        className={`h-full flex flex-col justify-between rounded-2xl bg-white border shadow-sm hover:shadow-md transition-all duration-200 active:scale-98 p-3 sm:p-4 lg:p-5 ${
          isDestaque ? "border-2 border-yellow-400" : "border-purple-100"
        }`}
      >
        <div className="relative rounded-xl overflow-hidden aspect-[4/3] sm:aspect-[16/10] lg:aspect-[16/9] w-full bg-gray-100 flex-shrink-0">
          <AdThumb url={ad.images?.[0]} category={ad.categoria} className="w-full h-full object-cover" />
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
            {ad.isUrgent && (
              <span className="text-xs font-black px-2.5 py-1 rounded-full bg-red-500 text-white flex-shrink-0 shadow-sm animate-pulse">
                ⚡ URGENTE
              </span>
            )}
            {isDestaque && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-yellow-400 text-gray-900 flex-shrink-0">
                ⭐ DESTAQUE
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col flex-1 justify-between mt-2.5 min-w-0 gap-2">
          <div className="flex flex-col gap-1 min-w-0">
            <p className="text-[10px] sm:text-xs text-purple-600 font-semibold truncate min-w-0 max-w-full overflow-hidden">
              {ad.categoria}
            </p>
            <h3 className="text-xs sm:text-sm lg:text-base font-bold text-gray-900 line-clamp-2 break-words overflow-hidden min-w-0 max-w-full leading-snug">
              {ad.titulo}
            </h3>
            <div className="flex items-center gap-1 min-w-0">
              <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span className="text-[11px] sm:text-xs lg:text-sm text-gray-500 truncate min-w-0 max-w-full overflow-hidden">{local}</span>
            </div>
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
