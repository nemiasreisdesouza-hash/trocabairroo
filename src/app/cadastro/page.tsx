"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import {
  User,
  Mail,
  Lock,
  Phone,
  BadgeCheck,
  MapPin,
  Eye,
  EyeOff,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  CATEGORIAS,
  UFS,
  UF_PADRAO,
  CIDADE_PADRAO,
  CIDADES_ES,
  BAIRROS_POR_CIDADE,
} from "@/lib/constants";
import { maskPhone, maskCPF, isValidCPF, isValidPhone } from "@/lib/validators";
import { TermosTexto } from "@/components/legal/TermosConteudo";

export default function CadastroPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showTermos, setShowTermos] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    senha: "",
    confirmarSenha: "",
    whatsapp: "",
    cpf: "",
    uf: UF_PADRAO,
    cidade: CIDADE_PADRAO,
    bairro: "",
    tipoPerfil: "empreendedor" as "empreendedor" | "criador" | "ambos",
    categorias: [] as string[],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── Modal de Termos: botão de submit travado até 100% do scroll ──
  const [scrollProgress, setScrollProgress] = useState(0);
  const termosRef = useRef<HTMLDivElement>(null);

  // Ao abrir o modal, reseta o progresso de leitura
  const abrirTermos = () => {
    setScrollProgress(0);
    setShowTermos(true);
  };

  const handleTermosScroll = () => {
    const el = termosRef.current;
    if (!el) return;
    const scrollable = el.scrollHeight - el.clientHeight;
    if (scrollable <= 4) {
      setScrollProgress(100);
      return;
    }
    const progress = (el.scrollTop + el.clientHeight) / el.scrollHeight;
    setScrollProgress(Math.min(100, Math.round(progress * 100)));
  };

  // Zera o scroll do conteúdo sempre que o modal é montado
  useEffect(() => {
    if (showTermos && termosRef.current) {
      termosRef.current.scrollTop = 0;
      // Conteúdo que caiba sem rolar → já conta como 100% lido
      setScrollProgress(
        termosRef.current.scrollHeight - termosRef.current.clientHeight <= 4 ? 100 : 0
      );
    }
  }, [showTermos]);

  // BUG 3 · botão "Criar conta grátis" LIBERADO apenas com 100% lido
  const termosLidos = scrollProgress >= 98;

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
    setErrors((prev) => ({ ...prev, categorias: "" }));
  };

  const isES = formData.uf === "ES";
  const cidades = isES ? CIDADES_ES : [];
  const bairros =
    isES && BAIRROS_POR_CIDADE[formData.cidade]
      ? BAIRROS_POR_CIDADE[formData.cidade]
      : null;

  // ── Validações por etapa ──────────────────────────────
  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    const nomeParts = formData.nome.trim().split(/\s+/);
    if (formData.nome.trim().length < 3 || nomeParts.length < 2)
      newErrors.nome = "Informe seu nome completo (nome e sobrenome)";
    if (!formData.email || !/^\S+@\S+\.\S+$/.test(formData.email))
      newErrors.email = "Email inválido";
    if (!formData.senha || formData.senha.length < 6)
      newErrors.senha = "Senha deve ter pelo menos 6 caracteres";
    if (formData.senha !== formData.confirmarSenha)
      newErrors.confirmarSenha = "Senhas não conferem";
    if (!formData.whatsapp || !isValidPhone(formData.whatsapp))
      newErrors.whatsapp = "WhatsApp inválido — use (00) 00000-0000";
    if (!formData.cpf || !isValidCPF(formData.cpf))
      newErrors.cpf = "CPF inválido (falha na validação dos dígitos)";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.uf) newErrors.uf = "Selecione o estado (UF)";
    if (!formData.cidade) newErrors.cidade = "Informe a cidade";
    if (!formData.bairro) newErrors.bairro = "Selecione ou informe o bairro";
    if (formData.categorias.length === 0)
      newErrors.categorias = "Escolha pelo menos 1 categoria de atuação";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!termosLidos) return;

    setLoading(true);
    try {
      const result = await register({
        nome: formData.nome,
        email: formData.email,
        senha: formData.senha,
        whatsapp: formData.whatsapp,
        cpf: formData.cpf,
        uf: formData.uf,
        cidade: formData.cidade,
        bairro: formData.bairro,
        tipoPerfil: formData.tipoPerfil,
        categorias: formData.categorias,
      });

      if (result.needsEmailConfirmation) {
        toast.success("Conta criada! Confirme seu email para entrar. 📧");
        router.push("/login");
        return;
      }

      toast.success("Conta criada com sucesso! 🎉");
      // Navegação SPA (router.push) — sem recarregar o iframe; o
      // usuário já está logado na memória do AuthContext.
      router.push(`/perfil/${result.user!.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao criar conta";
      toast.error(message);
      setShowTermos(false);
      setStep(1);
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
          {step === 1
            ? "Criar conta grátis 🚀"
            : step === 2
            ? "Onde você atua? 📍"
            : "Quase lá! 🎉"}
        </h1>
        <p className="text-purple-200 text-sm">
          {step === 1
            ? "Leva só 2 minutos"
            : step === 2
            ? "Defina sua localização e atuação"
            : "Leia os termos até o fim para continuar"}
        </p>
        {/* Progress */}
        <div className="flex gap-2 mt-4">
          <div className={`h-1.5 flex-1 bg-yellow-400 rounded-full`} />
          <div
            className={`h-1.5 flex-1 rounded-full ${
              step >= 2 ? "bg-yellow-400" : "bg-white/30"
            }`}
          />
          <div
            className={`h-1.5 flex-1 rounded-full ${
              step >= 3 ? "bg-yellow-400" : "bg-white/30"
            }`}
          />
        </div>
      </div>

      <div className="flex-1 px-5 py-6 max-w-md mx-auto w-full">
        {/* ─────────── ETAPA 1 · Dados ─────────── */}
        {step === 1 && (
          <div className="flex flex-col gap-4">
            <Input
              label="Nome completo"
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
              label="Telefone / WhatsApp"
              type="tel"
              placeholder="(27) 99999-9999"
              value={formData.whatsapp}
              onChange={(e) => update("whatsapp", maskPhone(e.target.value))}
              icon={<Phone className="w-5 h-5" />}
              error={errors.whatsapp}
              hint="Com DDD. Usado para combinar as trocas"
              inputMode="numeric"
            />
            <Input
              label="CPF"
              type="tel"
              placeholder="000.000.000-00"
              value={formData.cpf}
              onChange={(e) => update("cpf", maskCPF(e.target.value))}
              icon={<BadgeCheck className="w-5 h-5" />}
              error={errors.cpf}
              hint="Validado matematicamente e mantido privado (LGPD)"
              inputMode="numeric"
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
                  className={`w-full border-2 rounded-2xl pl-10 pr-12 py-3 text-base focus:outline-none focus:border-purple-600 transition-colors ${
                    errors.senha ? "border-red-400 bg-red-50" : "border-gray-200 bg-white"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.senha && (
                <p className="text-xs text-red-600 font-medium">{errors.senha}</p>
              )}
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
            <Button onClick={() => validateStep1() && setStep(2)} fullWidth size="lg" className="mt-2">
              Continuar →
            </Button>
          </div>
        )}

        {/* ─────────── ETAPA 2 · Local + Atuação ─────────── */}
        {step === 2 && (
          <div className="flex flex-col gap-4">
            <Select
              label="Estado (UF)"
              value={formData.uf}
              onChange={(e) => {
                const uf = e.target.value;
                setFormData((prev) => ({
                  ...prev,
                  uf,
                  cidade: uf === "ES" ? CIDADE_PADRAO : "",
                  bairro: "",
                }));
                setErrors((prev) => ({ ...prev, uf: "", cidade: "", bairro: "" }));
              }}
              options={UFS.map((uf) => ({ value: uf, label: uf }))}
              error={errors.uf}
              hint="Padrão: Espírito Santo 🌱"
            />

            {isES ? (
              <Select
                label="Cidade"
                value={formData.cidade}
                onChange={(e) => {
                  update("cidade", e.target.value);
                  setFormData((prev) => ({ ...prev, bairro: "" }));
                }}
                options={CIDADES_ES.map((c) => ({ value: c, label: c }))}
                placeholder="Selecione a cidade"
                error={errors.cidade}
              />
            ) : (
              <Input
                label="Cidade"
                placeholder="Sua cidade"
                value={formData.cidade}
                onChange={(e) => update("cidade", e.target.value)}
                icon={<MapPin className="w-5 h-5" />}
                error={errors.cidade}
              />
            )}

            {bairros ? (
              <Select
                label="Bairro"
                value={formData.bairro}
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
                icon={<MapPin className="w-5 h-5" />}
                error={errors.bairro}
              />
            )}

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
                Categoria de atuação{" "}
                <span className="text-gray-400 font-normal">(obrigatório)</span>
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
              {errors.categorias && (
                <p className="text-xs text-red-600 font-medium">{errors.categorias}</p>
              )}
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
                onClick={() => validateStep2() && abrirTermos()}
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

      {/* ─────────── MODAL · Termos de Uso ─────────── */}
      {showTermos && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh]">
            {/* Cabeçalho */}
            <div className="p-5 border-b border-gray-100 flex items-start gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-5 h-5 text-purple-700" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-gray-900 leading-tight">
                  Termos de Uso e Isenção de Responsabilidade
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Role até o fim para liberar o botão
                </p>
              </div>
              <button
                onClick={() => setShowTermos(false)}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            {/* Barra de progresso de leitura */}
            <div className="h-1.5 bg-gray-100">
              <div
                className={`h-full transition-all duration-150 ${
                  termosLidos ? "bg-green-500" : "bg-purple-600"
                }`}
                style={{ width: `${scrollProgress}%` }}
              />
            </div>

            {/* Conteúdo com scroll */}
            <div
              ref={termosRef}
              onScroll={handleTermosScroll}
              className="flex-1 overflow-y-auto px-5 py-4"
            >
              <TermosTexto />
              <div className="h-4" />
            </div>

            {/* Rodapé travado até 100% da leitura */}
            <div className="p-5 border-t border-gray-100 bg-white rounded-b-3xl">
              <p
                className={`text-xs leading-relaxed mb-3 ${
                  termosLidos ? "text-gray-600" : "text-gray-400"
                }`}
              >
                Ao criar a conta, você declara que <strong>leu todos os
                termos</strong> até o fim, incluindo as cláusulas de{" "}
                <strong>isenção total de responsabilidade</strong> civil, penal,
                criminal e trabalhista.
              </p>

              {!termosLidos ? (
                <div className="w-full py-4 rounded-2xl bg-gray-100 text-gray-400 font-bold text-center flex items-center justify-center gap-2 cursor-not-allowed">
                  <ChevronDown className="w-4 h-4 animate-bounce" />
                  Leitura: {scrollProgress}% — role até o fim para desbloquear
                </div>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-95 bg-yellow-400 hover:bg-yellow-500 text-gray-900 shadow-lg disabled:opacity-70"
                >
                  {loading ? "Criando conta..." : "Criar conta grátis 🚀"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
