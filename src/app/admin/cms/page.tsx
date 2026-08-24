"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, LayoutTemplate, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import CmsEditor from "@/components/admin/CmsEditor";

/**
 * /admin/cms · Módulo CMS
 * Admin altera dinamicamente os textos da Home (tabela site_content):
 * Hero, Como Funciona, Por que usar, Depoimentos e CTA.
 */
export default function AdminCmsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) router.push("/login");
      else if (user.role !== "admin") router.push("/dashboard");
    }
  }, [user, loading, router]);

  if (!user || user.role !== "admin") return null;

  return (
    <div className="min-h-screen bg-[#FAF9FB] pb-10">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900 to-purple-800 px-4 py-4 flex items-center gap-3">
        <Link
          href="/admin"
          className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="w-5 h-5 text-yellow-400" />
            <h1 className="font-black text-white text-lg">CMS · Conteúdo do Site</h1>
          </div>
          <p className="text-purple-200 text-xs flex items-center gap-1">
            <Shield className="w-3 h-3" /> Administrador: {user.nome}
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        <CmsEditor />
      </div>
    </div>
  );
}
