"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Handshake,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Play,
  PartyPopper,
  MessageCircle,
  Star,
  Ban,
} from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useAuth } from "@/contexts/AuthContext";
import { timeAgo, generateWhatsAppLink } from "@/lib/utils";
import toast from "react-hot-toast";
import AppLayout from "@/components/layout/AppLayout";
import StarRating from "@/components/ui/StarRating";
import * as backend from "@/lib/backend";
import type { Trade } from "@/lib/types";
import { TRADE_STATUS_LABEL } from "@/lib/types";

const statusConfig: Record<
  string,
  { label: string; color: "yellow" | "blue" | "green" | "red" | "purple" | "gray" }
> = {
  pending: { label: "Aguardando aceite", color: "yellow" },
  accepted: { label: "Aceita", color: "blue" },
  in_progress: { label: "Em andamento", color: "purple" },
  completed: { label: "Concluída (1/2)", color: "purple" },
  awaiting_reviews: { label: "Aguardando avaliação", color: "green" },
  finished: { label: "Finalizada ⭐", color: "green" },
  cancelled: { label: "Cancelada", color: "gray" },
  rejected: { label: "Rejeitada", color: "red" },
};

export default function TrocasPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"recebidas" | "enviadas">("recebidas");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pendingReview, setPendingReview] = useState<Trade | null>(null);
  const [review, setReview] = useState({
    nota: 5,
    comentario: "",
    cumprimento: "sim" as "sim" | "parcialmente" | "nao",
  });

  const fetchTrades = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const list = await backend.listTrades(user.id, activeTab);
      setTrades(list);
    } catch {
      toast.error("Erro ao carregar trocas");
    } finally {
      setLoading(false);
    }
  }, [user, activeTab]);

  useEffect(() => {
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      router.push("/login");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTrades();
  }, [user, fetchTrades, router]);

  const handleAction = async (tradeId: string, action: backend.TradeAction) => {
    if (!user) return;
    setActionLoading(`${tradeId}-${action}`);
    try {
      await backend.updateTradeStatus(user.id, tradeId, action);
      toast.success("Status atualizado");
      await fetchTrades();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao atualizar";
      toast.error(message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSubmitReview = async () => {
    if (!user || !pendingReview) return;
    setActionLoading("review");
    try {
      await backend.submitReview(user.id, pendingReview.id, {
        nota: review.nota,
        comentario: review.comentario,
        cumprimento: review.cumprimento,
      });
      toast.success("Avaliação enviada! ⭐");
      setPendingReview(null);
      setReview({ nota: 5, comentario: "", cumprimento: "sim" });
      await fetchTrades();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao avaliar";
      toast.error(message);
    } finally {
      setActionLoading(null);
    }
  };

  const openWhatsApp = (trade: Trade) => {
    if (!trade.otherWhatsapp) {
      toast.error("WhatsApp não disponível");
      return;
    }
    const msg = `Olá! Sobre nossa troca "${trade.adTitulo}" combinada no TrocaBairro — vamos combinar os detalhes?`;
    window.open(generateWhatsAppLink(trade.otherWhatsapp, msg), "_blank");
  };

  const iReviewed = (t: Trade) =>
    t.requesterId === user?.id ? t.requesterReviewed : t.ownerReviewed;
  const iCompleted = (t: Trade) =>
    t.requesterId === user?.id ? t.requesterCompleted : t.ownerCompleted;

  if (!user) return null;

  const pendingReviewBanner = trades.find(
    (t) => t.status === "awaiting_reviews" && !iReviewed(t)
  );

  return (
    <AppLayout>
      <div className="px-4 py-4">
        <h1 className="text-2xl font-black text-gray-900 mb-1">
          Minhas trocas 🤝
        </h1>
        <p className="text-xs text-gray-400 mb-4">
          Proposta → Aceite → Andamento → Conclusão → Avaliação → Finalizada
        </p>

        {/* Aviso de avaliação pendente (bloqueia novas trocas) */}
        {pendingReviewBanner && (
          <div className="bg-yellow-50 border border-yellow-300 rounded-2xl p-4 mb-4 flex items-start gap-3">
            <Star className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-yellow-800 text-sm">
                Você tem uma avaliação pendente!
              </p>
              <p className="text-xs text-yellow-700 mb-2">
                Enquanto não avaliar a troca com {pendingReviewBanner.otherNome},
                você não pode iniciar novas trocas.
              </p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPendingReview(pendingReviewBanner)}
              >
                Avaliar agora ⭐
              </Button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-2xl p-1 mb-4">
          <button
            onClick={() => setActiveTab("recebidas")}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all ${
              activeTab === "recebidas"
                ? "bg-white text-purple-700 shadow-sm"
                : "text-gray-600"
            }`}
          >
            Recebidas
          </button>
          <button
            onClick={() => setActiveTab("enviadas")}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all ${
              activeTab === "enviadas"
                ? "bg-white text-purple-700 shadow-sm"
                : "text-gray-600"
            }`}
          >
            Enviadas
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-2/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : trades.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">
              {activeTab === "recebidas" ? "📬" : "📤"}
            </div>
            <h3 className="font-bold text-gray-900 text-lg mb-2">
              {activeTab === "recebidas"
                ? "Nenhuma proposta recebida"
                : "Você não enviou propostas"}
            </h3>
            <p className="text-gray-500 text-sm mb-4">
              {activeTab === "recebidas"
                ? "Publique um anúncio para receber propostas de troca"
                : "Explore os anúncios e proponha uma troca!"}
            </p>
            <Link href={activeTab === "recebidas" ? "/anuncio/criar" : "/buscar"}>
              <Button size="sm">
                {activeTab === "recebidas" ? "Publicar anúncio" : "Ver anúncios"}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {trades.map((trade) => {
              const config = statusConfig[trade.status] ?? statusConfig.pending;
              const isOwner = trade.ownerId === user.id;
              return (
                <div
                  key={trade.id}
                  className="bg-white rounded-2xl shadow-sm overflow-hidden"
                >
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Link href={`/perfil/${trade.otherId}`}>
                        <Avatar
                          src={trade.otherAvatar}
                          name={trade.otherNome}
                          size="md"
                        />
                      </Link>
                      <div className="flex-1">
                        <p className="font-bold text-gray-900">
                          {trade.otherNome}
                        </p>
                        <p className="text-xs text-gray-500">
                          {timeAgo(trade.createdAt)} ·{" "}
                          {isOwner ? "proposta recebida" : "proposta enviada"}
                        </p>
                      </div>
                      <Badge variant={config.color}>{config.label}</Badge>
                    </div>

                    <Link href={`/anuncio/${trade.adId}`}>
                      <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-2">
                        <Handshake className="w-4 h-4 text-purple-600 flex-shrink-0" />
                        <p className="text-sm font-medium text-gray-700 flex-1 truncate">
                          {trade.adTitulo}
                        </p>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </Link>
                  </div>

                  {/* Ações por status */}
                  {trade.status === "pending" && (
                    <div className="flex border-t border-gray-50">
                      {isOwner ? (
                        <>
                          <button
                            onClick={() => handleAction(trade.id, "reject")}
                            disabled={actionLoading === `${trade.id}-reject`}
                            className="flex-1 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
                          >
                            Rejeitar
                          </button>
                          <button
                            onClick={() => handleAction(trade.id, "accept")}
                            disabled={actionLoading === `${trade.id}-accept`}
                            className="flex-1 py-3 text-sm font-semibold text-green-700 bg-green-50 hover:bg-green-100 transition-colors"
                          >
                            Aceitar ✓
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleAction(trade.id, "cancel")}
                          disabled={actionLoading === `${trade.id}-cancel`}
                          className="flex-1 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Ban className="w-4 h-4" /> Cancelar proposta
                        </button>
                      )}
                    </div>
                  )}

                  {trade.status === "accepted" && (
                    <div className="flex border-t border-gray-50">
                      <button
                        onClick={() => openWhatsApp(trade)}
                        className="flex-1 py-3 text-sm font-semibold text-green-700 hover:bg-green-50 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <MessageCircle className="w-4 h-4" /> WhatsApp
                      </button>
                      <button
                        onClick={() => handleAction(trade.id, "start")}
                        disabled={actionLoading === `${trade.id}-start`}
                        className="flex-1 py-3 text-sm font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Play className="w-4 h-4" /> Iniciar troca
                      </button>
                    </div>
                  )}

                  {trade.status === "in_progress" && (
                    <div className="flex border-t border-gray-50">
                      <button
                        onClick={() => openWhatsApp(trade)}
                        className="flex-1 py-3 text-sm font-semibold text-green-700 hover:bg-green-50 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <MessageCircle className="w-4 h-4" /> WhatsApp
                      </button>
                      <button
                        onClick={() => handleAction(trade.id, "complete")}
                        disabled={actionLoading === `${trade.id}-complete`}
                        className="flex-1 py-3 text-sm font-semibold text-white bg-purple-700 hover:bg-purple-800 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {iCompleted(trade) ? "Concluída ✓ (aguardando...)" : "Marcar concluída"}
                      </button>
                    </div>
                  )}

                  {trade.status === "completed" && (
                    <div className="flex border-t border-gray-50 items-center px-4 py-3 gap-2 bg-purple-50/50">
                      <Clock className="w-4 h-4 text-purple-500 flex-shrink-0" />
                      <p className="text-xs text-purple-700 font-medium flex-1">
                        Você concluiu. Aguardando {trade.otherNome} confirmar para
                        liberar as avaliações…
                      </p>
                    </div>
                  )}

                  {trade.status === "awaiting_reviews" && (
                    <div className="flex border-t border-gray-50">
                      {iReviewed(trade) ? (
                        <div className="flex-1 py-3 px-4 flex items-center gap-2 bg-green-50">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          <p className="text-xs text-green-700 font-medium">
                            Avaliação enviada — aguardando {trade.otherNome}
                          </p>
                        </div>
                      ) : (
                        <button
                          onClick={() => setPendingReview(trade)}
                          className="flex-1 py-3 text-sm font-semibold text-yellow-800 bg-yellow-50 hover:bg-yellow-100 transition-colors"
                        >
                          ⭐ Avaliar troca (obrigatória)
                        </button>
                      )}
                    </div>
                  )}

                  {trade.status === "finished" && (
                    <div className="flex border-t border-gray-50">
                      <div className="flex-1 py-3 px-4 flex items-center gap-2 bg-green-50">
                        <PartyPopper className="w-4 h-4 text-green-600" />
                        <p className="text-xs text-green-700 font-medium">
                          Troca finalizada com sucesso! Reputação atualizada 🎉
                        </p>
                      </div>
                    </div>
                  )}

                  {(trade.status === "cancelled" || trade.status === "rejected") && (
                    <div className="flex border-t border-gray-50">
                      <div className="flex-1 py-3 px-4 flex items-center gap-2 bg-gray-50">
                        <XCircle className="w-4 h-4 text-gray-500" />
                        <p className="text-xs text-gray-600">
                          {trade.status === "cancelled"
                            ? "Proposta cancelada"
                            : "Proposta rejeitada"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Review Modal */}
      <Modal
        isOpen={!!pendingReview}
        onClose={() => setPendingReview(null)}
        title="Avaliar troca ⭐"
      >
        <div className="flex flex-col gap-4">
          {pendingReview && (
            <p className="text-sm text-gray-600">
              Avaliando a troca de{" "}
              <strong>&quot;{pendingReview.adTitulo}&quot;</strong> com{" "}
              <strong>{pendingReview.otherNome}</strong>. A avaliação é
              recíproca e obrigatória.
            </p>
          )}

          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Nota</p>
            <StarRating
              rating={review.nota}
              size="lg"
              interactive
              onRate={(r) => setReview((prev) => ({ ...prev, nota: r }))}
            />
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">
              Cumpriu o combinado?
            </p>
            <div className="flex gap-2">
              {[
                { value: "sim", label: "✓ Sim" },
                { value: "parcialmente", label: "~ Parcialmente" },
                { value: "nao", label: "✗ Não" },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() =>
                    setReview((prev) => ({
                      ...prev,
                      cumprimento: value as "sim" | "parcialmente" | "nao",
                    }))
                  }
                  className={`flex-1 py-2 text-xs font-semibold rounded-xl border-2 transition-all ${
                    review.cumprimento === value
                      ? "border-purple-600 bg-purple-50 text-purple-700"
                      : "border-gray-200 text-gray-600"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">
              Comentário{" "}
              <span className="text-gray-400 font-normal">(opcional)</span>
            </p>
            <textarea
              value={review.comentario}
              onChange={(e) =>
                setReview((prev) => ({ ...prev, comentario: e.target.value }))
              }
              placeholder="Como foi a experiência?"
              rows={3}
              maxLength={500}
              className="w-full border-2 border-gray-200 rounded-2xl p-3 text-sm resize-none focus:outline-none focus:border-purple-600"
            />
          </div>

          <Button
            onClick={handleSubmitReview}
            loading={actionLoading === "review"}
            fullWidth
            size="lg"
          >
            Enviar avaliação ⭐
          </Button>
        </div>
      </Modal>
    </AppLayout>
  );
}
