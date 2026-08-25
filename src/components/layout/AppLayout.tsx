"use client";

import { ReactNode } from "react";
import Header from "./Header";
import BottomNav from "./BottomNav";

type AppLayoutProps = {
  children: ReactNode;
  showHeader?: boolean;
  showNav?: boolean;
  className?: string;
  /** Desktop: usa largura útil grande (feeds com 3-4 cards por linha) */
  wide?: boolean;
};

export default function AppLayout({
  children,
  showHeader = true,
  showNav = true,
  className = "",
  wide = false,
}: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-[#FAF9FB]">
      {showHeader && <Header />}
      <main
        className={`${wide ? "max-w-7xl" : "max-w-lg"} mx-auto ${showHeader ? "pt-16" : ""} ${showNav ? "pb-24" : ""} ${className}`}
      >
        {children}
      </main>
      {showNav && <BottomNav />}
    </div>
  );
}
