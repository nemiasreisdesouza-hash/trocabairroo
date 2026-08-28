"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, PlusCircle, Handshake, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { href: "/", label: "Início", icon: Home },
  { href: "/buscar", label: "Buscar", icon: Search },
  { href: "/anuncio/criar", label: "Publicar", icon: PlusCircle, highlight: true },
  { href: "/trocas", label: "Trocas", icon: Handshake },
  { href: "/perfil", label: "Perfil", icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-lg safe-area-pb md:hidden">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {navItems.map(({ href, label, icon: Icon, highlight }) => {
          const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
          const finalHref = href === "/perfil" && user ? `/perfil/${user.id}` : href;
          
          if (highlight) {
            return (
              <Link
                key={href}
                href={user ? href : "/login"}
                className="flex flex-col items-center py-2 px-3 -mt-4"
              >
                <div className="w-14 h-14 bg-purple-700 rounded-full flex items-center justify-center shadow-lg shadow-purple-300">
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <span className="text-xs font-semibold text-purple-700 mt-1">
                  {label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={href}
              href={href === "/perfil" ? (user ? `/perfil/${user.id}` : "/login") : href}
              className={`flex flex-col items-center py-3 px-3 min-w-[56px] transition-colors ${
                isActive ? "text-purple-700" : "text-gray-500"
              }`}
            >
              <Icon className={`w-6 h-6 ${isActive ? "text-purple-700" : "text-gray-400"}`} />
              <span className={`text-xs font-medium mt-0.5 ${isActive ? "text-purple-700" : "text-gray-500"}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
