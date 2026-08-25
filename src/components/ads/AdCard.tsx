"use client";

import Link from "next/link";
import { MapPin, Star, CheckCircle2, Image as ImageIcon } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { timeAgo } from "@/lib/utils";

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
    createdAt: Date | string;
    images: string[];
    userName: string;
    userAvatar: string | null;
    userMediaAvaliacao: number | null;
    userTrocasConcluidas: number | null;
    userVerificado: boolean | null;
  };
};

export default function AdCard({ ad }: AdCardProps) {
  const isDestaque = ad.destaque || ad.topoFeed;
  const trocas = ad.userTrocasConcluidas || 0;
  const local = [ad.bairro, ad.cidade].filter(Boolean).join(" · ");

  return (
    <Link href={`/anuncio/${ad.id}`} className="block h-full">
      {/* ═══ CONTAINER PREMIUM ═══ */}
      <div className="bg-white rounded-2xl border border-purple-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col h-full">
        {/* ═══ IMAGEM · 16/10 (video no desktop) ═══ */}
        <div className="relative aspect-[16/10] sm:aspect-video w-full bg-purple-50">
          {ad.images && ad.images[0] ? (
            <img
              src={ad.images[0]}
              alt={ad.titulo}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-100 to-purple-50">
              <ImageIcon className="w-8 h-8 text-purple-300" />
            </div>
          )}

          {/* ═══ TAGS FLUTUANTES · GLASSMORPHISM (canto sup. esquerdo) ═══ */}
          <div className="absolute top-2 left-2 flex items-center max-w-[calc(100%-1rem)]">
            <span
              className={`backdrop-blur-md bg-purple-950/80 text-white font-bold text-[10px] px-2.5 py-0.5 rounded-full shadow-sm border border-white/20 flex-shrink-0`}
            >
              {ad.tipo === "ofereço" ? "OFEREÇO" : "PRECISO"}
            </span>
            {isDestaque && (
              <span className="backdrop-blur-md bg-amber-400/90 text-purple-950 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full shadow-sm ml-1 flex-shrink-0">
                ⭐ Destaque
              </span>
            )}
          </div>
        </div>

        {/* ═══ CONTEÚDO ═══ */}
        <div className="p-3 sm:p-4 flex flex-col justify-between flex-1 gap-2 min-w-0">
          {/* Bloco superior: categoria, título, local, troca */}
          <div className="flex flex-col gap-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-purple-600 truncate">
              {ad.categoria}
            </p>

            <h3 className="text-xs sm:text-sm font-extrabold text-gray-900 line-clamp-2 leading-snug">
              {ad.titulo}
            </h3>

            <p className="text-[11px] text-gray-500 flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
              <span className="truncate">{local}</span>
            </p>

            {/* Tag "Troca por" · Amarelo/Dourado de valor */}
            <div className="min-w-0 mt-0.5">
              <span className="bg-amber-50/90 text-amber-900 border border-amber-200/80 px-2 py-1 rounded-lg text-[10px] sm:text-xs font-semibold flex items-center gap-1.5 max-w-full truncate min-w-0">
                <span className="flex-shrink-0">⇄</span>
                <span className="truncate">Troca por: {ad.aceitaEmTroca}</span>
              </span>
            </div>
          </div>

          {/* ═══ RODAPÉ DO AUTOR · 2 micro-linhas ═══ */}
          <div className="min-w-0">
            {/* LINHA 1 — [Avatar 22px] + [Nome completo] + [Check] */}
            <div className="flex items-center gap-1.5 min-w-0">
              <Avatar
                src={ad.userAvatar}
                name={ad.userName}
                size="xxs"
                className="flex-shrink-0"
              />
              <span className="min-w-0 flex-1 truncate text-xs sm:text-sm font-semibold text-gray-900">
                {ad.userName}
              </span>
              {ad.userVerificado && (
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
              )}
            </div>

            {/* LINHA 2 — ★ nota (trocas) | tempo */}
            <div className="flex items-center justify-between gap-2 pt-0.5 text-[10px] text-gray-400 min-w-0">
              <span className="flex items-center gap-1 min-w-0">
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 flex-shrink-0" />
                <span className="font-bold text-gray-600 flex-shrink-0">
                  {(ad.userMediaAvaliacao || 0).toFixed(1)}
                </span>
                <span className="truncate">
                  ({trocas} troca{trocas === 1 ? "" : "s"})
                </span>
              </span>
              <span className="flex-shrink-0" suppressHydrationWarning>
                {timeAgo(ad.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
