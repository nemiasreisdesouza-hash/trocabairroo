"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Mail, Lock, Eye, EyeOff, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import DemoResetFooter from "@/components/DemoResetFooter";
import Logo from "@/components/Logo";
import { getDemoUserByEmail } from "@/lib/demo-data";
import { setDemoSessionId } from "@/lib/demo-store";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, applyUserUpdate, demoMode } = useAuth();
  const router = useRouter();
  // Sem redirect automático: a navegação é explícita via router.push
  // (SPA pura — o iframe do preview NUNCA recarrega).

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !senha) {
      toast.error("Preencha todos os campos");
      return;
    }

    setLoading(true);
    try {
      await login(email, senha);
      toast.success("Bem-vindo de volta! 👋");
      router.push("/dashboard");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao fazer login";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts = demoMode ? backendDemoAccounts() : [];

  /**
   * 🚀 LOGIN DEMO (Admin, Michelle, Carlos) · NAVEGAÇÃO SPA:
   * 1) Salva a sessão na engine segura (memória RAM + cookie +
   *    localStorage — nunca lança, mesmo com storage bloqueado);
   * 2) Atualiza o AuthContext NA HORA (applyUserUpdate) — o
   *    Header/Menu já exibem o avatar durante a navegação;
   * 3) router.push troca de página SEM recarregar o iframe,
   *    preservando a sessão em memória.
   */
  const handleDemoLogin = (email: string, senha: string) => {
    setEmail(email);
    setSenha(senha);
    try {
      const user = getDemoUserByEmail(email);
      if (!user) throw new Error("Conta demo não encontrada");

      // 1) Sessão (id — lida por todo o app)
      setDemoSessionId(user.id);
      // Espelho legível: trocabairro_session (JSON) — best effort
      try {
        localStorage.setItem("trocabairro_session", JSON.stringify(user));
      } catch {
        /* storage bloqueado — sessão já está em memória/cookie */
      }

      // 2) Usuário logado direto no estado do React (RAM)
      applyUserUpdate(user);

      toast.success(`Entrando como ${user.nome.split(" ")[0]}... 🎉`);
      // 3) Navegação SPA: admin → painel, demais → perfil
      router.push(user.role === "admin" ? "/admin" : `/perfil/${user.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro no login demo";
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9FB] flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-b from-purple-800 to-purple-700 px-5 pt-12 pb-8 text-center">
        <Link href="/" className="inline-block mb-6">
          <Logo size="lg" onDark />
        </Link>
        <h1 className="text-2xl font-black text-white mb-1">Bem-vindo de volta! 👋</h1>
        <p className="text-purple-200 text-sm">Entre na sua conta para continuar</p>
      </div>

      {/* Form */}
      <div className="flex-1 px-5 py-8 max-w-md mx-auto w-full">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={<Mail className="w-5 h-5" />}
            autoComplete="email"
            required
          />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-gray-700">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Sua senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-2xl pl-10 pr-12 py-3 text-gray-900 text-base focus:outline-none focus:border-purple-600 transition-colors"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            loading={loading}
            fullWidth
            size="lg"
            className="mt-2"
          >
            Entrar
          </Button>
        </form>

        {demoMode && (
          <div className="mt-4 bg-purple-50 border border-purple-200 rounded-2xl p-4">
            <p className="text-sm font-bold text-purple-800 flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4" />
              Modo Demo ativo (localStorage)
            </p>
            <p className="text-xs text-purple-600 mb-3">
              Configure as chaves do Supabase no <code>.env.local</code> para
              ativar o backend real. Contas para teste:
            </p>
            <div className="flex flex-col gap-1.5">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => handleDemoLogin(acc.email, acc.senha)}
                  className="w-full flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-purple-100 hover:border-purple-400 active:scale-98 transition-all text-left disabled:opacity-60"
                >
                  <span className="text-xs font-semibold text-gray-800">
                    {loading ? "⏳ Entrando..." : `${acc.label} → entrar`}
                  </span>
                  <span className="text-xs text-gray-500 font-mono">
                    {acc.email} · {acc.senha}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-3">
              <DemoResetFooter />
            </div>
          </div>
        )}

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-[#FAF9FB] px-4 text-sm text-gray-500">
              Ainda não tem conta?
            </span>
          </div>
        </div>

        <Link
          href="/cadastro"
          className="w-full flex items-center justify-center py-4 border-2 border-purple-700 text-purple-700 font-bold rounded-2xl hover:bg-purple-50 transition-colors"
        >
          Criar conta grátis 🚀
        </Link>

        <p className="text-center text-xs text-gray-500 mt-6">
          Ao entrar, você aceita nossos{" "}
          <Link href="/termos" className="text-purple-700">
            Termos de Uso
          </Link>
        </p>
      </div>
    </div>
  );
}

function backendDemoAccounts() {
  // Import dinâmico para não poluir; as contas vêm do seed do modo demo
  return [
    { label: "👑 Admin (Painel ADM + CMS)", email: "admin@trocabairro.com", senha: "admin123" },
    { label: "🏪 Michelle (tem trocas)", email: "michelle@demo.com", senha: "123456" },
    { label: "🎸 Carlos", email: "carlos@demo.com", senha: "123456" },
  ];
}
