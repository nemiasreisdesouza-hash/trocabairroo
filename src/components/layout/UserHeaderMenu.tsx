"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  User,
  Settings,
  Megaphone,
  Shield,
  LogOut,
} from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { useAuth } from "@/contexts/AuthContext";

/**
 * 👤 USER HEADER MENU — Avatar Badge com dropdown de ações rápidas
 * (padrão Airbnb/Mercado Livre).
 * Rotas: /perfil/[id] = Perfil Público · /dashboard = Conta & Config.
 */
export default function UserHeaderMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!user) return null;

  const primeiroNome = user.nome.split(" ")[0];

  const opcoes = [
    {
      href: `/perfil/${user.id}`,
      icone: <User className="w-4 h-4 text-purple-600" />,
      titulo: "Ver Meu Perfil Público",
      sub: "Como os vizinhos veem fotos e avaliações",
    },
    {
      href: "/dashboard",
      icone: <Settings className="w-4 h-4 text-purple-600" />,
      titulo: "Minha Conta & Configurações",
      sub: "Editar perfil, fotos, WhatsApp e bairro",
    },
    {
      href: "/dashboard",
      icone: <Megaphone className="w-4 h-4 text-purple-600" />,
      titulo: "Meus Anúncios & Impulsionar",
      sub: "Gerenciar publicações",
    },
    ...(user.role === "admin"
      ? [
          {
            href: "/admin",
            icone: <Shield className="w-4 h-4 text-red-500" />,
            titulo: "Painel Administrativo",
            sub: "Usuários, trocas, CMS e relatórios",
          },
        ]
      : []),
  ];

  return (
    <div className="relative" ref={ref}>
      {/* Avatar Badge */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 p-1 sm:px-3 sm:py-1.5 rounded-full hover:bg-purple-50 transition-all cursor-pointer border border-transparent hover:border-purple-100"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar
          src={user.avatarUrl}
          name={user.nome}
          size="sm"
          className="w-9 h-9 !rounded-full border-2 border-purple-200 shadow-sm"
        />
        <span className="hidden sm:inline-block font-bold text-gray-800 text-sm max-w-[110px] truncate">
          {primeiroNome}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-purple-600 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-lg border border-purple-100 overflow-hidden z-50 animate-in"
        >
          {/* Cabeçalho do menu */}
          <div className="px-4 py-3 bg-purple-50/70 border-b border-purple-100">
            <p className="text-sm font-bold text-gray-900 truncate">
              {user.nome}
            </p>
            <p className="text-[11px] text-gray-500 truncate">{user.email}</p>
          </div>

          {opcoes.map((op) => (
            <Link
              key={op.titulo}
              href={op.href}
              onClick={() => setOpen(false)}
              className="flex items-start gap-3 px-4 py-3 hover:bg-purple-50 transition-colors border-b border-gray-50 last:border-0"
            >
              <span className="mt-0.5">{op.icone}</span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-gray-800">
                  {op.titulo}
                </span>
                <span className="block text-[11px] text-gray-400 leading-snug">
                  {op.sub}
                </span>
              </span>
            </Link>
          ))}

          {/* Sair (linha vermelha) */}
          <button
            onClick={async () => {
              setOpen(false);
              await logout();
              router.push("/");
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-600 font-semibold text-sm hover:bg-red-50 transition-colors border-t border-gray-100"
          >
            <LogOut className="w-4 h-4" />
            Sair da Conta
          </button>
        </div>
      )}
    </div>
  );
}
