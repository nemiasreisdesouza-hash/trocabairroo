"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Handshake,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useAuth } from "@/contexts/AuthContext";
import { timeAgo } from "@/lib/utils";
import toast from "react-hot-toast";
import AppLayout from "@/components/layout/AppLayout";
import StarRating from "@/components/ui/StarRating";

type Interest = {
  id: string;
  status: string;
  createdAt: string;
  adId: string;
  adTitulo: string;
  adTipo: string;
  senderId: string;
  senderNome: string;
  senderAvatar: string | null;
  senderWhatsapp: string | null;
};

export default function InteressesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"recebidos" | "enviados">("recebidos");
  const [interests, setInterests] = useState<Interest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [reviewModal, setReviewModal] = useState<Interest | null>(null);
  const [review, setReview] = useState({ nota: 5, comentario: "", cumprimento: "sim" as "sim" | "parcialmente" | "nao" });

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    fetchInterests();
  }, [user, activeTab]);

  const fetchInterests = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/interests?tipo=${activeTab}`);
      const data = await res.json();
      setInterests(data.interests || []);
    } catch {
      toast.error("Erro ao carregar interesses");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/interests/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      setInterests((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status } : i))
      );

      toast.success(
        status === "concluido"
          ? "Troca marcada como concluída! 🎉"
          : "Status atualizado"
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao atualizar";
      toast.error(message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSubmitReview = async () => {
    if (!reviewModal || !user) return;

    const avaliadoId =
      activeTab === "recebidos"
        ? reviewModal.senderId
        : user.id; // This won't work directly, needs the receiver

    setActionLoading("review");
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avaliadoId: reviewModal.senderId,
          interestId: reviewModal.id,
          nota: review.nota,
          comentario: review.comentario,
          cumprimento: review.cumprimento,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      toast.success("Avaliação enviada! ⭐");
      setReviewModal(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao avaliar";
      toast.error(message);
    } finally {
      setActionLoading(null);
    }
  };

  const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    pendente: { label: "Pendente", color: "yellow", icon: <Clock className="w-4 h-4" /> },
    aceito: { label: "Em andamento", color: "blue", icon: <AlertCircle className="w-4 h-4" /> },
    concluido: { label: "Concluído", color: "green", icon: <CheckCircle2 className="w-4 h-4" /> },
    cancelado: { label: "Cancelado", color: "red", icon: <XCircle className="w-4 h-4" /> },
  };

  if (!user) return null;

  return (
    <AppLayout>
      <div className="px-4 py-4">
        <h1 className="text-2xl font-black text-gray-900 mb-4">
          Minhas trocas 🤝
        </h1>

        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-2xl p-1 mb-4">
          <button
            onClick={() => setActiveTab("recebidos")}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all ${
              activeTab === "recebidos"
                ? "bg-white text-purple-700 shadow-sm"
                : "text-gray-600"
            }`}
          >
            Recebidos
          </button>
          <button
            onClick={() => setActiveTab("enviados")}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all ${
              activeTab === "enviados"
                ? "bg-white text-purple-700 shadow-sm"
                : "text-gray-600"
            }`}
          >
            Enviados
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
        ) : interests.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">
              {activeTab === "recebidos" ? "📬" : "📤"}
            </div>
            <h3 className="font-bold text-gray-900 text-lg mb-2">
              {activeTab === "recebidos"
                ? "Nenhum interesse recebido"
                : "Você não enviou interesses"}
            </h3>
            <p className="text-gray-500 text-sm mb-4">
              {activeTab === "recebidos"
                ? "Publique um anúncio para receber interesses"
                : "Explore os anúncios e demonstre interesse!"}
            </p>
            <Link href={activeTab === "recebidos" ? "/anuncio/criar" : "/buscar"}>
              <Button size="sm">
                {activeTab === "recebidos" ? "Publicar anúncio" : "Ver anúncios"}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {interests.map((interest) => {
              const config = statusConfig[interest.status] || statusConfig.pendente;
              return (
                <div key={interest.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Link href={`/perfil/${interest.senderId}`}>
                        <Avatar
                          src={interest.senderAvatar}
                          name={interest.senderNome}
                          size="md"
                        />
                      </Link>
                      <div className="flex-1">
                        <p className="font-bold text-gray-900">
                          {interest.senderNome}
                        </p>
                        <p className="text-xs text-gray-500">
                          {timeAgo(interest.createdAt)}
                        </p>
                      </div>
                      <Badge
                        variant={
                          config.color as
                            | "yellow"
                            | "blue"
                            | "green"
                            | "red"
                            | "purple"
                            | "gray"
                        }
                      >
                        {config.label}
                      </Badge>
                    </div>

                    <Link href={`/anuncio/${interest.adId}`}>
                      <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-2">
                        <Handshake className="w-4 h-4 text-purple-600 flex-shrink-0" />
                        <p className="text-sm font-medium text-gray-700 flex-1 truncate">
                          {interest.adTitulo}
                        </p>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </Link>
                  </div>

                  {/* Actions */}
                  {interest.status === "pendente" && activeTab === "recebidos" && (
                    <div className="flex border-t border-gray-50">
                      <button
                        onClick={() => handleUpdateStatus(interest.id, "cancelado")}
                        disabled={actionLoading === interest.id}
                        className="flex-1 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
                      >
                        Rejeitar
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(interest.id, "aceito")}
                        disabled={actionLoading === interest.id}
                        className="flex-1 py-3 text-sm font-semibold text-green-700 bg-green-50 hover:bg-green-100 transition-colors"
                      >
                        Aceitar ✓
                      </button>
                    </div>
                  )}

                  {interest.status === "aceito" && (
                    <div className="flex border-t border-gray-50">
                      <button
                        onClick={() => handleUpdateStatus(interest.id, "concluido")}
                        disabled={actionLoading === interest.id}
                        className="flex-1 py-3 text-sm font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors"
                      >
                        Marcar como concluída 🎉
                      </button>
                    </div>
                  )}

                  {interest.status === "concluido" && (
                    <div className="flex border-t border-gray-50">
                      <button
                        onClick={() => setReviewModal(interest)}
                        className="flex-1 py-3 text-sm font-semibold text-yellow-700 bg-yellow-50 hover:bg-yellow-100 transition-colors"
                      >
                        ⭐ Avaliar
                      </button>
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
        isOpen={!!reviewModal}
        onClose={() => setReviewModal(null)}
        title="Avaliar troca ⭐"
      >
        <div className="flex flex-col gap-4">
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
