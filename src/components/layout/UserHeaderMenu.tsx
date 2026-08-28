"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, User, Settings, Megaphone, Shield, LogOut } from "lucide-react";
import VerifiedBadge from "@/components/ui/VerifiedBadge";
import Avatar from "@/components/ui/Avatar";
import { useAuth } from "@/contexts/AuthContext";

/**
 * 👤 USER MENU FLUTUANTE — fixo via PORTAL (anti-clipping definitivo)
 *
 * O Header tem overflow-hidden + backdrop-blur (que cria containing
 * block e clippa descendentes). Por isso o dropdown é renderizado em
 * um portal no <body>, com posicionamento fixed top-16 z-[999] —
 * flutua sobre o Header, a Hero roxa e qualquer componente, sem nunca
 * ser cortado. Backdrop z-[998] fecha ao clicar fora.
 */
export default function UserHeaderMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Esc fecha o menu
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen]);

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
      titulo: "Gerenciar Conta & Configurações",
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
            titulo: "Painel Admin",
          },
        ]
      : []),
  ];

  return (
    <div ref={ref}>
      {/* ── Gatilho: avatar + nome + chevron (dentro do header) ── */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="cursor-pointer relative z-50 flex items-center gap-1.5 p-1 sm:px-3 sm:py-1.5 rounded-full hover:bg-purple-50 transition-all border border-transparent hover:border-purple-100"
        aria-haspopup="menu"
        aria-expanded={isOpen}
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
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* ── Dropdown via PORTAL no body — fixo, jamais clippado ── */}
      {mounted &&
        isOpen &&
        createPortal(
          <>
            {/* Backdrop: clicar fora fecha */}
            <div
              className="fixed inset-0 z-[998] bg-black/10 backdrop-blur-[1px]"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />
            {/* Menu flutuante */}
            <div
              role="menu"
              className="fixed top-16 right-2 sm:right-6 z-[999] w-72 bg-white rounded-2xl shadow-2xl border border-purple-100 p-3 text-gray-800 menu-pop"
            >
              {/* Resumo do usuário */}
              <div className="bg-purple-50/80 p-3 rounded-xl mb-1 border border-purple-100/50 flex items-center gap-3">
                <Avatar
                  src={user.avatarUrl}
                  name={user.nome}
                  size="sm"
                  className="flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-purple-950 truncate">
                    {user.nome}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="text-[10px] font-bold text-gray-600 bg-white/80 border border-purple-100 rounded-full px-2 py-0.5">
                      ⭐ {(user.mediaAvaliacao || 0).toFixed(1)}
                    </span>
                    {((user as any).isPartner || user.verificado) && (
                      <span className={`text-[10px] font-bold border rounded-full px-2 py-0.5 flex items-center gap-1 ${ (user as any).isPartner ? "text-yellow-700 bg-yellow-50 border-yellow-200" : "text-emerald-700 bg-emerald-50 border-emerald-200" }`}>
                        <VerifiedBadge isVerified={user.verificado} isPartner={(user as any).isPartner} size="xs" />
                        {(user as any).isPartner ? "Parceiro" : "Verificado"}
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
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 p-2 rounded-lg font-semibold text-xs text-gray-700 hover:bg-purple-50 transition-colors"
                >
                  {op.icone}
                  {op.titulo}
                </Link>
              ))}

              <div className="border-t border-gray-100 my-1" />

              {/* Sair */}
              <button
                onClick={async () => {
                  setIsOpen(false);
                  await logout();
                  router.push("/");
                }}
                className="w-full text-red-600 hover:bg-red-50 rounded-lg p-2 font-semibold text-xs flex items-center gap-2 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sair da Conta
              </button>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
