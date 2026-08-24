"use client";

import Link from "next/link";
import { MapPin, Star, Repeat2, CheckCircle2, TrendingUp } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import { timeAgo, truncate } from "@/lib/utils";

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
    <Link href={`/anuncio/${ad.id}`} className="block">
      <div
        className={`bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 active:scale-98 ${
          isDestaque ? "ring-2 ring-yellow-400" : ""
        }`}
      >
        {/* Image */}
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
          <div className="absolute top-2 left-2 flex gap-1.5">
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                ad.tipo === "ofereço"
                  ? "bg-purple-700 text-white"
                  : "bg-blue-600 text-white"
              }`}
            >
              {ad.tipo === "ofereço" ? "OFEREÇO" : "PRECISO"}
            </span>
            {isDestaque && (
              <span className="text-xs font-bold px-2 py-1 rounded-full bg-yellow-400 text-gray-900">
                ⭐ DESTAQUE
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-3">
          <p className="text-xs text-purple-600 font-semibold mb-1">
            {ad.categoria}
          </p>
          <h3 className="font-bold text-gray-900 text-sm leading-tight mb-1">
            {truncate(ad.titulo, 50)}
          </h3>

          <div className="flex items-center gap-1 mb-2">
            <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
            <span className="text-xs text-gray-500">{ad.bairro}</span>
          </div>

          {/* Aceita em troca */}
          <div className="flex items-center gap-1 bg-gray-50 rounded-xl px-2 py-1.5 mb-3">
            <Repeat2 className="w-3 h-3 text-green-600 flex-shrink-0" />
            <span className="text-xs text-gray-600 font-medium">
              Troca por:{" "}
              <span className="text-green-700">
                {truncate(ad.aceitaEmTroca, 30)}
              </span>
            </span>
          </div>

          {/* User info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar src={ad.userAvatar} name={ad.userName} size="sm" />
              <div>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold text-gray-800">
                    {truncate(ad.userName, 15)}
                  </span>
                  {ad.userVerificado && (
                    <CheckCircle2 className="w-3 h-3 text-blue-500" />
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  <span className="text-xs text-gray-600">
                    {(ad.userMediaAvaliacao || 0).toFixed(1)}
                  </span>
                  <span className="text-xs text-gray-400">
                    · {ad.userTrocasConcluidas || 0} trocas
                  </span>
                </div>
              </div>
            </div>
            <span className="text-xs text-gray-400" suppressHydrationWarning>
              {timeAgo(ad.createdAt)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
