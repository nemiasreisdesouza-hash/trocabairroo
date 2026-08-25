"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, User, Settings, Megaphone, Shield, LogOut } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { useAuth } from "@/contexts/AuthContext";

/**
 * 👤 USER MENU VIP FLUTUANTE (padrão Airbnb)
 * Trigger: Avatar + primeiro nome + chevron rotativo.
 * Dropdown: card premium z-50 com overlay de fechamento por clique fora.
 * Rotas: /perfil/[id] = Perfil Público · /dashboard = Conta & Config.
 */
export default function UserHeaderMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Escape fecha o menu
  useEffect(() => {
    if (!isDropdownOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsDropdownOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isDropdownOpen]);

  if (!user) return null;

  const primeiroNome = user.nome.split(" ")[0];

  const atalhos = [
    {
      href: `/perfil/${user.id}`,
      icone: <User className="w-4 h-4 text-purple-600" />,
      titulo: "Ver Perfil Público",
    },
    {
      href: "/dashboard",
      icone: <Settings className="w-4 h-4 text-purple-600" />,
      titulo: "Gerenciar Conta",
    },
    {
      href: "/dashboard#anuncios",
      icone: <Megaphone className="w-4 h-4 text-purple-600" />,
      titulo: "Meus Anúncios",
    },
    ...(user.role === "admin"
      ? [
          {
            href: "/admin",
            icone: <Shield className="w-4 h-4 text-red-500" />,
            titulo: "Painel Administrativo",
          },
        ]
      : []),
  ];

  return (
    <div className="relative" ref={ref}>
      {/* ── Botão gatilho: Avatar + nome + chevron ── */}
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center gap-2 p-1 sm:px-3 sm:py-1.5 rounded-full hover:bg-purple-50 transition-all cursor-pointer border border-transparent hover:border-purple-100"
        aria-haspopup="menu"
        aria-expanded={isDropdownOpen}
      >
        <Avatar
          src={user.avatarUrl}
          name={user.nome}
          size="sm"
          className="w-9 h-9 !rounded-full border-2 border-purple-300 shadow-sm"
        />
        <span className="hidden sm:inline-block font-bold text-sm text-gray-800 max-w-[110px] truncate">
          {primeiroNome}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-purple-600 transition-transform duration-200 ${
            isDropdownOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Overlay invisível: clicar fora fecha instantaneamente */}
      {isDropdownOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsDropdownOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Card flutuante VIP ── */}
      {isDropdownOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-purple-100 p-2 z-50 text-gray-800 menu-pop"
        >
          {/* Cabeçalho: resumo do usuário */}
          <div className="bg-purple-50/80 p-3 rounded-xl mb-1 border border-purple-100/50 flex items-center gap-3">
            <Avatar src={user.avatarUrl} name={user.nome} size="sm" className="flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm text-purple-950 truncate">{user.nome}</p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] font-bold text-gray-600 bg-white/80 border border-purple-100 rounded-full px-2 py-0.5">
                  ⭐ {(user.mediaAvaliacao || 0).toFixed(1)}
                </span>
                {user.verificado && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                    ✅ Verificado
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Atalhos */}
          {atalhos.map((op) => (
            <Link
              key={op.titulo}
              href={op.href}
              onClick={() => setIsDropdownOpen(false)}
              className="flex items-center gap-2.5 p-2 rounded-lg font-semibold text-xs text-gray-700 hover:bg-purple-50 transition-colors"
            >
              {op.icone}
              {op.titulo}
            </Link>
          ))}

          {/* Divisória sutil */}
          <div className="border-t border-gray-100 my-1" />

          {/* Sair */}
          <button
            onClick={async () => {
              setIsDropdownOpen(false);
              await logout();
              router.push("/");
            }}
            className="w-full text-red-600 hover:bg-red-50 rounded-lg p-2 font-semibold text-xs flex items-center gap-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair da Conta
          </button>
        </div>
      )}
    </div>
  );
}
