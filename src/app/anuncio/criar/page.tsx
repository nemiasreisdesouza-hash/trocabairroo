"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, X, Zap, Lock, BadgeCheck, Crown } from "lucide-react";
import Button from "@/components/ui/Button";
import { Input, Textarea, Select } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { CATEGORIAS, IMPULSIONAMENTOS } from "@/lib/constants";
import { CidadeField, BairroField } from "@/components/ui/LocationFields";
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

  // [URGENTE] Exclusivo verificados azul/dourado - flag urgente
  const [isUrgent, setIsUrgent] = useState(false);

  // [P1] Boost inline opt-in - mesmo adId, pagamento simulado demo
  const [boostOption, setBoostOption] = useState<"gratis" | "destaque" | "topo_feed">("gratis");

  // Pré-seleciona cidade/bairro do perfil UMA única vez (o valor
  // final pode ser da lista ou custom — CidadeField resolve sozinho)
  const defaultsApplied = useRef(false);
  useEffect(() => {
    if (!user || defaultsApplied.current) return;
    defaultsApplied.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormData((prev) =>
      prev.cidade === "" && prev.bairro === ""
        ? { ...prev, cidade: user.cidade || "", bairro: user.bairro || "" }
        : prev
    );
  }, [user]);

  const [images, setImages] = useState<
    { file: File; preview: string }[]
  >([]);
  const [errors, setErrors] = useState<Record<string, string>>({});


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
    if (!formData.cidade.trim()) newErrors.cidade = "Informe a cidade";
    if (!formData.bairro.trim()) newErrors.bairro = "Selecione ou digite o bairro";
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

    // [P0-FIX] Validação: se usuário selecionou fotos, garantir que pelo menos 1 seja válida
    // Não bloquear publish se sem foto, mas se com foto, upload deve ser atômico
    if (images.length === 0) {
      // Opcional: permitir sem foto, mas avisar
      // toast("Dica: anúncios com foto têm 3x mais interesse");
    }

    setLoading(true);
    let createdAdId: string | null = null;
    try {
      // [AD-IMAGE-DEBUG] + [AD-IMG-PROOF] - fix mínimo certeiro: gera adId client-side antes de tudo
      const adId = crypto.randomUUID();
      createdAdId = adId;
      console.log('[AD-IMAGE-DEBUG] submit start', { adId, filesCount: images.length, formData });

      let urls: string[] = [];

      if (images.length > 0) {
        setUploadingImages(true);
        const uploadResults: any[] = [];
        for (const img of images) {
          // Usa img.file (File) NUNCA preview blob:
          const result = await backend.uploadAdImageWithCleanup(img.file, user.id, adId);
          uploadResults.push({ success: result.success, urlLen: result.url?.length, urlPrefix: result.url?.slice(0,30), path: result.path, error: result.error });
          // Valida url: data:image/ ou https://
          if (!result.success || !result.url || !(result.url.startsWith('data:image/') || result.url.startsWith('https://') || result.url.startsWith('http://'))) {
            throw new Error(result.error || "Falha ao enviar foto - URL inválida. Tente JPG menor.");
          }
          urls.push(result.url);
        }

        console.log('[AD-IMAGE-DEBUG] uploadResults', { uploadResults, payloadImagesLen: urls.length });
        console.info('[AD-IMG-PROOF] after upload', { adId, imagesLen: urls.length, firstPrefix: urls[0]?.slice(0,30) });

        if (urls.length === 0) throw new Error("Nenhuma foto foi salva.");

        // Cria ad COM images + isUrgent exclusivo verificado
        const finalAdId = await backend.createAd(user.id, {
          id: adId,
          ...formData,
          cidade: formData.cidade.trim(),
          bairro: formData.bairro.trim(),
          uf: user.uf || "ES",
          images: urls,
          isUrgent: isUrgent,
        } as any);

        // Prova read-after-write obrigatória
        const saved = await backend.getAdById(finalAdId);
        console.log('[AD-IMAGE-DEBUG] savedAdImages', { savedImagesLen: saved?.images?.length, firstPrefix: saved?.images?.[0]?.slice(0,30) });
        console.info('[AD-IMG-PROOF]', { adId: finalAdId, imagesLen: saved?.images?.length, firstPrefix: saved?.images?.[0]?.slice(0,30) });

        if (!saved?.images?.[0] || !(saved.images[0].startsWith('data:image/') || saved.images[0].startsWith('https://'))) {
          throw new Error('PERSIST_IMAGES_FAILED: getAdById().images[0] não é data:image/ ou https:// - persistência falhou');
        }

        // Verifica listUserAds thumb
        try {
          const myAds = await backend.listUserAds(user.id);
          const found = myAds.find(a => a.id === finalAdId);
          console.info('[AD-IMG-PROOF] listUserAdsThumb', { foundImagesLen: found?.images?.length, firstPrefix: found?.images?.[0]?.slice(0,30) });
        } catch {}

      } else {
        // Sem fotos: cria ad direto com id + isUrgent
        await backend.createAd(user.id, {
          id: adId,
          ...formData,
          cidade: formData.cidade.trim(),
          bairro: formData.bairro.trim(),
          uf: user.uf || "ES",
          isUrgent: isUrgent,
        } as any);
      }

      // [P1] Aplica boost inline no mesmo adId se opt-in
      if (createdAdId && boostOption !== "gratis") {
        try {
          await backend.activatePlan(user.id, boostOption, createdAdId);
        } catch (e) {
          console.warn("[boost-inline] falha ao aplicar boost", e);
          toast("Anúncio criado, mas falha ao aplicar impulsionamento. Tente em Impulsionar.");
        }
      }

      // Só toast sucesso se prova passou
      toast.success("Anúncio publicado com sucesso! 🎉");
      router.push(`/perfil/${user.id}`);
      router.refresh();
    } catch (err: unknown) {
      // Se falhou após criar ad, remove órfão para não deixar placeholder cinza
      if (createdAdId) {
        try {
          await backend.deleteAd(user.id, createdAdId);
        } catch {}
      }
      const message = err instanceof Error ? err.message : "Erro ao criar anúncio";
      console.error('[AD-IMG-PROOF] FAILED', { error: message, adId: createdAdId });
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
        {/* 🛡️ AVISO PRÉ-PUBLICAÇÃO · exclusão condicionada a trocas */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 flex items-start gap-3">
          <span className="text-2xl leading-none flex-shrink-0">ℹ️</span>
          <p className="text-sm text-blue-900 font-medium leading-relaxed">
            Você poderá <strong>excluir seu anúncio a qualquer momento</strong>,
            desde que <strong>NÃO</strong> existam trocas iniciadas ou pendentes
            de avaliação vinculadas a ele.
          </p>
        </div>

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
          maxLength={50}
          showCount
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

        {/* 🏙️ Cidade com opção dinâmica "Outra cidade..." */}
        <CidadeField
          value={formData.cidade}
          onChange={(v) => {
            // Seleção atualiza o estado NA HORA e limpa o erro
            setFormData((prev) => ({ ...prev, cidade: v, bairro: "" }));
            setErrors((prev) => ({ ...prev, cidade: "", bairro: "" }));
          }}
          error={errors.cidade}
        />

        {/* 📍 Bairro com opção dinâmica "Outro bairro..." */}
        <BairroField
          key={formData.cidade}
          cidade={formData.cidade}
          value={formData.bairro}
          onChange={(v) => {
            setFormData((prev) => ({ ...prev, bairro: v }));
            setErrors((prev) => ({ ...prev, bairro: "" }));
          }}
          error={errors.bairro}
        />

        {/* Aceita em troca */}
        <Input
          label="O que aceita em troca? 🔄"
          placeholder="Ex: Açaí, corte de cabelo, design de logo..."
          value={formData.aceitaEmTroca}
          onChange={(e) => update("aceitaEmTroca", e.target.value)}
          error={errors.aceitaEmTroca}
          hint="Seja específico para atrair as pessoas certas"
          maxLength={40}
          showCount
        />

        {/* [URGENTE] Só verificados azul/dourado podem marcar como urgente - tanto ofereço quanto preciso */}
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
                    <p className="text-xs text-gray-500">Aparece no filtro Urgente em destaque</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isUrgent}
                    disabled={!isVerified}
                    onChange={(e) => {
                      if (!isVerified) {
                        toast.error('Só usuários verificados (selo azul ✅ e parceiro dourado 🟡) podem marcar como urgente. Ative em Planos.');
                        return;
                      }
                      setIsUrgent(e.target.checked);
                    }}
                    className="sr-only peer"
                  />
                  <div className={`w-11 h-6 rounded-full peer transition-all ${!isVerified ? 'bg-gray-200 opacity-60' : isUrgent ? 'bg-red-500' : 'bg-gray-300'} peer-focus:outline-none peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all`}></div>
                </label>
              </div>
              {!isVerified ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
                  <Lock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-amber-900">Só verificados podem usar Urgente 🔒</p>
                    <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                      Esse recurso é exclusivo para <strong>selo azul verificado ✅</strong> e <strong>parceiro dourado 🟡</strong>. Verificados transmitem mais confiança para pedidos urgentes.
                    </p>
                    <a href="/planos" className="inline-flex mt-2 text-[11px] font-bold text-purple-700 hover:underline">
                      Ativar selo verificado por R$ 29,90 → Ver planos
                    </a>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-gray-500 bg-white/60 rounded-lg px-2.5 py-1.5 border border-gray-100">
                  {isUrgent ? '✅ Seu anúncio entrará no filtro Urgente com destaque vermelho ⚡' : 'Marque para aparecer no filtro Urgente. Funciona tanto para OFEREÇO quanto PRECISO.'}
                </p>
              )}
            </div>
          );
        })()}

        {/* [P1] Quer mais visibilidade? - boost inline opt-in */}
        <div className="bg-gradient-to-br from-violet-50 to-amber-50 border border-violet-200 rounded-2xl p-4 flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-black text-gray-900 flex items-center gap-1.5">
              🚀 Quer mais visibilidade?
            </h3>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">
              Pode impulsionar depois em Impulsionar; comprar agora aplica neste anúncio.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <label className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${boostOption === "gratis" ? "border-violet-600 bg-white shadow-sm" : "border-violet-100 bg-white/70 hover:border-violet-200"}`}>
              <input
                type="radio"
                name="boost"
                value="gratis"
                checked={boostOption === "gratis"}
                onChange={() => setBoostOption("gratis")}
                className="mt-1 accent-violet-600"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900">⬜ Grátis</p>
                <p className="text-xs text-gray-500">Publicar sem impulsionamento</p>
              </div>
            </label>
            <label className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${boostOption === "destaque" ? "border-amber-400 bg-white shadow-sm" : "border-violet-100 bg-white/70 hover:border-violet-200"}`}>
              <input
                type="radio"
                name="boost"
                value="destaque"
                checked={boostOption === "destaque"}
                onChange={() => setBoostOption("destaque")}
                className="mt-1 accent-amber-500"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5">⭐ Selo Destaque R$ 5 • 30 dias</p>
                <p className="text-xs text-gray-600">Em Destaque + badge dourado no card</p>
              </div>
            </label>
            <label className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${boostOption === "topo_feed" ? "border-violet-600 bg-white shadow-sm" : "border-violet-100 bg-white/70 hover:border-violet-200"}`}>
              <input
                type="radio"
                name="boost"
                value="topo_feed"
                checked={boostOption === "topo_feed"}
                onChange={() => setBoostOption("topo_feed")}
                className="mt-1 accent-violet-600"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5">🚀 Topo Feed R$ 3 • 7 dias</p>
                <p className="text-xs text-gray-600">Prioridade no topo do feed</p>
              </div>
            </label>
          </div>
          <p className="text-[11px] text-violet-600 bg-white/60 rounded-lg px-2.5 py-1.5 border border-violet-100">
            💡 Parceiro Gold pode impulsionar também. Não oferecemos selo verificado aqui — ele é do perfil (R$ 29,90) em Planos.
          </p>
        </div>

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
