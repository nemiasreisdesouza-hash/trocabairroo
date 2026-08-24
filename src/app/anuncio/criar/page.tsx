"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, X } from "lucide-react";
import Button from "@/components/ui/Button";
import { Input, Textarea, Select } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import {
  CATEGORIAS,
  CIDADES_ES,
  BAIRROS_POR_CIDADE,
  CIDADE_PADRAO,
} from "@/lib/constants";
import * as backend from "@/lib/backend";
import toast from "react-hot-toast";

export default function CriarAnuncioPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);

  const [formData, setFormData] = useState({
    tipo: "ofereço" as "ofereço" | "preciso",
    titulo: "",
    descricao: "",
    categoria: "",
    cidade: "",
    bairro: "",
    aceitaEmTroca: "",
  });

  const [images, setImages] = useState<
    { file: File; preview: string }[]
  >([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // defaults derivados do perfil (sem mutar estado durante o render)
  const cidadeEfetiva =
    formData.cidade ||
    (user?.uf === "ES" && user?.cidade ? user.cidade : CIDADE_PADRAO);
  const bairroEfetivo = formData.bairro || user?.bairro || "";
  const bairros = BAIRROS_POR_CIDADE[cidadeEfetiva] ?? null;

  const update = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleImageAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > 3) {
      toast.error("Máximo de 3 fotos por anúncio");
      return;
    }

    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} é muito grande. Máximo 5MB`);
        continue;
      }
      const preview = URL.createObjectURL(file);
      setImages((prev) => [...prev, { file, preview }]);
    }

    e.target.value = "";
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const newImages = [...prev];
      URL.revokeObjectURL(newImages[index].preview);
      newImages.splice(index, 1);
      return newImages;
    });
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.titulo || formData.titulo.length < 5)
      newErrors.titulo = "Título deve ter pelo menos 5 caracteres";
    if (!formData.descricao || formData.descricao.length < 20)
      newErrors.descricao = "Descrição deve ter pelo menos 20 caracteres";
    if (!formData.categoria) newErrors.categoria = "Selecione uma categoria";
    if (!formData.cidade) newErrors.cidade = "Informe a cidade";
    if (!formData.bairro) newErrors.bairro = "Selecione o bairro";
    if (!formData.aceitaEmTroca || formData.aceitaEmTroca.length < 5)
      newErrors.aceitaEmTroca = "Informe o que aceita em troca";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!user) {
      router.push("/login");
      return;
    }

    if (!validate()) return;

    setLoading(true);
    try {
      // Bloqueio de avaliação pendente também vale para anunciar?
      // Não — o bloqueio é para novas TROCAS. Anunciar segue liberado.

      const adId = await backend.createAd(user.id, {
        ...formData,
        cidade: cidadeEfetiva,
        bairro: bairroEfetivo,
        uf: user.uf || "ES",
      });

      if (images.length > 0) {
        setUploadingImages(true);
        const urls: string[] = [];
        for (const img of images) {
          const url = await backend.uploadImage(img.file, "ads", user.id);
          urls.push(url);
        }
        await backend.setAdImages(adId, urls);
      }

      toast.success("Anúncio publicado com sucesso! 🎉");
      router.push(`/anuncio/${adId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao criar anúncio";
      toast.error(message);
    } finally {
      setLoading(false);
      setUploadingImages(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9FB] pb-8">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="font-black text-gray-900 text-lg">Publicar anúncio</h1>
          <p className="text-xs text-gray-500">Conecte com seu bairro</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-5">
        {/* Tipo */}
        <div>
          <label className="text-sm font-bold text-gray-700 mb-2 block">
            O que você quer fazer?
          </label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: "ofereço", label: "📣 Ofereço", desc: "Tenho algo a oferecer" },
              { value: "preciso", label: "🙋 Preciso", desc: "Estou precisando de algo" },
            ].map(({ value, label, desc }) => (
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
                <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Fotos */}
        <div>
          <label className="text-sm font-bold text-gray-700 mb-2 block">
            Fotos{" "}
            <span className="font-normal text-gray-400">
              ({images.length}/3)
            </span>
          </label>
          <div className="flex gap-3 flex-wrap">
            {images.map((img, i) => (
              <div
                key={i}
                className="relative w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0"
              >
                <img
                  src={img.preview}
                  alt=""
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
            {images.length < 3 && (
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
          <p className="text-xs text-gray-500 mt-2">
            💡 Anúncios com foto têm 3x mais interesse
          </p>
        </div>

        {/* Título */}
        <Input
          label="Título do anúncio"
          placeholder="Ex: Produzo vídeos para Instagram"
          value={formData.titulo}
          onChange={(e) => update("titulo", e.target.value)}
          error={errors.titulo}
          maxLength={100}
        />

        {/* Descrição */}
        <Textarea
          label="Descrição"
          placeholder="Descreva em detalhes o que você oferece ou precisa, sua experiência, disponibilidade..."
          value={formData.descricao}
          onChange={(e) => update("descricao", e.target.value)}
          error={errors.descricao}
          rows={5}
        />

        {/* Categoria */}
        <Select
          label="Categoria"
          value={formData.categoria}
          onChange={(e) => update("categoria", e.target.value)}
          options={CATEGORIAS.map((c) => ({ value: c, label: c }))}
          placeholder="Selecione uma categoria"
          error={errors.categoria}
        />

        {/* Cidade + Bairro */}
        <Select
          label="Cidade"
          value={cidadeEfetiva}
          onChange={(e) => {
            update("cidade", e.target.value);
            setFormData((prev) => ({ ...prev, bairro: "" }));
          }}
          options={CIDADES_ES.map((c) => ({ value: c, label: c }))}
          placeholder="Selecione a cidade"
          error={errors.cidade}
        />

        {bairros ? (
          <Select
            label="Bairro"
            value={bairros.includes(bairroEfetivo) ? bairroEfetivo : formData.bairro}
            onChange={(e) => update("bairro", e.target.value)}
            options={bairros.map((b) => ({ value: b, label: b }))}
            placeholder="Selecione o bairro"
            error={errors.bairro}
          />
        ) : (
          <Input
            label="Bairro"
            placeholder="Seu bairro"
            value={formData.bairro}
            onChange={(e) => update("bairro", e.target.value)}
            error={errors.bairro}
          />
        )}

        {/* Aceita em troca */}
        <Input
          label="O que aceita em troca? 🔄"
          placeholder="Ex: Açaí, corte de cabelo, design de logo..."
          value={formData.aceitaEmTroca}
          onChange={(e) => update("aceitaEmTroca", e.target.value)}
          error={errors.aceitaEmTroca}
          hint="Seja específico para atrair as pessoas certas"
        />

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          loading={loading || uploadingImages}
          fullWidth
          size="lg"
          className="mt-2"
        >
          {uploadingImages
            ? "Enviando fotos..."
            : loading
            ? "Publicando..."
            : "Publicar anúncio 🚀"}
        </Button>

        <p className="text-center text-xs text-gray-500">
          Ao publicar, você aceita que outros usuários vejam seu WhatsApp
        </p>
      </div>
    </div>
  );
}
