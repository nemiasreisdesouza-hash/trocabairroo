"use client";

import Link from "next/link";
import Logo from "@/components/Logo";
import HeaderActions from "@/components/HeaderActions";

export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-100 shadow-sm">
      <div className="w-full max-w-7xl mx-auto px-2.5 sm:px-6 flex items-center justify-between h-16 overflow-hidden">
        <Link href="/" aria-label="TrocaES — início">
          <Logo size="sm" />
        </Link>

        <div className="flex-shrink-0 flex items-center">
          <HeaderActions />
        </div>
      </div>
    </header>
  );
}
