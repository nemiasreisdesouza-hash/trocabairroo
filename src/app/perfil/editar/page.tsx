"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import { Input, Textarea, Select } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { CATEGORIAS, UFS } from "@/lib/constants";
import { CidadeField, BairroField } from "@/components/ui/LocationFields";
import { maskPhone } from "@/lib/validators";
import * as backend from "@/lib/backend";
import toast from "react-hot-toast";

export default function EditarPerfilPage() {
  const { user, refreshUser, applyUserUpdate } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    nome: "",
    bio: "",
    whatsapp: "",
    uf: "ES",
    cidade: "",
    bairro: "",
    tipoPerfil: "empreendedor",
    categorias: [] as string[],
    avatarUrl: null as string | null,
  });

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    backend.getProfileById(user.id).then((profile) => {
      if (profile) {
        setFormData({
          nome: profile.nome || "",
          bio: profile.bio || "",
          whatsapp: profile.whatsapp || "",
          uf: profile.uf || "ES",
          cidade: profile.cidade || "",
          bairro: profile.bairro || "",
          tipoPerfil: profile.tipoPerfil || "empreendedor",
          categorias: profile.categorias || [],
          avatarUrl: profile.avatarUrl,
        });
      }
    });
  }, [user, router]);

  const update = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleCategoria = (cat: string) => {
    setFormData((prev) => ({
      ...prev,
      categorias: prev.categorias.includes(cat)
        ? prev.categorias.filter((c) => c !== cat)
        : [...prev.categorias, cat],
    }));
  };

  /**
   * ═════════════════════════════════════════════════════
   * CORREÇÃO DO BUG DE SINCRONIZAÇÃO DO AVATAR:
   * 1. Faz upload imediato (Storage 'avatars' ou dataURL demo)
   * 2. Persiste no perfil (updateProfile)
   * 3. Atualiza o AuthContext na hora (applyUserUpdate) —
   *    o Avatar do Header/BottomNav atualiza instantaneamente
   * 4. Dispara evento global de sincronização
   * ═════════════════════════════════════════════════════
   */
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 5MB");
      return;
    }

    setUploading(true);
    try {
      // 1. Upload (Supabase Storage 'avatars' / dataURL no modo demo)
      const url = await backend.uploadImage(file, "avatars", user.id);

      // 2. Persiste no perfil
      const updated = await backend.updateProfile(user.id, { avatarUrl: url });
      setFormData((prev) => ({ ...prev, avatarUrl: url }));

      // 3+4. Sincroniza Header/Menu instantaneamente
      applyUserUpdate(updated);
      toast.success("Foto atualizada! ✨");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao fazer upload";
      toast.error(message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!formData.nome || formData.nome.length < 2) {
      toast.error("Nome deve ter pelo menos 2 caracteres");
      return;
    }

    setLoading(true);
    try {
      const updated = await backend.updateProfile(user.id, {
        nome: formData.nome,
        bio: formData.bio,
        whatsapp: formData.whatsapp,
        uf: formData.uf,
        cidade: formData.cidade.trim(),
        bairro: formData.bairro.trim(),
        tipoPerfil: formData.tipoPerfil,
        categorias: formData.categorias,
        avatarUrl: formData.avatarUrl ?? undefined,
      });

      await refreshUser();
      applyUserUpdate(updated);
      toast.success("Perfil atualizado! ✅");
      router.push(`/perfil/${user.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao atualizar";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;


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
          <h1 className="font-black text-gray-900 text-lg">Editar perfil</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-5">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <Avatar
              src={formData.avatarUrl}
              name={formData.nome || user.nome}
              size="xl"
            />
            <label className="absolute bottom-0 right-0 w-8 h-8 bg-purple-700 rounded-full flex items-center justify-center cursor-pointer hover:bg-purple-800 transition-colors">
              <Camera className="w-4 h-4 text-white" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
                disabled={uploading}
              />
            </label>
          </div>
          {uploading && (
            <p className="text-sm text-purple-600 font-medium animate-pulse">
              Enviando foto...
            </p>
          )}
          <p className="text-xs text-gray-500">
            Toque para alterar a foto de perfil (sincroniza com o menu)
          </p>
        </div>

        <Input
          label="Nome"
          value={formData.nome}
          onChange={(e) => update("nome", e.target.value)}
          placeholder="Seu nome"
        />

        <Textarea
          label="Bio"
          value={formData.bio}
          onChange={(e) => update("bio", e.target.value)}
          placeholder="Conte um pouco sobre você e seus serviços..."
          rows={3}
        />

        <Input
          label="WhatsApp"
          type="tel"
          value={formData.whatsapp}
          onChange={(e) => update("whatsapp", maskPhone(e.target.value))}
          placeholder="(27) 99999-9999"
        />

        <Select
          label="Estado (UF)"
          value={formData.uf}
          onChange={(e) => {
            const uf = e.target.value;
            setFormData((prev) => ({ ...prev, uf, cidade: "", bairro: "" }));
          }}
          options={UFS.map((uf) => ({ value: uf, label: uf }))}
        />

        {/* 🏙️ Cidade com opção dinâmica "Outra cidade..." */}
        <CidadeField
          key={formData.uf}
          uf={formData.uf}
          value={formData.cidade}
          onChange={(v) => {
            setFormData((prev) => ({ ...prev, cidade: v, bairro: "" }));
          }}
        />

        {/* 📍 Bairro com opção dinâmica "Outro bairro..." */}
        <BairroField
          key={`${formData.uf}-${formData.cidade}`}
          uf={formData.uf}
          cidade={formData.cidade}
          value={formData.bairro}
          onChange={(v) => {
            setFormData((prev) => ({ ...prev, bairro: v }));
          }}
        />

        <div>
          <label className="text-sm font-semibold text-gray-700 mb-2 block">
            Tipo de perfil
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: "empreendedor", label: "🏪", desc: "Empreendedor" },
              { value: "criador", label: "🎨", desc: "Criador" },
              { value: "ambos", label: "⚡", desc: "Ambos" },
            ].map(({ value, label, desc }) => (
              <button
                key={value}
                type="button"
                onClick={() => update("tipoPerfil", value)}
                className={`p-3 rounded-2xl border-2 text-center transition-all ${
                  formData.tipoPerfil === value
                    ? "border-purple-600 bg-purple-50"
                    : "border-gray-200"
                }`}
              >
                <div className="text-xl">{label}</div>
                <div className="text-xs font-semibold text-gray-700">{desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-700 mb-2 block">
            Categorias de atuação
          </label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIAS.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => toggleCategoria(cat)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all ${
                  formData.categorias.includes(cat)
                    ? "bg-purple-700 border-purple-700 text-white"
                    : "border-gray-200 text-gray-700 bg-white"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <Button onClick={handleSubmit} loading={loading} fullWidth size="lg">
          Salvar alterações ✅
        </Button>
      </div>
    </div>
  );
}
