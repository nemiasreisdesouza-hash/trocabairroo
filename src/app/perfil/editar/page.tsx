"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import { Input, Textarea, Select } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { CATEGORIAS, BAIRROS_VITORIA } from "@/lib/constants";
import toast from "react-hot-toast";

export default function EditarPerfilPage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    nome: "",
    bio: "",
    whatsapp: "",
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

    // Load current user data
    fetch(`/api/users/${user.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setFormData({
            nome: data.user.nome || "",
            bio: data.user.bio || "",
            whatsapp: data.user.whatsapp || "",
            bairro: data.user.bairro || "",
            tipoPerfil: data.user.tipoPerfil || "empreendedor",
            categorias: data.user.categorias || [],
            avatarUrl: data.user.avatarUrl,
          });
        }
      });
  }, [user]);

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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 5MB");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "avatars");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setFormData((prev) => ({ ...prev, avatarUrl: data.url }));
      toast.success("Foto atualizada!");
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
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      await refreshUser();
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
            Toque para alterar a foto de perfil
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
          onChange={(e) => update("whatsapp", e.target.value)}
          placeholder="(27) 9 9999-9999"
        />

        <Select
          label="Bairro"
          value={formData.bairro}
          onChange={(e) => update("bairro", e.target.value)}
          options={BAIRROS_VITORIA.map((b) => ({ value: b, label: b }))}
          placeholder="Selecione seu bairro"
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
                onClick={() => update("tipoPerfil", value)}
                className={`p-3 rounded-2xl border-2 text-center transition-all ${
                  formData.tipoPerfil === value
                    ? "border-purple-600 bg-purple-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <div className="text-2xl">{label}</div>
                <div className="text-xs font-semibold text-gray-700 mt-1">
                  {desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-700 mb-2 block">
            Categorias
          </label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIAS.map((cat) => (
              <button
                key={cat}
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

        <Button
          onClick={handleSubmit}
          loading={loading}
          fullWidth
          size="lg"
          className="mt-2"
        >
          Salvar alterações ✅
        </Button>
      </div>
    </div>
  );
}
