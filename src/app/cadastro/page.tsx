"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { User, Mail, Lock, Phone, MapPin, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import { CATEGORIAS, BAIRROS_VITORIA } from "@/lib/constants";

export default function CadastroPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    senha: "",
    confirmarSenha: "",
    whatsapp: "",
    tipoPerfil: "empreendedor" as "empreendedor" | "criador" | "ambos",
    bairro: "",
    categorias: [] as string[],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const toggleCategoria = (cat: string) => {
    setFormData((prev) => ({
      ...prev,
      categorias: prev.categorias.includes(cat)
        ? prev.categorias.filter((c) => c !== cat)
        : [...prev.categorias, cat],
    }));
  };

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.nome || formData.nome.length < 2)
      newErrors.nome = "Nome deve ter pelo menos 2 caracteres";
    if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email))
      newErrors.email = "Email inválido";
    if (!formData.senha || formData.senha.length < 6)
      newErrors.senha = "Senha deve ter pelo menos 6 caracteres";
    if (formData.senha !== formData.confirmarSenha)
      newErrors.confirmarSenha = "Senhas não conferem";
    if (!formData.whatsapp || formData.whatsapp.replace(/\D/g, "").length < 10)
      newErrors.whatsapp = "WhatsApp inválido";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.bairro) newErrors.bairro = "Selecione seu bairro";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) setStep(2);
  };

  const handleSubmit = async () => {
    if (!validateStep2()) return;

    setLoading(true);
    try {
      await register({
        nome: formData.nome,
        email: formData.email,
        senha: formData.senha,
        whatsapp: formData.whatsapp,
        tipoPerfil: formData.tipoPerfil,
        bairro: formData.bairro,
        categorias: formData.categorias,
      });
      toast.success("Conta criada com sucesso! 🎉");
      router.push("/dashboard");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao criar conta";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9FB] flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-b from-purple-800 to-purple-700 px-5 pt-10 pb-8">
        <Link href="/" className="inline-flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
            <span className="text-white text-sm font-black">TB</span>
          </div>
          <span className="font-black text-white text-lg">
            Troca<span className="text-yellow-400">Bairro</span>
          </span>
        </Link>
        <h1 className="text-2xl font-black text-white mb-1">
          {step === 1 ? "Criar conta grátis 🚀" : "Quase lá! 🎉"}
        </h1>
        <p className="text-purple-200 text-sm">
          {step === 1
            ? "Leva só 2 minutos"
            : "Defina seu perfil no bairro"}
        </p>
        {/* Progress */}
        <div className="flex gap-2 mt-4">
          <div className="h-1.5 flex-1 bg-yellow-400 rounded-full" />
          <div className={`h-1.5 flex-1 rounded-full ${step === 2 ? "bg-yellow-400" : "bg-white/30"}`} />
        </div>
      </div>

      <div className="flex-1 px-5 py-6 max-w-md mx-auto w-full">
        {step === 1 ? (
          <div className="flex flex-col gap-4">
            <Input
              label="Seu nome"
              placeholder="Como você se chama?"
              value={formData.nome}
              onChange={(e) => update("nome", e.target.value)}
              icon={<User className="w-5 h-5" />}
              error={errors.nome}
              autoComplete="name"
            />
            <Input
              label="Email"
              type="email"
              placeholder="seu@email.com"
              value={formData.email}
              onChange={(e) => update("email", e.target.value)}
              icon={<Mail className="w-5 h-5" />}
              error={errors.email}
              autoComplete="email"
            />
            <Input
              label="WhatsApp"
              type="tel"
              placeholder="(27) 9 9999-9999"
              value={formData.whatsapp}
              onChange={(e) => update("whatsapp", e.target.value)}
              icon={<Phone className="w-5 h-5" />}
              error={errors.whatsapp}
              hint="Usado para combinar as trocas"
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-gray-700">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={formData.senha}
                  onChange={(e) => update("senha", e.target.value)}
                  className={`w-full border-2 rounded-2xl pl-10 pr-12 py-3 text-base focus:outline-none focus:border-purple-600 transition-colors ${errors.senha ? "border-red-400 bg-red-50" : "border-gray-200 bg-white"}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.senha && <p className="text-xs text-red-600 font-medium">{errors.senha}</p>}
            </div>
            <Input
              label="Confirmar senha"
              type="password"
              placeholder="Repita a senha"
              value={formData.confirmarSenha}
              onChange={(e) => update("confirmarSenha", e.target.value)}
              icon={<Lock className="w-5 h-5" />}
              error={errors.confirmarSenha}
            />
            <Button onClick={handleNext} fullWidth size="lg" className="mt-2">
              Continuar →
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Select
              label="Seu bairro"
              value={formData.bairro}
              onChange={(e) => update("bairro", e.target.value)}
              options={BAIRROS_VITORIA.map((b) => ({ value: b, label: b }))}
              placeholder="Selecione seu bairro"
              error={errors.bairro}
            />

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-gray-700">
                Tipo de perfil
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "empreendedor", label: "🏪 Empreendedor", desc: "Tenho negócio" },
                  { value: "criador", label: "🎨 Criador", desc: "Presto serviços" },
                  { value: "ambos", label: "⚡ Ambos", desc: "Os dois" },
                ].map(({ value, label, desc }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => update("tipoPerfil", value)}
                    className={`p-3 rounded-2xl border-2 text-center transition-all ${
                      formData.tipoPerfil === value
                        ? "border-purple-600 bg-purple-50"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <div className="text-xl">{label.split(" ")[0]}</div>
                    <div className="text-xs font-bold text-gray-800 mt-1">
                      {label.split(" ").slice(1).join(" ")}
                    </div>
                    <div className="text-xs text-gray-500">{desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-gray-700">
                Suas categorias{" "}
                <span className="text-gray-400 font-normal">(opcional)</span>
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

            <div className="flex gap-3 mt-2">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="flex-1"
                size="lg"
              >
                ← Voltar
              </Button>
              <Button
                onClick={handleSubmit}
                loading={loading}
                className="flex-1"
                size="lg"
              >
                Criar conta 🚀
              </Button>
            </div>
          </div>
        )}

        <p className="text-center text-sm text-gray-600 mt-6">
          Já tem conta?{" "}
          <Link href="/login" className="text-purple-700 font-semibold">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
