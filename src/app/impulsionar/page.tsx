"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Zap, Star, Shield, Crown } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useAuth } from "@/contexts/AuthContext";
import { IMPULSIONAMENTOS, type Impulsionamento } from "@/lib/constants";
import * as backend from "@/lib/backend";
import toast from "react-hot-toast";

type MyAd = {
  id: string;
  titulo: string;
  tipo: string;
  categoria: string;
};

const planIcons = {
  topo_feed: <Zap className="w-6 h-6" />,
  destaque: <Star className="w-6 h-6" />,
  verificado: <Shield className="w-6 h-6" />,
};

const planColors = {
  topo_feed: "from-purple-500 to-purple-700",
  destaque: "from-yellow-400 to-yellow-600",
  verificado: "from-blue-500 to-blue-700",
};

export default function ImpulsionarPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [myAds, setMyAds] = useState<MyAd[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Impulsionamento | null>(null);
  const [selectedAd, setSelectedAd] = useState<string>("");
  const [confirmModal, setConfirmModal] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    backend
      .listUserAds(user.id)
      .then((ads) => setMyAds(ads.filter((a) => a.status === "ativo")))
      .catch(() => {});
  }, [user, router]);

  const handleSelectPlan = (plano: Impulsionamento) => {
    setSelectedPlan(plano);
    if (plano.id !== "verificado" && myAds.length > 0) {
      setSelectedAd(myAds[0].id);
    }
  };

  const handleConfirm = async () => {
    if (!user || !selectedPlan) return;
    if (selectedPlan.id !== "verificado" && !selectedAd) {
      toast.error("Selecione um anúncio");
      return;
    }

    setLoading(true);
    try {
      await backend.activatePlan(user.id, selectedPlan.id, selectedAd || null);
      toast.success("Impulsionamento ativado com sucesso! 🚀");
      setConfirmModal(false);
      router.push("/dashboard");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao processar";
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
          <h1 className="font-black text-gray-900 text-lg">Impulsionar</h1>
          <p className="text-xs text-gray-500">Apareça para mais pessoas</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-4">
        <p className="text-gray-600 text-sm">
          Escolha um impulsionamento para dar mais visibilidade ao seu anúncio
          ou perfil.
        </p>

        {IMPULSIONAMENTOS.map((plano) => {
          const isSelected = selectedPlan?.id === plano.id;
          const key = plano.id as keyof typeof planColors;

          return (
            <button
              key={plano.id}
              onClick={() => handleSelectPlan(plano)}
              className={`w-full rounded-2xl overflow-hidden text-left transition-all ${
                isSelected ? "ring-2 ring-purple-600 shadow-lg" : "shadow-sm"
              }`}
            >
              <div
                className={`bg-gradient-to-r ${planColors[key]} p-4 flex items-center gap-3 text-white`}
              >
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  {planIcons[key]}
                </div>
                <div>
                  <p className="font-black text-lg">
                    {plano.badge} {plano.nome}
                  </p>
                  <p className="text-white/80 text-sm">{plano.descricao}</p>
                </div>
                {isSelected && (
                  <CheckCircle2 className="w-6 h-6 ml-auto flex-shrink-0" />
                )}
              </div>
              <div className="bg-white p-4">
                <div className="flex items-end gap-1">
                  <span className="text-3xl font-black text-gray-900">
                    R${" "}
                    {plano.valor.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                  {plano.id === "verificado" && (
                    <span className="text-gray-500 text-sm mb-1">/mês</span>
                  )}
                </div>
                <p className="text-gray-500 text-sm mt-1">
                  {plano.id === "verificado"
                    ? "Verificação por 30 dias"
                    : `Válido por ${plano.duracaoDias} dias`}
                </p>
              </div>
            </button>
          );
        })}

        {/* Planos mensais */}
        <Link
          href="/planos"
          className="bg-gradient-to-br from-purple-700 to-purple-900 rounded-2xl p-4 text-white flex items-center gap-3"
        >
          <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center flex-shrink-0">
            <Crown className="w-5 h-5 text-yellow-400" />
          </div>
          <div className="flex-1">
            <p className="font-black">Planos mensais</p>
            <p className="text-purple-200 text-xs">
              Conexão R$ 49,90/mês · Expansão R$ 89,90/mês
            </p>
          </div>
        </Link>

        {selectedPlan && selectedPlan.id !== "verificado" && myAds.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-sm font-bold text-gray-700 mb-2">
              Selecione o anúncio
            </p>
            <div className="flex flex-col gap-2">
              {myAds.map((ad) => (
                <button
                  key={ad.id}
                  onClick={() => setSelectedAd(ad.id)}
                  className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                    selectedAd === ad.id
                      ? "border-purple-600 bg-purple-50"
                      : "border-gray-200"
                  }`}
                >
                  <p className="font-semibold text-gray-900 text-sm">
                    {ad.titulo}
                  </p>
                  <p className="text-xs text-gray-500">
                    {ad.tipo} · {ad.categoria}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedPlan && selectedPlan.id !== "verificado" && myAds.length === 0 && (
          <div className="text-center py-4 bg-yellow-50 rounded-2xl border border-yellow-200">
            <p className="text-sm text-yellow-800 font-medium">
              Você precisa de um anúncio ativo para este impulsionamento
            </p>
            <Link href="/anuncio/criar" className="text-xs text-purple-700 font-semibold underline mt-1 inline-block">
              Criar anúncio agora
            </Link>
          </div>
        )}

        <div className="text-center py-4 bg-yellow-50 rounded-2xl border border-yellow-200">
          <p className="text-sm text-yellow-800 font-medium">
            💳 Pagamento simulado nesta versão
          </p>
          <p className="text-xs text-yellow-700 mt-1">
            Os impulsionamentos são ativados automaticamente para demonstração.
          </p>
        </div>

        <Button
          onClick={() => selectedPlan && setConfirmModal(true)}
          disabled={!selectedPlan}
          fullWidth
          size="lg"
          variant="secondary"
        >
          {selectedPlan
            ? `Ativar ${selectedPlan.nome} por R$ ${selectedPlan.valor.toFixed(2)}`
            : "Selecione um plano acima"}
        </Button>
      </div>

      <Modal
        isOpen={confirmModal}
        onClose={() => setConfirmModal(false)}
        title="Confirmar plano"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <p className="text-gray-700">
            Ativar <strong>{selectedPlan?.nome}</strong> por{" "}
            <strong>R$ {selectedPlan?.valor.toFixed(2)}</strong>?
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setConfirmModal(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button onClick={handleConfirm} loading={loading} className="flex-1">
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
