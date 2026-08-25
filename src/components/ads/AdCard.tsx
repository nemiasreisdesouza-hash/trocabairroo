"use client";

import Link from "next/link";
import { MapPin, Star, Repeat2, CheckCircle2 } from "lucide-react";
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
      <div
        className={`bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 active:scale-98 flex flex-col h-full ${
          isDestaque ? "ring-2 ring-yellow-400" : ""
        }`}
      >
        {/* Image — proporção fixa 4/3 para dar espaço vertical ao conteúdo */}
        <div className="relative aspect-[4/3] bg-gray-100">
          {ad.images && ad.images[0] ? (
            <img
              src={ad.images[0]}
              alt={ad.titulo}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-100 to-purple-200">
              <span className="text-4xl">🏪</span>
            </div>
          )}

          {/* Badges overlay */}
          <div className="absolute top-2 left-2 flex gap-1.5 flex-wrap max-w-[calc(100%-1rem)]">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                ad.tipo === "ofereço"
                  ? "bg-purple-700 text-white"
                  : "bg-blue-600 text-white"
              }`}
            >
              {ad.tipo === "ofereço" ? "OFEREÇO" : "PRECISO"}
            </span>
            {isDestaque && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-400 text-gray-900 flex-shrink-0">
                ⭐
              </span>
            )}
          </div>
        </div>

        {/* Content — p-2.5 no mobile, p-4 a partir de sm */}
        <div className="p-2.5 sm:p-4 flex flex-col flex-1 min-w-0">
          {/* Categoria */}
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-purple-600 truncate mb-0.5">
            {ad.categoria}
          </p>

          {/* Título */}
          <h3 className="text-xs sm:text-sm font-bold line-clamp-2 leading-tight text-gray-900 mb-1">
            {ad.titulo}
          </h3>

          {/* Localização (Bairro · Cidade) */}
          <div className="flex items-center gap-1 min-w-0 mb-1.5">
            <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
            <span className="text-[10px] sm:text-xs text-gray-500 truncate">
              {local}
            </span>
          </div>

          {/* Tag "Troca por" */}
          <div className="flex items-center gap-1 min-w-0 mb-2 sm:mb-3">
            <Repeat2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
            <span className="text-[10px] sm:text-xs bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded truncate max-w-full block min-w-0 flex-1 font-medium">
              Troca por: {ad.aceitaEmTroca}
            </span>
          </div>

          {/* ═══ RODAPÉ DO ANUNCIANTE · 2 MICRO-LINHAS ═══ */}
          <div className="mt-auto min-w-0">
            {/* LINHA 1 — Autor: [Avatar 24px] + [Nome completo] + [Selo] */}
            <div className="flex items-center gap-1.5 min-w-0">
              <Avatar
                src={ad.userAvatar}
                name={ad.userName}
                size="xs"
                className="flex-shrink-0"
              />
              <span className="min-w-0 flex-1 truncate text-xs sm:text-sm font-medium text-gray-900">
                {ad.userName}
              </span>
              {ad.userVerificado && (
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
              )}
            </div>

            {/* LINHA 2 — Métricas e tempo: ★ nota · trocas | há X tempo */}
            <div className="flex items-center justify-between gap-2 pt-0.5 text-[10px] sm:text-xs text-gray-500 min-w-0">
              <span className="flex items-center gap-1 min-w-0">
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 flex-shrink-0" />
                <span className="font-semibold text-gray-700 flex-shrink-0">
                  {(ad.userMediaAvaliacao || 0).toFixed(1)}
                </span>
                <span className="truncate">
                  · {trocas} troca{trocas === 1 ? "" : "s"}
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
