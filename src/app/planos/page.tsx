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

  useEffect(() => {
    if (!user) return;
    backend
      .listSubscriptions(user.id)
      .then((subs) => {
        const ativa = subs.find(
          (s) =>
            ["conexao", "expansao"].includes(s.plano) && s.status === "ativo"
        );
        if (ativa) setMeuPlano(ativa.plano);
      })
      .catch(() => {});
  }, [user]);

  const handleAssinar = async () => {
    if (!user || !confirmPlano) return;
    if (!user) {
      router.push("/login");
      return;
    }
    setLoading(true);
    try {
      await backend.activatePlan(user.id, confirmPlano.id, null);
      setMeuPlano(confirmPlano.id);
      toast.success(
        confirmPlano.id === "experimente"
          ? "Plano Experimente ativado! 🌱"
          : `Plano ${confirmPlano.nome} ativado! 🚀`
      );
      setConfirmPlano(null);
    } catch (err: unknown) {
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
          <p className="text-xs text-gray-500">Cresça no seu bairro 🚀</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-4">
        {PLANOS_ASSINATURA.map((plano) => {
          const isAtual = meuPlano === plano.id;
          return (
            <div
              key={plano.id}
              className={`bg-white rounded-2xl shadow-sm overflow-hidden ${
                plano.destaque ? "ring-2 ring-yellow-400" : ""
              }`}
            >
              {plano.destaque && (
                <div className="bg-yellow-400 text-center py-1.5">
                  <span className="text-xs font-black text-gray-900 tracking-wide">
                    ⭐ MAIS POPULAR
                  </span>
                </div>
              )}
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{plano.badge}</span>
                      <h2 className="font-black text-xl text-gray-900">
                        {plano.nome}
                      </h2>
                    </div>
                    <p className="text-sm text-gray-500">{plano.descricao}</p>
                  </div>
                  <div className="text-right">
                    {plano.preco === 0 ? (
                      <p className="text-2xl font-black text-green-600">Grátis</p>
                    ) : (
                      <>
                        <p className="text-2xl font-black text-gray-900">
                          R${" "}
                          {plano.preco.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                        <p className="text-xs text-gray-400">{plano.periodo}</p>
                      </>
                    )}
                  </div>
                </div>

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
