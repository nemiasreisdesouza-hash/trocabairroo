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
      {/* Container com altura total — cards da mesma linha ficam IGUAIS */}
      <div
        className={`h-full flex flex-col justify-between rounded-2xl bg-white border shadow-sm hover:shadow-md transition-all duration-200 active:scale-98 p-3 sm:p-4 ${
          isDestaque ? "border-2 border-yellow-400" : "border-purple-100"
        }`}
      >
        {/* Imagem no topo (inset com o padding do card) */}
        <div className="relative rounded-xl overflow-hidden aspect-[4/3] w-full bg-gray-100 flex-shrink-0">
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
            <p className="text-xs text-purple-600 font-semibold truncate">
              {ad.categoria}
            </p>

            {/* Título — até 2 linhas com quebra natural */}
            <h3 className="text-xs sm:text-sm font-bold text-gray-900 line-clamp-2 leading-tight break-words">
              {ad.titulo}
            </h3>

            <div className="flex items-center gap-1 min-w-0">
              <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span className="text-xs text-gray-500 truncate">{local}</span>
            </div>

            {/* Caixinha "Troca por:" — item em até 2 linhas */}
            <div className="flex items-start gap-1.5 bg-slate-50 rounded-xl px-2.5 py-2 min-w-0">
              <Repeat2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] sm:text-xs leading-tight line-clamp-2 min-w-0">
                <span className="text-gray-500 font-medium">Troca por: </span>
                <span className="text-emerald-600 font-semibold break-words">
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
              <div className="flex items-start gap-1 min-w-0">
                <span className="text-xs font-semibold text-gray-800 line-clamp-2 leading-tight break-words min-w-0">
                  {ad.userName}
                </span>
                {ad.userVerificado && (
                  <CheckCircle2 className="w-3 h-3 text-blue-500 flex-shrink-0 mt-px" />
                )}
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
