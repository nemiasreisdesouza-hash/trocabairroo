"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Zap, Star, Shield } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useAuth } from "@/contexts/AuthContext";
import { PLANOS } from "@/lib/constants";
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
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [selectedAd, setSelectedAd] = useState<string>("");
  const [confirmModal, setConfirmModal] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    fetch("/api/users/me/ads")
      .then((res) => res.json())
      .then((data) => {
        setMyAds(
          (data.ads || []).filter((a: { status: string }) => a.status === "ativo")
        );
      });
  }, [user]);

  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId);
    if (planId !== "verificado" && myAds.length > 0) {
      setSelectedAd(myAds[0].id);
    }
  };

  const handleConfirm = async () => {
    if (!selectedPlan) return;
    if (selectedPlan !== "verificado" && !selectedAd) {
      toast.error("Selecione um anúncio");
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, string> = { tipoPlano: selectedPlan };
      if (selectedPlan !== "verificado" && selectedAd) {
        body.adId = selectedAd;
      }

      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success("Plano ativado com sucesso! 🚀");
      setConfirmModal(false);
      router.push("/dashboard");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao processar";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const activePlan = PLANOS.find((p) => p.id === selectedPlan);

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
          Escolha um plano para dar mais visibilidade ao seu anúncio ou perfil.
        </p>

        {PLANOS.map((plano) => {
          const isSelected = selectedPlan === plano.id;
          const key = plano.id as keyof typeof planColors;

          return (
            <button
              key={plano.id}
              onClick={() => handleSelectPlan(plano.id)}
              className={`w-full rounded-2xl overflow-hidden text-left transition-all ${
                isSelected
                  ? "ring-2 ring-purple-600 shadow-lg"
                  : "shadow-sm"
              }`}
            >
              <div
                className={`bg-gradient-to-r ${planColors[key]} p-4 flex items-center gap-3 text-white`}
              >
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  {planIcons[key]}
                </div>
                <div>
                  <p className="font-black text-lg">{plano.badge} {plano.nome}</p>
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
                    : `Válido por ${plano.duracao} dias`}
                </p>
              </div>
            </button>
          );
        })}

        {selectedPlan && selectedPlan !== "verificado" && myAds.length > 0 && (
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

        <div className="text-center py-4 bg-yellow-50 rounded-2xl border border-yellow-200">
          <p className="text-sm text-yellow-800 font-medium">
            💳 Pagamento via Mercado Pago em breve!
          </p>
          <p className="text-xs text-yellow-700 mt-1">
            Por enquanto, os planos são ativados automaticamente para demonstração.
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
            ? `Ativar ${activePlan?.nome} por R$ ${activePlan?.valor.toFixed(2)}`
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
            Ativar <strong>{activePlan?.nome}</strong> por{" "}
            <strong>
              R$ {activePlan?.valor.toFixed(2)}
            </strong>
            ?
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setConfirmModal(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              loading={loading}
              className="flex-1"
            >
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
