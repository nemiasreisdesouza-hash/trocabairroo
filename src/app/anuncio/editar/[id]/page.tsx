"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, X } from "lucide-react";
import Button from "@/components/ui/Button";
import { Input, Textarea, Select } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { CATEGORIAS, BAIRROS_VITORIA } from "@/lib/constants";
import toast from "react-hot-toast";

type AdImage = {
  id: string;
  imageUrl: string;
  ordem: number;
};

export default function EditarAnuncioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [adLoading, setAdLoading] = useState(true);
  const [images, setImages] = useState<AdImage[]>([]);
  const [newImages, setNewImages] = useState<{ file: File; preview: string }[]>([]);

  const [formData, setFormData] = useState({
    tipo: "ofereço" as "ofereço" | "preciso",
    titulo: "",
    descricao: "",
    categoria: "",
    bairro: "",
    aceitaEmTroca: "",
  });

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    fetchAd();
  }, [user, id]);

  const fetchAd = async () => {
    try {
      const res = await fetch(`/api/ads/${id}`);
      if (!res.ok) {
        toast.error("Anúncio não encontrado");
        router.push("/dashboard");
        return;
      }
      const data = await res.json();

      if (data.userId !== user?.id) {
        toast.error("Sem permissão");
        router.push("/dashboard");
        return;
      }

      setFormData({
        tipo: data.tipo,
        titulo: data.titulo,
        descricao: data.descricao,
        categoria: data.categoria,
        bairro: data.bairro,
        aceitaEmTroca: data.aceitaEmTroca,
      });

      // Load images separately
      setImages(
        (data.images || []).map((url: string, i: number) => ({
          id: `img-${i}`,
          imageUrl: url,
          ordem: i,
        }))
      );
    } catch {
      toast.error("Erro ao carregar anúncio");
      router.push("/dashboard");
    } finally {
      setAdLoading(false);
    }
  };

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
      const preview = URL.createObjectURL(file);
      setNewImages((prev) => [...prev, { file, preview }]);
    }

    e.target.value = "";
  };

  const handleSubmit = async () => {
    if (!formData.titulo || formData.titulo.length < 5) {
      toast.error("Título deve ter pelo menos 5 caracteres");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/ads/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      // Upload new images
      for (const img of newImages) {
        const fd = new FormData();
        fd.append("file", img.file);
        await fetch(`/api/ads/${id}/images`, { method: "POST", body: fd });
      }

      toast.success("Anúncio atualizado! ✅");
      router.push(`/anuncio/${id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao atualizar";
      toast.error(message);
    } finally {
      setLoading(false);
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
        <h1 className="font-black text-gray-900 text-lg">Editar anúncio</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-5">
        {/* Tipo */}
        <div>
          <label className="text-sm font-bold text-gray-700 mb-2 block">
            Tipo de anúncio
          </label>
          <div className="grid grid-cols-2 gap-3">
            {["ofereço", "preciso"].map((t) => (
              <button
                key={t}
                onClick={() => update("tipo", t)}
                className={`p-4 rounded-2xl border-2 font-bold transition-all ${
                  formData.tipo === t
                    ? t === "ofereço"
                      ? "border-purple-600 bg-purple-50 text-purple-700"
                      : "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-gray-200 bg-white text-gray-700"
                }`}
              >
                {t === "ofereço" ? "📣 OFEREÇO" : "🙋 PRECISO"}
              </button>
            ))}
          </div>
        </div>

        {/* Images */}
        <div>
          <label className="text-sm font-bold text-gray-700 mb-2 block">
            Fotos ({images.length + newImages.length}/3)
          </label>
          <div className="flex gap-3 flex-wrap">
            {images.map((img, i) => (
              <div key={i} className="relative w-24 h-24 rounded-2xl overflow-hidden">
                <img src={img.imageUrl} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
            {newImages.map((img, i) => (
              <div key={`new-${i}`} className="relative w-24 h-24 rounded-2xl overflow-hidden">
                <img src={img.preview} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => setNewImages((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
            {images.length + newImages.length < 3 && (
              <label className="w-24 h-24 rounded-2xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors">
                <Camera className="w-6 h-6 text-gray-400" />
                <span className="text-xs text-gray-400 mt-1">Adicionar</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageAdd} />
              </label>
            )}
          </div>
        </div>

        <Input
          label="Título"
          value={formData.titulo}
          onChange={(e) => update("titulo", e.target.value)}
          placeholder="Título do anúncio"
        />

        <Textarea
          label="Descrição"
          value={formData.descricao}
          onChange={(e) => update("descricao", e.target.value)}
          placeholder="Descrição do anúncio"
          rows={5}
        />

        <Select
          label="Categoria"
          value={formData.categoria}
          onChange={(e) => update("categoria", e.target.value)}
          options={CATEGORIAS.map((c) => ({ value: c, label: c }))}
        />

        <Select
          label="Bairro"
          value={formData.bairro}
          onChange={(e) => update("bairro", e.target.value)}
          options={BAIRROS_VITORIA.map((b) => ({ value: b, label: b }))}
        />

        <Input
          label="O que aceita em troca"
          value={formData.aceitaEmTroca}
          onChange={(e) => update("aceitaEmTroca", e.target.value)}
          placeholder="Ex: Açaí, design, aulas..."
        />

        <Button onClick={handleSubmit} loading={loading} fullWidth size="lg">
          Salvar alterações ✅
        </Button>
      </div>
    </div>
  );
}
