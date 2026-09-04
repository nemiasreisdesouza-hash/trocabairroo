"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Zap } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useAuth } from "@/contexts/AuthContext";
import { PLANOS_ASSINATURA, type PlanoAssinatura } from "@/lib/constants";
import * as backend from "@/lib/backend";
import { startCheckout } from "@/lib/payment";
import toast from "react-hot-toast";

export default function PlanosPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [confirmPlano, setConfirmPlano] = useState<PlanoAssinatura | null>(null);
  const [successPlano, setSuccessPlano] = useState<PlanoAssinatura | null>(null);
  const [meuPlano, setMeuPlano] = useState<string>("experimente");
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  // ── Retorno do Mercado Pago (?checkout=sucesso|pendente|erro) ──
  // Lido UMA vez no primeiro render (SSR-safe: window existe só no client).
  const [checkoutReturn] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("checkout")
  );

  const fetchMeuPlano = async () => {
    if (!user) return;
    try {
      const subs = await backend.listSubscriptions(user.id);
      const prioridade: Record<string, number> = { experimente: 1, conexao: 2, expansao: 3 };
      let best = 'experimente';
      let bestPrio = 0;
      let bestDate = 0;
      for (const s of subs) {
        if (s.status !== 'ativo') continue;
        if (!['conexao','expansao','experimente'].includes(s.plano)) continue;
        if ((s as any).expiresAt && new Date((s as any).expiresAt) < new Date()) continue;
        const p = prioridade[s.plano] ?? 0;
        const d = new Date((s as any).createdAt || 0).getTime();
        if (p > bestPrio || (p === bestPrio && d > bestDate)) {
          bestPrio = p; best = s.plano; bestDate = d;
        }
      }
      setMeuPlano(best);
    } catch {}
  };

  useEffect(() => {
    // [REALTIME] Carrega o plano atual no mount (código pré-existente)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMeuPlano();
    // [REALTIME] Atualiza instantaneamente quando assina - só escuta subscription para evitar loop com db save
    const handler = (e: any) => {
      const det = e?.detail || {};
      if (det.entity === 'subscription') {
        fetchMeuPlano();
      }
    };
    window.addEventListener('trocabairro:store' as any, handler);
    const storageHandler = (ev: StorageEvent) => {
      if (ev.key === 'trocabairro:demo:signal') {
        try {
          const d = JSON.parse(ev.newValue || '{}');
          if (d.entity === 'subscription') fetchMeuPlano();
        } catch { fetchMeuPlano(); }
      }
    };
    window.addEventListener('storage', storageHandler);
    return () => {
      window.removeEventListener('trocabairro:store' as any, handler);
      window.removeEventListener('storage', storageHandler);
    };
  }, [user]);

  // Remove o parâmetro da URL após a leitura (sem reload, sem setState)
  useEffect(() => {
    if (!checkoutReturn || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has("checkout")) return;
    params.delete("checkout");
    params.delete("sub");
    const rest = params.toString();
    router.replace(rest ? `/planos?${rest}` : "/planos", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!checkoutReturn) return;
    if (checkoutReturn === "sucesso") {
      toast.success("Pagamento aprovado! Ativando seu plano…");
      // O webhook do MP leva alguns segundos — reconfirma a ativação
      const t1 = setTimeout(() => fetchMeuPlano(), 2500);
      const t2 = setTimeout(() => fetchMeuPlano(), 7000);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
    if (checkoutReturn === "pendente") {
      toast("Pagamento pendente. Assim que o Mercado Pago aprovar, seu plano é ativado automaticamente.", {
        icon: "⏳",
        duration: 6000,
      });
      return;
    }
    if (checkoutReturn === "erro") {
      toast.error("Pagamento não concluído. Se o valor foi debitado, ele é ativado assim que for aprovado.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutReturn]);

  const handleAssinar = async () => {
    if (!user || !confirmPlano) return;
    const planoId = confirmPlano.id;
    const planoObj = confirmPlano;
    setLoading(true);
    try {
      const result = await startCheckout({
        plano: planoId,
        valor: planoObj.preco,
        titulo: `TrocaES · Plano ${planoObj.nome} (mensal)`,
        adId: null,
        userId: user.id,
      });
      if (result.simulated) {
        // Fallback dev/demo: ativação local (comportamento original)
        setMeuPlano(planoId);
        setConfirmPlano(null);
        setSuccessPlano(planoObj);
        await fetchMeuPlano();
        return;
      }
      // Pagamento real: redireciona ao Mercado Pago (volta com ?checkout=...)
      setRedirecting(true);
      setConfirmPlano(null);
      window.location.href = result.initPoint as string;
      return;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao assinar";
      toast.error(message);
    } finally {
      setLoading(false);
      setRedirecting(false);
    }
  };

  const getSuccessContent = (plano: PlanoAssinatura) => {
    if (plano.id === "conexao") {
      return {
        emoji: "🚀",
        titulo: "Você agora é Conexão!",
        subtitulo: "Que conquista incrível, bem-vindo ao time que mais troca no bairro! 💜",
        mensagem: "Seu plano Conexão está ativo e sua visibilidade acaba de decolar. A partir de agora seus anúncios têm muito mais força para encontrar quem precisa de você bem pertinho.",
        vantagens: [
          "📣 5 publicações por mês para mostrar tudo que você faz",
          "🚀 1 Topo do Feed por mês - seu anúncio no topo por 7 dias",
          "⭐ Selo Destaque em 1 anúncio - brilho dourado que chama atenção",
          "📊 Estatísticas de visualizações para saber o que bomba",
          "💬 Suporte prioritário via WhatsApp - a gente te responde voando",
        ],
        cta: "Seus vizinhos vão te encontrar muito mais rápido. Bora fazer trocas incríveis e fazer seu bairro girar! 🌟",
        cor: "from-violet-600 via-purple-600 to-indigo-600",
      };
    }
    if (plano.id === "expansao") {
      return {
        emoji: "👑",
        titulo: "Bem-vindo ao topo, Expansão!",
        subtitulo: "Uau! Você acaba de liberar o máximo do TrocaES. Você é referência! ✨",
        mensagem: "O plano Expansão é para quem quer dominar a cidade. Visibilidade total, confiança máxima e divulgação que vai além do seu bairro.",
        vantagens: [
          "📣 15 publicações por mês - mostre todo seu talento sem limite",
          "✅ Selo Verificado azul incluso - transmite confiança e libera Urgente",
          "🚀 3 impulsionamentos por mês - topo e destaque quando quiser",
          "🏙️ Destaque em toda a cidade, não só no bairro",
          "📢 Divulgação nas redes oficiais do TrocaES - a gente te espalha",
        ],
        cta: "Você agora é referência no município. Seu talento vai brilhar para todo mundo. Vamos transformar trocas em sucesso! 🌟",
        cor: "from-amber-500 via-yellow-500 to-amber-600",
      };
    }
    return {
      emoji: "🌱",
      titulo: "Bem-vindo ao TrocaES!",
      subtitulo: "Que alegria ter você por aqui! Seu primeiro passo para trocar com vizinhos! 💚",
      mensagem: "Seu plano Experimente está ativo. É grátis e perfeito para conhecer a plataforma e fazer suas primeiras trocas pertinho de casa.",
      vantagens: [
        "🌱 1 publicação grátis por mês para começar",
        "💬 Contato direto via WhatsApp com seus vizinhos",
        "⭐ Reputação com estrelas e % de aprovação real",
        "🤝 Avaliações recíprocas que constroem sua confiança no bairro",
      ],
      cta: "Comece publicando seu primeiro anúncio. Quem está do seu lado pode precisar exatamente do que você oferece! ✨",
      cor: "from-green-500 via-emerald-500 to-teal-600",
    };
  };

  return (
    <div className="min-h-screen bg-[#FAF9FB] pb-8">
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="font-black text-gray-900 text-lg">Planos</h1>
          <p className="text-xs text-gray-500">Impulsione suas trocas 🚀</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-5">
        {PLANOS_ASSINATURA.map((plano) => {
          const isAtual = meuPlano === plano.id;
          return (
            <div key={plano.id} className="relative">
              {/* 🔥 SELO VIP FLUTUANTE — Plano Conexão */}
              {plano.destaque && (
                <span className="absolute -top-3 left-6 z-10 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-purple-950 font-black text-[10px] sm:text-xs uppercase tracking-widest px-3 py-1 rounded-full shadow-md border border-amber-300 flex items-center gap-1.5">
                  🔥 Mais Popular
                </span>
              )}
              <div
                className={`bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 relative ${
                  plano.destaque
                    ? "border-2 border-amber-400 shadow-md ring-4 ring-amber-400/10"
                    : "border border-purple-100 shadow-sm"
                }`}
              >
                {/* Cabeçalho: ícone + título | preço grande */}
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-2xl flex-shrink-0">{plano.badge}</span>
                    <h2 className="text-base sm:text-xl font-extrabold text-gray-900">
                      {plano.nome}
                    </h2>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {plano.preco === 0 ? (
                      <p className="text-lg sm:text-2xl font-black text-purple-950">
                        Grátis
                      </p>
                    ) : (
                      <p className="text-lg sm:text-2xl font-black text-purple-950">
                        R${" "}
                        {plano.preco.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                        <span className="text-xs text-gray-400 font-semibold">
                          /mês
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Descrição completa — sem cortes, quebra natural */}
                <p className="break-words whitespace-normal leading-relaxed text-xs sm:text-sm text-gray-600 mb-4">
                  {plano.descricao}
                </p>

                <div className="flex flex-col gap-2 mb-4">
                  {plano.features.map((f) => (
                    <div key={f} className="flex items-start gap-2">
                      <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-green-700" />
                      </div>
                      <span className="text-sm text-gray-700">{f}</span>
                    </div>
                  ))}
                </div>

                {isAtual ? (
                  <div className="w-full py-3 rounded-2xl bg-green-50 border-2 border-green-200 text-green-700 font-bold text-center text-sm">
                    ✓ Plano atual
                  </div>
                ) : plano.preco === 0 ? (
                  <Link href={user ? "/dashboard" : "/cadastro"} className="block">
                    <Button variant="outline" fullWidth size="lg">
                      {user ? "Usar plano grátis" : "Criar conta grátis"}
                    </Button>
                  </Link>
                ) : (
                  <Button
                    variant={plano.destaque ? "secondary" : "primary"}
                    fullWidth
                    size="lg"
                    onClick={() => {
                      if (!user) {
                        router.push("/login");
                        return;
                      }
                      setConfirmPlano(plano);
                    }}
                  >
                    Assinar {plano.nome}
                  </Button>
                )}
              </div>
            </div>
          );
        })}

        {/* Impulsionamentos avulsos */}
        <Link
          href="/impulsionar"
          className="bg-gradient-to-br from-purple-700 to-purple-900 rounded-2xl p-5 text-white flex items-center gap-4"
        >
          <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Zap className="w-6 h-6 text-yellow-400" />
          </div>
          <div className="flex-1">
            <p className="font-black text-lg">Impulsionamentos avulsos</p>
            <p className="text-purple-200 text-sm">
              Topo do Feed R$ 3 · Destaque R$ 5 · Verificado R$ 29,90/mês
            </p>
          </div>
        </Link>

        <p className="text-center text-xs text-gray-400 px-6">
          Pagamento seguro via Mercado Pago (PIX e cartão). Após aprovar o
          pagamento, você volta automaticamente para cá.
        </p>
      </div>

      <Modal
        isOpen={!!confirmPlano}
        onClose={() => setConfirmPlano(null)}
        title="Confirmar assinatura"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <p className="text-gray-700">
            Assinar o plano <strong>{confirmPlano?.nome}</strong> por{" "}
            <strong>
              R${" "}
              {confirmPlano?.preco.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
              })}
              {confirmPlano?.periodo}
            </strong>
            ?
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <p className="text-xs text-blue-800">💳 Você será redirecionado ao Mercado Pago para pagar com PIX ou cartão. Assim que o pagamento for aprovado, seu plano é ativado automaticamente.</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setConfirmPlano(null)}
              disabled={redirecting}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button onClick={handleAssinar} loading={loading || redirecting} className="flex-1">
              {redirecting ? "Redirecionando para pagamento…" : "Confirmar"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 🎉 Modal de Sucesso - Mensagem bacana pós-compra */}
      <Modal
        isOpen={!!successPlano}
        onClose={() => setSuccessPlano(null)}
        title=""
        size="md"
      >
        {successPlano && (() => {
          const c = getSuccessContent(successPlano);
          return (
            <div className="flex flex-col gap-5 -mt-2">
              <div className={`w-full h-2 rounded-full bg-gradient-to-r ${c.cor}`} />
              <div className="text-center">
                <div className="text-5xl mb-3 animate-bounce">{c.emoji}</div>
                <h2 className="text-2xl font-black text-gray-900 leading-tight">{c.titulo}</h2>
                <p className="text-sm font-bold text-purple-700 mt-1">{c.subtitulo}</p>
              </div>
              <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100 rounded-2xl p-4">
                <p className="text-sm text-gray-700 leading-relaxed">{c.mensagem}</p>
              </div>
              <div className="flex flex-col gap-2.5">
                <p className="text-xs font-black tracking-widest text-gray-500 uppercase">O que você liberou agora:</p>
                {c.vantagens.map((v) => (
                  <div key={v} className="flex items-start gap-2.5 bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
                    <span className="text-sm leading-none mt-0.5">{v.split(' ')[0]}</span>
                    <span className="text-sm text-gray-800 font-medium leading-snug">{v.substring(v.indexOf(' ')+1)}</span>
                  </div>
                ))}
              </div>
              <div className={`bg-gradient-to-r ${c.cor} rounded-2xl p-4 text-white`}>
                <p className="text-sm font-bold leading-relaxed">💜 {c.cta}</p>
              </div>
              <div className="flex flex-col gap-2.5">
                <Button
                  fullWidth
                  size="lg"
                  onClick={() => {
                    setSuccessPlano(null);
                    router.push("/notificacoes");
                  }}
                  className={`bg-gradient-to-r ${c.cor} border-0`}
                >
                  Ver minha notificação 🔔
                </Button>
                <Button
                  variant="outline"
                  fullWidth
                  onClick={() => {
                    setSuccessPlano(null);
                    router.push("/anuncio/criar");
                  }}
                >
                  Criar anúncio agora 🚀
                </Button>
                <button
                  onClick={() => setSuccessPlano(null)}
                  className="text-xs text-gray-400 font-semibold py-2 hover:text-gray-600"
                >
                  Continuar navegando
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
