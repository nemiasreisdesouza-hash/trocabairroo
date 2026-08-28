"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, X, Trash2, AlertTriangle, Lock, Zap, BadgeCheck } from "lucide-react";
import Button from "@/components/ui/Button";
import { Input, Textarea, Select } from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { useAuth } from "@/contexts/AuthContext";
import { CATEGORIAS } from "@/lib/constants";
import { CidadeField, BairroField } from "@/components/ui/LocationFields";
import * as backend from "@/lib/backend";
import type { AdDeletionStatus } from "@/lib/backend";
import type { AdDetail } from "@/lib/types";
import toast from "react-hot-toast";

type ExistingImage = { id: string; imageUrl: string };

export default function EditarAnuncioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [adLoading, setAdLoading] = useState(true);
  const [deletion, setDeletion] = useState<AdDeletionStatus | null>(null);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [images, setImages] = useState<ExistingImage[]>([]);
  const [newImages, setNewImages] = useState<{ file: File; preview: string }[]>([]);

  const [formData, setFormData] = useState({
    tipo: "ofereço" as "ofereço" | "preciso",
    titulo: "",
    descricao: "",
    categoria: "",
    cidade: "",
    bairro: "",
    aceitaEmTroca: "",
  });

  // [URGENTE] Exclusivo verificados
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    // Regras anti-fraude de exclusão/edição deste anúncio
    backend
      .getAdDeletionStatus(id)
      .then(setDeletion)
      .catch(() => setDeletion(null));
    backend
      .getAdById(id)
      .then((ad: AdDetail | null) => {
        if (!ad) {
          toast.error("Anúncio não encontrado");
          router.push("/dashboard");
          return;
        }
        if (ad.userId !== user?.id) {
          toast.error("Sem permissão");
          router.push("/dashboard");
          return;
        }
        setFormData({
          tipo: ad.tipo as "ofereço" | "preciso",
          titulo: ad.titulo,
          descricao: ad.descricao,
          categoria: ad.categoria,
          cidade: ad.cidade,
          bairro: ad.bairro,
          aceitaEmTroca: ad.aceitaEmTroca,
        });
        setIsUrgent(!!(ad as any).isUrgent);
        setImages(ad.images.map((url, i) => ({ id: `img-${i}`, imageUrl: url })));
      })
      .catch(() => {
        toast.error("Erro ao carregar anúncio");
        router.push("/dashboard");
      })
      .finally(() => setAdLoading(false));
  }, [user, id, router]);

  const update = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };


  const handleImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const totalImages = images.length + newImages.length + files.length;

    if (totalImages > 3) {
      toast.error("Máximo de 3 fotos por anúncio");
      return;
    }

    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} é muito grande. Máximo 5MB`);
        continue;
      }
      const preview = URL.createObjectURL(file);
      setNewImages((prev) => [...prev, { file, preview }]);
    }

    e.target.value = "";
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (avaliacaoPendente) {
      toast.error(
        "Este anúncio possui avaliação pendente. Conclua as avaliações antes de qualquer alteração."
      );
      return;
    }
    if (!formData.titulo || formData.titulo.length < 5) {
      toast.error("Título deve ter pelo menos 5 caracteres");
      return;
    }

    setLoading(true);
    try {
      await backend.updateAd(id, {
        ...formData,
        cidade: formData.cidade.trim(),
        bairro: formData.bairro.trim(),
        uf: user.uf || "ES",
        isUrgent: isUrgent,
      });

      // [P0-FIX] Upload atômico + [FIX-EDITAR] persistência total ao editar (evita foto quebrada)
      // Sempre computa lista final: imagens restantes + novas uploadadas
      let finalUrls: string[] = [...images.map((i) => i.imageUrl)];
      if (newImages.length > 0) {
        for (const img of newImages) {
          const result = await backend.uploadAdImageWithCleanup(img.file, user.id, id);
          if (!result.success || !result.url) {
            throw new Error(result.error || "Falha ao enviar foto. Verifique formato e tamanho.");
          }
          finalUrls.push(result.url);
        }
      }
      // [FIX] Persiste sempre que houver mudança de imagens (remoção ou adição)
      // Antes só persistia quando newImages>0 ou quando ficava vazio, deixando remoção parcial sem salvar
      await backend.setAdImages(id, finalUrls);

      toast.success("Anúncio atualizado! ✅");
      router.push(`/anuncio/${id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao atualizar";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 🛡️ Regras anti-fraude:
   *  a) sem trocas ativas/pendentes → exclusão normal (anúncio + fotos);
   *  b) pending/accepted/in_progress → exclusão BLOQUEADA;
   *  c) awaiting_reviews → TUDO bloqueado (editar e excluir);
   *  avaliações e reputação NUNCA são apagadas.
   */
  const avaliacaoPendente = !!deletion && deletion.awaitingReviews > 0;
  const trocaAtiva = !!deletion && deletion.activeTrades > 0;
  const podeExcluir = !!deletion && deletion.canDelete;

  const handleDelete = async () => {
    if (!user || !podeExcluir) return;
    setDeleting(true);
    try {
      await backend.deleteAd(user.id, id); // remove anúncio + fotos do Storage
      toast.success("Anúncio excluído");
      router.push("/dashboard");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao excluir";
      toast.error(message);
    } finally {
      setDeleting(false);
      setDeleteModal(false);
    }
  };

  if (adLoading) {
    return (
      <div className="min-h-screen bg-[#FAF9FB] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full" />
      </div>
    );
  }

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
          <h1 className="font-black text-gray-900 text-lg">Editar anúncio</h1>
          <p className="text-xs text-gray-500">{formData.titulo}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-5">
        {/* Tipo */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: "ofereço", label: "📣 Ofereço" },
            { value: "preciso", label: "🙋 Preciso" },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => update("tipo", value)}
              className={`p-4 rounded-2xl border-2 text-left transition-all ${
                formData.tipo === value
                  ? value === "ofereço"
                    ? "border-purple-600 bg-purple-50"
                    : "border-blue-600 bg-blue-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <div className="text-2xl mb-1">{label.split(" ")[0]}</div>
              <div className="font-bold text-gray-900 text-sm">
                {label.split(" ").slice(1).join(" ")}
              </div>
            </button>
          ))}
        </div>

        {/* Fotos */}
        <div>
          <label className="text-sm font-bold text-gray-700 mb-2 block">
            Fotos{" "}
            <span className="font-normal text-gray-400">
              ({images.length + newImages.length}/3)
            </span>
          </label>
          <div className="flex gap-3 flex-wrap">
            {images.map((img, i) => (
              <div
                key={img.id}
                className="relative w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0"
              >
                <img src={img.imageUrl} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
            {newImages.map((img, i) => (
              <div
                key={`new-${i}`}
                className="relative w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 ring-2 ring-purple-400"
              >
                <img src={img.preview} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() =>
                    setNewImages((prev) => prev.filter((_, j) => j !== i))
                  }
                  className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
            {images.length + newImages.length < 3 && (
              <label className="w-24 h-24 rounded-2xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors flex-shrink-0">
                <Camera className="w-6 h-6 text-gray-400" />
                <span className="text-xs text-gray-400 mt-1">Adicionar</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageAdd}
                />
              </label>
            )}
          </div>
        </div>

        <Input
          label="Título do anúncio"
          value={formData.titulo}
          onChange={(e) => update("titulo", e.target.value)}
          maxLength={50}
          showCount
        />

        <Textarea
          label="Descrição"
          value={formData.descricao}
          onChange={(e) => update("descricao", e.target.value)}
          rows={5}
        />

        <Select
          label="Categoria"
          value={formData.categoria}
          onChange={(e) => update("categoria", e.target.value)}
          options={CATEGORIAS.map((c) => ({ value: c, label: c }))}
          placeholder="Selecione uma categoria"
        />

        {/* 🏙️ Cidade com opção dinâmica "Outra cidade..." */}
        <CidadeField
          value={formData.cidade}
          onChange={(v) => {
            setFormData((prev) => ({ ...prev, cidade: v, bairro: "" }));
          }}
        />

        {/* 📍 Bairro com opção dinâmica "Outro bairro..." */}
        <BairroField
          key={formData.cidade}
          cidade={formData.cidade}
          value={formData.bairro}
          onChange={(v) => {
            setFormData((prev) => ({ ...prev, bairro: v }));
          }}
        />

        <Input
          label="O que aceita em troca? 🔄"
          value={formData.aceitaEmTroca}
          onChange={(e) => update("aceitaEmTroca", e.target.value)}
          hint="Seja específico para atrair as pessoas certas"
          maxLength={40}
          showCount
        />

        {/* [URGENTE] Só verificados */}
        {(() => {
          const isVerified = !!(user?.verificado || (user as any)?.isPartner);
          return (
            <div className={`rounded-2xl p-4 flex flex-col gap-3 border-2 ${isUrgent ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isUrgent ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-gray-900 flex items-center gap-1.5">
                      ⚡ Marcar como Urgente
                      {isVerified ? (
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <BadgeCheck className="w-3 h-3" /> Verificado
                        </span>
                      ) : (
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <Lock className="w-3 h-3" /> Bloqueado
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-gray-500">Aparece no filtro Urgente</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isUrgent}
                    disabled={!isVerified}
                    onChange={(e) => {
                      if (!isVerified) {
                        toast.error('Só verificados podem marcar como urgente');
                        return;
                      }
                      setIsUrgent(e.target.checked);
                    }}
                    className="sr-only peer"
                  />
                  <div className={`w-11 h-6 rounded-full peer transition-all ${!isVerified ? 'bg-gray-200 opacity-60' : isUrgent ? 'bg-red-500' : 'bg-gray-300'} peer-focus:outline-none peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all`}></div>
                </label>
              </div>
              {!isVerified && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
                  <Lock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-amber-900">Só verificados podem usar Urgente 🔒</p>
                    <p className="text-[11px] text-amber-800 mt-1">Recurso exclusivo selo azul ✅ e parceiro dourado 🟡. Ative em Planos.</p>
                    <a href="/planos" className="inline-flex mt-2 text-[11px] font-bold text-purple-700 hover:underline">Ver planos →</a>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* 🛡️ c) Avaliação pendente bloqueia QUALQUER ação */}
        {avaliacaoPendente && (
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <Lock className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 font-medium">
              Este anúncio possui avaliação pendente. Conclua as avaliações
              antes de qualquer alteração.
            </p>
          </div>
        )}

        {/* 🛡️ b) Troca em andamento bloqueia a exclusão */}
        {!avaliacaoPendente && trocaAtiva && (
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-800 font-medium">
              Não é possível excluir anúncio com negociação em andamento.
            </p>
          </div>
        )}

        {/* Info: histórico concluído (exclusão apenas via regra anti-fraude) */}
        {!avaliacaoPendente && !trocaAtiva && deletion && !deletion.canDelete && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800 font-medium">
              Este anúncio possui trocas concluídas: apenas o salvamento é
              permitido — as avaliações e o histórico de reputação permanecem
              para sempre no perfil.
            </p>
          </div>
        )}

        <Button
          onClick={handleSubmit}
          loading={loading}
          disabled={avaliacaoPendente}
          fullWidth
          size="lg"
        >
          {avaliacaoPendente ? "Bloqueado por avaliação pendente 🔒" : "Salvar alterações ✅"}
        </Button>

        {/* 🗑️ Excluir anúncio (regras anti-fraude acima) */}
        <Button
          variant="danger"
          onClick={() => {
            if (avaliacaoPendente) {
              toast.error(
                "Este anúncio possui avaliação pendente. Conclua as avaliações antes de qualquer alteração."
              );
              return;
            }
            if (trocaAtiva) {
              toast.error(
                "Não é possível excluir anúncio com negociação em andamento."
              );
              return;
            }
            if (!deletion) {
              toast.error("Verificando regras de exclusão, tente novamente...");
              return;
            }
            setDeleteModal(true);
          }}
          disabled={!deletion || !deletion.canDelete || deleting}
          fullWidth
          size="lg"
          icon={<Trash2 className="w-5 h-5" />}
          className="!bg-white !text-red-600 !shadow-none border-2 !border-red-300 hover:!bg-red-50"
        >
          {deleting ? "Excluindo..." : "Excluir anúncio"}
        </Button>
      </div>

      {/* Confirmação de exclusão */}
      <Modal
        isOpen={deleteModal}
        onClose={() => setDeleteModal(false)}
        title="Excluir anúncio?"
        size="sm"
      >
        <p className="text-gray-600 mb-4">
          Tem certeza? O anúncio e suas fotos serão apagados
          permanentemente. Avaliações e histórico de reputação do seu perfil{" "}
          <strong>não são afetados</strong>.
        </p>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setDeleteModal(false)}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            loading={deleting}
            className="flex-1"
          >
            Excluir
          </Button>
        </div>
      </Modal>
    </div>
  );
}
