"use client";

import { useState, useEffect, use, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Send,
  Lock,
  MessageCircle,
  Check,
  CheckCheck,
  Star,
} from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import StarRating from "@/components/ui/StarRating";
import { useAuth } from "@/contexts/AuthContext";
import { generateWhatsAppLink } from "@/lib/utils";
import toast from "react-hot-toast";
import * as backend from "@/lib/backend";
import type { ChatMessage, ChatState } from "@/lib/backend";
import type { Trade, AuthUser } from "@/lib/types";
import { TRADE_STATUS_LABEL } from "@/lib/types";

const STATUS_CHIP: Record<string, { label: string; cls: string }> = {
  pending: { label: "🟡 Aguardando Aceite", cls: "bg-yellow-100 text-yellow-800" },
  accepted: { label: "🔵 Aceita", cls: "bg-blue-100 text-blue-800" },
  in_progress: { label: "🔵 Em Andamento", cls: "bg-blue-100 text-blue-800" },
  completed: { label: "🟣 Concluída (1/2)", cls: "bg-purple-100 text-purple-800" },
  awaiting_reviews: { label: "🟢 Concluída", cls: "bg-green-100 text-green-800" },
  finished: { label: "🟢 Finalizada", cls: "bg-green-100 text-green-700" },
  cancelled: { label: "⚪ Cancelada", cls: "bg-gray-100 text-gray-600" },
  rejected: { label: "⚪ Rejeitada", cls: "bg-gray-100 text-gray-600" },
};

// 🛡️ DUPLO ESCUDO: WhatsApp só quando o consentimento foi APROVADO
const whatsappAprovado = (t: Trade) => t.whatsappShareStatus === "approved";

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();

  const [trade, setTrade] = useState<Trade | null>(null);
  const [otherProfile, setOtherProfile] = useState<AuthUser | null>(null);
  const [chatState, setChatState] = useState<ChatState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    if (!user) return null;
    const t = await backend.getTradeForUser(user.id, id);
    if (!t) {
      router.replace("/trocas");
      return null;
    }
    setTrade(t);
    setChatState(backend.computeChatState(t));
    backend
      .getProfileById(t.otherId)
      .then(setOtherProfile)
      .catch(() => {});
    return t;
  }, [user, id, router]);

  useEffect(() => {
    if (!user) {
      router.replace("/login");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar().finally(() => setLoading(false));
  }, [user, carregar, router]);

  // Tempo real (Supabase Realtime ou polling no demo) + marca como lida
  useEffect(() => {
    if (!user || !trade) return;
    const unsub = backend.subscribeToMessages(user.id, id, (msgs) => {
      setMessages(msgs);
      backend.markMessagesRead(user.id, id).catch(() => {});
    });
    return unsub;
  }, [user, trade, id]);

  // Auto-scroll para a última mensagem
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const handleSend = async () => {
    if (!user || !input.trim() || !chatState?.canSend) return;
    setSending(true);
    try {
      await backend.sendMessage(user.id, id, input);
      setInput("");
      const msgs = await backend.listMessages(user.id, id);
      setMessages(msgs);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao enviar";
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

  /** 🛡️ Duplo Escudo no chat */
  const handlePedirWhatsapp = async () => {
    if (!user) return;
    try {
      await backend.requestWhatsappShare(user.id, id);
      toast.success("Solicitação de contato enviada 📱");
      await carregar();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  };

  const handleResponderWhatsapp = async (approve: boolean) => {
    if (!user) return;
    try {
      await backend.respondWhatsappShare(user.id, id, approve);
      toast.success(
        approve
          ? "WhatsApp compartilhado! Contato liberado. 📱"
          : "Recusado — a conversa continua aqui com segurança. 🔒"
      );
      await carregar();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  };

  const handleConcluir = async () => {
    if (!user || !trade) return;
    setCompleting(true);
    try {
      await backend.updateTradeStatus(user.id, trade.id, "complete");
      toast.success(
        trade.requesterCompleted || trade.ownerCompleted
          ? "Troca concluída! Aguardando avaliação recíproca ⭐"
          : "Você concluiu sua parte — aguardando a outra parte confirmar 🎉"
      );
      await carregar();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao concluir";
      toast.error(message);
    } finally {
      setCompleting(false);
    }
  };

  const abrirWhatsApp = async () => {
    if (!user) return;
    const contato = await backend.getWhatsappContact(user.id, id);
    if (!contato) {
      toast.error("Contato ainda não autorizado nesta troca.");
      return;
    }
    window.open(
      `https://wa.me/55${contato.replace(/\D/g, "")}?text=${encodeURIComponent(
        `Olá! Sobre nossa troca "${trade?.adTitulo}" no TrocaES — vamos combinar os detalhes?`
      )}`,
      "_blank"
    );
  };

  if (!user) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9FB] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!trade || !chatState) return null;

  const chip = STATUS_CHIP[trade.status] ?? STATUS_CHIP.pending;
  const whatsappLiberado = whatsappAprovado(trade);

  return (
    <div className="min-h-screen bg-[#FAF9FB] flex flex-col">
      {/* ═══ CABEÇALHO ═══ */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-2xl mx-auto px-3 py-2.5 flex items-center gap-3">
          <button
            onClick={() => router.push("/trocas")}
            className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <Link href={`/perfil/${trade.otherId}`} className="flex items-center gap-2.5 min-w-0 flex-1">
            <Avatar src={trade.otherAvatar} name={trade.otherNome} size="md" />
            <div className="min-w-0">
              <p className="font-bold text-gray-900 text-sm truncate">
                {trade.otherNome}
              </p>
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                <span className="text-[11px] text-gray-500">
                  {(otherProfile?.mediaAvaliacao ?? 0).toFixed(1)} ·{" "}
                  {otherProfile?.trocasConcluidas ?? 0} trocas
                </span>
              </div>
            </div>
          </Link>
          <span
            className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${chip.cls}`}
          >
            {chip.label}
          </span>
        </div>

        {/* Anúncio da troca */}
        <div className="max-w-2xl mx-auto px-3 pb-2">
          <Link
            href={`/anuncio/${trade.adId}`}
            className="text-[11px] text-gray-500 bg-gray-50 rounded-lg px-2.5 py-1.5 block truncate hover:bg-gray-100 transition-colors"
          >
            🤝 {trade.adTitulo}
          </Link>
        </div>

        {/* Ações diretas no topo */}
        <div className="max-w-2xl mx-auto px-3 pb-2.5 flex gap-2">
          {whatsappLiberado && trade.otherWhatsapp && (
            <button
              onClick={abrirWhatsApp}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            >
              <MessageCircle className="w-4 h-4" />
              📱 Abrir WhatsApp
            </button>
          )}
          {trade.status === "in_progress" && (
            <button
              onClick={handleConcluir}
              disabled={completing}
              className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-60"
            >
              {completing ? "Concluindo..." : "✅ Concluir Troca"}
            </button>
          )}
          {trade.status === "awaiting_reviews" && (
            <Link
              href="/trocas"
              className="flex-1 border-2 border-purple-600 text-purple-700 text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 hover:bg-purple-50 active:scale-95 transition-all"
            >
              <Star className="w-4 h-4" />
              ⭐ Propor Avaliação
            </Link>
          )}
        </div>

        {/* Banner de contagem regressiva (após conclusão) */}
        {chatState.phase === "contagem" && (
          <div className="bg-amber-50 border-t border-amber-200 px-3 py-2">
            <p className="max-w-2xl mx-auto text-[11px] text-amber-800 font-medium text-center">
              ⏱️ Conversa temporária: expira em {chatState.daysLeft}{" "}
              {chatState.daysLeft === 1 ? "dia" : "dias"}. Avalie para encerrar.
            </p>
          </div>
        )}
      </header>

      {/* ═══ CORPO DA CONVERSA ═══ */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-3 py-4 flex flex-col gap-1.5">
          {/* 🛡️ PAINEL DE CONSENTIMENTO DE WHATSAPP */}
          {trade.whatsappShareStatus === "requested" &&
            trade.whatsappRequestedBy !== user.id && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 mb-2">
                <p className="text-sm text-blue-900 font-medium leading-relaxed mb-3">
                  📱 <strong>{trade.otherNome}</strong> solicitou seu número de
                  WhatsApp para conversarem fora da plataforma. Você deseja
                  compartilhar seu telefone?
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => handleResponderWhatsapp(true)}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs font-bold py-2.5 rounded-xl active:scale-95 transition-all"
                  >
                    ✓ Sim, Compartilhar meu WhatsApp
                  </button>
                  <button
                    onClick={() => handleResponderWhatsapp(false)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold py-2.5 rounded-xl active:scale-95 transition-all"
                  >
                    ✕ Não, manter no Chat Seguro
                  </button>
                </div>
              </div>
            )}
          {trade.whatsappShareStatus === "rejected" && (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 mb-2">
              <p className="text-xs text-gray-500 leading-relaxed">
                Compartilhamento de WhatsApp recusado. A negociação continuará
                com segurança através do Chat da Plataforma.
              </p>
            </div>
          )}
          {trade.whatsappShareStatus === "requested" &&
            trade.whatsappRequestedBy === user.id && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-2">
                <p className="text-xs text-amber-800">
                  📱 Solicitação de WhatsApp enviada — aguardando a decisão de{" "}
                  {trade.otherNome.split(" ")[0]}.
                </p>
              </div>
            )}

          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">💬</div>
              <p className="text-sm font-semibold text-gray-700 mb-1">
                Chat da plataforma
              </p>
              <p className="text-xs text-gray-500 max-w-xs mx-auto">
                Conversa temporária sobre esta troca. Combine os detalhes por
                aqui — o WhatsApp é liberado após o aceite do anunciante.
              </p>
            </div>
          )}

          {messages.map((m) => {
            const minha = m.senderId === user.id;
            return (
              <div
                key={m.id}
                className={`flex ${minha ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-3.5 py-2 shadow-sm ${
                    minha
                      ? "bg-purple-700 text-white rounded-2xl rounded-br-md"
                      : "bg-white text-gray-800 border border-gray-100 rounded-2xl rounded-bl-md"
                  }`}
                >
                  <p className="text-sm leading-snug break-words">{m.content}</p>
                  <div
                    className={`flex items-center justify-end gap-1 mt-0.5 ${
                      minha ? "text-purple-200" : "text-gray-400"
                    }`}
                  >
                    <span className="text-[10px]">{hora(m.createdAt)}</span>
                    {minha && m.readAt && (
                      <CheckCheck className="w-3 h-3 text-yellow-300" />
                    )}
                    {minha && !m.readAt && (
                      <Check className="w-3 h-3 opacity-60" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* ═══ COMPOSITOR ═══ */}
      <div className="bg-white border-t border-gray-100 sticky bottom-0 z-20 safe-area-pb">
        <div className="max-w-2xl mx-auto px-3 py-3">
          {chatState.canSend ? (
            <div className="flex flex-col gap-2">
              {trade.whatsappShareStatus === "none" && (
                <button
                  onClick={handlePedirWhatsapp}
                  className="self-end text-[11px] font-bold text-purple-700 border border-purple-200 rounded-full px-3 py-1.5 hover:bg-purple-50 transition-colors"
                >
                  📱 Solicitar Contato via WhatsApp
                </button>
              )}
              <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                rows={1}
                maxLength={1000}
                placeholder="Escreva uma mensagem..."
                className="flex-1 border-2 border-gray-200 rounded-2xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:border-purple-600 max-h-28"
              />
              <button
                onClick={handleSend}
                disabled={sending || !input.trim()}
                className="w-11 h-11 bg-purple-700 hover:bg-purple-800 text-white rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-50 active:scale-95 transition-all"
                aria-label="Enviar"
              >
                <Send className="w-5 h-5" />
              </button>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-gray-500 leading-relaxed">
                🔒 Esta conversa temporária foi encerrada e limpa por questões
                de privacidade. O histórico de reputação e avaliações permanece
                salvo no perfil.
              </p>
            </div>
          )}
          <p className="text-[10px] text-gray-300 text-center mt-1.5">
            💬 Chat temporário · apagado automaticamente 7 dias após a conclusão
          </p>
        </div>
      </div>
    </div>
  );
}
