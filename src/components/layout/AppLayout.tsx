"use client";

import { ReactNode } from "react";
import Header from "./Header";
import BottomNav from "./BottomNav";

type AppLayoutProps = {
  children: ReactNode;
  showHeader?: boolean;
  showNav?: boolean;
  className?: string;
};

export default function AppLayout({
  children,
  showHeader = true,
  showNav = true,
  className = "",
}: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-[#FAF9FB]">
      {showHeader && <Header />}
      <main
        className={`max-w-lg mx-auto ${showHeader ? "pt-16" : ""} ${showNav ? "pb-24" : ""} ${className}`}
      >
        {children}
      </main>
      {showNav && <BottomNav />}
    </div>
  );
}
