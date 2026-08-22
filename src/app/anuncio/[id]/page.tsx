"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  Star,
  Repeat2,
  CheckCircle2,
  MessageCircle,
  Flag,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Eye,
} from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import StarRating from "@/components/ui/StarRating";
import { useAuth } from "@/contexts/AuthContext";
import { generateWhatsAppLink, timeAgo } from "@/lib/utils";
import toast from "react-hot-toast";
import AppLayout from "@/components/layout/AppLayout";

type AdDetail = {
  id: string;
  userId: string;
  tipo: string;
  titulo: string;
  descricao: string;
  categoria: string;
  bairro: string;
  aceitaEmTroca: string;
  destaque: boolean;
  topoFeed: boolean;
  status: string;
  visualizacoes: number;
  createdAt: string;
  images: string[];
  userName: string;
  userAvatar: string | null;
  userWhatsapp: string | null;
  userBio: string | null;
  userBairro: string | null;
  userMediaAvaliacao: number;
  userTrocasConcluidas: number;
  userVerificado: boolean;
  userTipoPerfil: string;
  reviews: Array<{
    id: string;
    nota: number;
    comentario: string | null;
    cumprimento: string;
    createdAt: string;
    avaliadorNome: string;
    avaliadorAvatar: string | null;
  }>;
  interestCount: number;
};

export default function AdDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [ad, setAd] = useState<AdDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImage, setCurrentImage] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportMotivo, setReportMotivo] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [interestLoading, setInterestLoading] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    fetchAd();
  }, [id]);

  const fetchAd = async () => {
    try {
      const res = await fetch(`/api/ads/${id}`);
      if (!res.ok) {
        router.push("/buscar");
        return;
      }
      const data = await res.json();
      setAd(data);
    } catch {
      router.push("/buscar");
    } finally {
      setLoading(false);
    }
  };

  const handleInterest = async () => {
    if (!user) {
      router.push("/login");
      return;
    }

    setInterestLoading(true);
    try {
      const res = await fetch("/api/interests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adId: id }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Erro ao demonstrar interesse");
        return;
      }

      toast.success("Interesse registrado! Abrindo WhatsApp...");

      if (ad?.userWhatsapp) {
        const msg = `Olá! Vi seu anúncio "${ad.titulo}" no TrocaBairro e tenho interesse na troca.`;
        const link = generateWhatsAppLink(ad.userWhatsapp, msg);
        window.open(link, "_blank");
      }
    } catch {
      toast.error("Erro ao registrar interesse");
    } finally {
      setInterestLoading(false);
    }
  };

  const handleWhatsApp = () => {
    if (!ad?.userWhatsapp) {
      toast.error("WhatsApp não disponível");
      return;
    }
    const msg = `Olá! Vi seu anúncio "${ad.titulo}" no TrocaBairro e tenho interesse na troca.`;
    const link = generateWhatsAppLink(ad.userWhatsapp, msg);
    window.open(link, "_blank");
  };

  const handleReport = async () => {
    if (!reportMotivo.trim() || reportMotivo.length < 10) {
      toast.error("Descreva o motivo da denúncia (mínimo 10 caracteres)");
      return;
    }

    setReportLoading(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adId: id, motivo: reportMotivo }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      toast.success("Denúncia enviada. Obrigado!");
      setShowReportModal(false);
      setReportMotivo("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao enviar denúncia";
      toast.error(message);
    } finally {
      setReportLoading(false);
    }
  };

  if (loading) {
    return (
      <AppLayout showNav={false}>
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
          {ad.images && ad.images.length > 0 ? (
            <>
              <img
                src={ad.images[currentImage]}
                alt={ad.titulo}
                className="w-full h-full object-cover"
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
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-100 to-purple-200">
              <span className="text-6xl">🏪</span>
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

      {/* Content */}
      <div className="px-4 py-4 pb-40">
        {/* Title & Category */}
        <p className="text-sm text-purple-600 font-semibold mb-1">{ad.categoria}</p>
        <h1 className="text-xl font-black text-gray-900 mb-2">{ad.titulo}</h1>

        <div className="flex items-center gap-3 text-sm text-gray-500 mb-4">
          <div className="flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            <span>{ad.bairro}</span>
          </div>
          <div className="flex items-center gap-1">
            <Eye className="w-4 h-4" />
            <span>{ad.visualizacoes} visualizações</span>
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
            <p className="text-sm font-bold text-gray-900">{ad.aceitaEmTroca}</p>
          </div>
        </div>

        {/* Description */}
        <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-2">Descrição</h2>
          <p className="text-gray-700 text-sm leading-relaxed">{ad.descricao}</p>
        </div>

        {/* User profile */}
        <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-3">Quem anuncia</h2>
          <Link href={`/perfil/${ad.userId}`} className="flex items-center gap-3">
            <Avatar src={ad.userAvatar} name={ad.userName} size="lg" />
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-gray-900">{ad.userName}</span>
                {ad.userVerificado && (
                  <CheckCircle2 className="w-4 h-4 text-blue-500" />
                )}
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
              "{ad.userBio}"
            </p>
          )}
        </div>

        {/* Reviews */}
        {ad.reviews && ad.reviews.length > 0 && (
          <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
            <h2 className="font-bold text-gray-900 mb-3">
              Avaliações ({ad.interestCount})
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

        {/* Report button */}
        {!isOwner && (
          <button
            onClick={() => {
              if (!user) {
                router.push("/login");
                return;
              }
              setShowReportModal(true);
            }}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-red-500 transition-colors"
          >
            <Flag className="w-4 h-4" />
            Denunciar este anúncio
          </button>
        )}
      </div>

      {/* Fixed bottom actions */}
      {!isOwner && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 shadow-lg">
          <div className="max-w-lg mx-auto flex gap-3">
            <Button
              variant="whatsapp"
              onClick={handleWhatsApp}
              className="flex-1"
              size="lg"
              icon={<MessageCircle className="w-5 h-5" />}
            >
              WhatsApp
            </Button>
            <Button
              onClick={handleInterest}
              loading={interestLoading}
              className="flex-1"
              size="lg"
            >
              Tenho Interesse
            </Button>
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
                Meu Painel
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Report Modal */}
      <Modal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        title="Denunciar anúncio 🚨"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600">
            Descreva o motivo da denúncia. Nossa equipe irá analisar.
          </p>
          <textarea
            value={reportMotivo}
            onChange={(e) => setReportMotivo(e.target.value)}
            placeholder="Descreva o problema com este anúncio..."
            rows={4}
            className="w-full border-2 border-gray-200 rounded-2xl p-3 text-sm resize-none focus:outline-none focus:border-purple-600"
          />
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowReportModal(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={handleReport}
              loading={reportLoading}
              className="flex-1"
            >
              Denunciar
            </Button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}
