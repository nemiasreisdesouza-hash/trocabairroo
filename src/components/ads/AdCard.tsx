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
        className={`bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 active:scale-98 flex flex-col h-full border ${
          isDestaque ? "border-2 border-yellow-400" : "border-gray-100"
        }`}
      >
        {/* Imagem no topo, proporção equilibrada */}
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

          {/* Badges no topo — pílulas por cima da imagem, margem correta */}
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

        {/* Conteúdo com respiro interno confortável */}
        <div className="p-3.5 flex flex-col flex-1 min-w-0">
          <p className="text-xs text-purple-600 font-semibold mb-1 truncate">
            {ad.categoria}
          </p>

          <h3 className="font-bold text-gray-900 text-sm leading-tight mb-1 line-clamp-2">
            {ad.titulo}
          </h3>

          <div className="flex items-center gap-1 mb-2 min-w-0">
            <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span className="text-xs text-gray-500 truncate">{local}</span>
          </div>

          {/* Caixinha "Troca por:" — estilo original (Foto 1) */}
          <div className="flex items-center gap-1.5 bg-slate-50/90 rounded-xl px-2.5 py-2 mb-3 min-w-0">
            <Repeat2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
            <span className="text-xs truncate">
              <span className="text-gray-500 font-medium">Troca por: </span>
              <span className="text-emerald-600 font-semibold">
                {ad.aceitaEmTroca}
              </span>
            </span>
          </div>

          {/* Rodapé do autor — avatar + nome + nota/trocas | tempo à direita */}
          <div className="flex items-center justify-between gap-2 mt-auto min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Avatar
                src={ad.userAvatar}
                name={ad.userName}
                size="sm"
                className="flex-shrink-0"
              />
              <div className="min-w-0">
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
                  <span className="text-xs text-gray-600">
                    {(ad.userMediaAvaliacao || 0).toFixed(1)}
                  </span>
                  <span className="text-xs text-gray-400">
                    · {trocas} troca{trocas === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
            </div>
            <span
              className="text-xs text-gray-400 flex-shrink-0 text-right"
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
