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
import toast from "react-hot-toast";

export default function PlanosPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [confirmPlano, setConfirmPlano] = useState<PlanoAssinatura | null>(null);
  const [meuPlano, setMeuPlano] = useState<string>("experimente");
  const [loading, setLoading] = useState(false);

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
    fetchMeuPlano();
    // [REALTIME] Atualiza instantaneamente quando assina em outra tela ou aba
    const handler = (e: any) => {
      const det = e?.detail || {};
      if (det.entity === 'subscription' || det.entity === 'db') {
        fetchMeuPlano();
      }
    };
    window.addEventListener('trocabairro:store' as any, handler);
    const storageHandler = (ev: StorageEvent) => {
      if (ev.key === 'trocabairro:demo:db' || ev.key === 'trocabairro:demo:signal') {
        fetchMeuPlano();
      }
    };
    window.addEventListener('storage', storageHandler);
    return () => {
      window.removeEventListener('trocabairro:store' as any, handler);
      window.removeEventListener('storage', storageHandler);
    };
  }, [user]);

  const handleAssinar = async () => {
    if (!user || !confirmPlano) return;
    if (!user) {
      router.push("/login");
      return;
    }
    const planoId = confirmPlano.id;
    const planoNome = confirmPlano.nome;
    // [REALTIME] Otimista: atualiza UI instantaneamente antes do backend
    setMeuPlano(planoId);
    setLoading(true);
    try {
      await backend.activatePlan(user.id, planoId, null);
      toast.success(
        planoId === "experimente"
          ? "Plano Experimente ativado! 🌱"
          : `Plano ${planoNome} ativado! 🚀`
      );
      setConfirmPlano(null);
      // Garante que outras telas (criar, home) atualizem
      await fetchMeuPlano();
    } catch (err: unknown) {
      // Reverte otimista se falhar de verdade
      await fetchMeuPlano();
      const message = err instanceof Error ? err.message : "Erro ao assinar";
      toast.error(message);
    } finally {
      setLoading(false);
    }
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
          Pagamentos simulados nesta versão — nenhum valor é cobrado. Em
          produção, integre o gateway de sua preferência.
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
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setConfirmPlano(null)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button onClick={handleAssinar} loading={loading} className="flex-1">
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
