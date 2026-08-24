"use client";

import Link from "next/link";
import { MapPin, Star, Repeat2, CheckCircle2 } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import { timeAgo } from "@/lib/utils";

type AdCardProps = {
  ad: {
    id: string;
    tipo: string;
    titulo: string;
    descricao: string;
    categoria: string;
    bairro: string;
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

  return (
    <Link href={`/anuncio/${ad.id}`} className="block h-full">
      <div
        className={`bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 active:scale-98 flex flex-col h-full ${
          isDestaque ? "ring-2 ring-yellow-400" : ""
        }`}
      >
        {/* Image — proporção 5/4 para um card mais alto e legível */}
        <div className="relative aspect-[5/4] bg-gray-100">
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
          <div className="absolute top-2 left-2 right-2 flex gap-1.5 flex-wrap">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                ad.tipo === "ofereço"
                  ? "bg-purple-700 text-white"
                  : "bg-blue-600 text-white"
              }`}
            >
              {ad.tipo === "ofereço" ? "OFEREÇO" : "PRECISO"}
            </span>
            {isDestaque && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-400 text-gray-900">
                ⭐
              </span>
            )}
          </div>
        </div>

        {/* Content — mais espaço interno e hierarquia clara */}
        <div className="p-3.5 pt-3 flex flex-col flex-1">
          <p className="text-[11px] text-purple-600 font-semibold uppercase tracking-wide mb-1 truncate">
            {ad.categoria}
          </p>

          {/* Título com corte elegante em até 2 linhas */}
          <h3 className="font-bold text-gray-900 text-sm leading-snug mb-1.5 line-clamp-2 min-h-[2.5rem]">
            {ad.titulo}
          </h3>

          {/* Bairro */}
          <div className="flex items-center gap-1 mb-1.5 min-w-0">
            <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span className="text-xs text-gray-500 truncate">{ad.bairro}</span>
          </div>

          {/* Aceita em troca */}
          <div className="flex items-center gap-1.5 bg-gray-50 rounded-xl px-2.5 py-2 mb-3 min-w-0">
            <Repeat2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
            <span className="text-xs text-gray-600 font-medium truncate">
              Troca por:{" "}
              <span className="text-green-700 font-semibold">
                {ad.aceitaEmTroca}
              </span>
            </span>
          </div>

          {/* Autor — nome completo com line-clamp-1 elegante */}
          <div className="flex items-center justify-between gap-2 mt-auto">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Avatar src={ad.userAvatar} name={ad.userName} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-xs font-semibold text-gray-800 truncate">
                    {ad.userName}
                  </span>
                  {ad.userVerificado && (
                    <CheckCircle2 className="w-3 h-3 text-blue-500 flex-shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 flex-shrink-0" />
                  <span className="text-xs text-gray-600 flex-shrink-0">
                    {(ad.userMediaAvaliacao || 0).toFixed(1)}
                  </span>
                  <span className="text-xs text-gray-400 truncate">
                    · {ad.userTrocasConcluidas || 0} trocas
                  </span>
                </div>
              </div>
            </div>
            <span
              className="text-[11px] text-gray-400 flex-shrink-0"
              suppressHydrationWarning
            >
              {timeAgo(ad.createdAt)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
