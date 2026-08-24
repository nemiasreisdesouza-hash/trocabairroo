"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdCard from "@/components/ads/AdCard";
import {
  ArrowRight,
  MapPin,
  Star,
  CheckCircle2,
} from "lucide-react";
import * as backend from "@/lib/backend";
import type { AdCardData } from "@/lib/types";
import {
  DEFAULT_SITE_CONTENT,
  renderRichText,
} from "@/lib/site-content";
import { PLANOS_ASSINATURA } from "@/lib/constants";
import { useAuth } from "@/contexts/AuthContext";
import BottomNav from "@/components/layout/BottomNav";

type Stats = { users: number; ads: number; trades: number };

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();

  // BUG 2 · CARREGAMENTO INSTANTÂNEO: no modo demo o estado inicial
  // já nasce preenchido (síncrono, direto do localStorage validado).
  // Nenhum skeleton/bloco cinza no primeiro frame. No modo Supabase
  // o efeito abaixo carrega (com timeout de segurança no backend).
  const [content, setContent] = useState<Record<string, string>>(
    () => backend.getSiteContentSync() ?? DEFAULT_SITE_CONTENT
  );
  const [featuredAds, setFeaturedAds] = useState<AdCardData[] | null>(() => {
    try {
      return backend.listAdsSync({ limit: 6, ordenacao: "recentes" })?.ads ?? null;
    } catch {
      return null;
    }
  });
  const [stats, setStats] = useState<Stats>(
    () => backend.getPublicStatsSync() ?? { users: 0, ads: 0, trades: 0 }
  );

  useEffect(() => {
    // Conteúdo do CMS (site_content) + anúncios em destaque + estatísticas
    backend
      .getSiteContent()
      .then(setContent)
      .catch(() => {});

    backend
      .listAds({ limit: 6, ordenacao: "recentes" })
      .then((r) => setFeaturedAds(r.ads))
      .catch(() => setFeaturedAds([]));

    backend
      .getPublicStats()
      .then(setStats)
      .catch(() => {});
  }, []);

  const c = (key: string) => content[key] ?? DEFAULT_SITE_CONTENT[key] ?? "";
  const steps = [1, 2, 3].map((n) => ({
    num: String(n),
    emoji: c(`home.como_funciona.${n}.emoji`),
    title: c(`home.como_funciona.${n}.title`),
    desc: c(`home.como_funciona.${n}.desc`),
  }));
  const beneficios = [1, 2, 3, 4].map((n) => ({
    emoji: c(`home.porque.${n}.emoji`),
    text: c(`home.porque.${n}.text`),
  }));
  const depoimentos = [1, 2, 3].map((n) => ({
    name: c(`home.depoimentos.${n}.name`),
    bairro: c(`home.depoimentos.${n}.bairro`),
    text: c(`home.depoimentos.${n}.text`),
    stars: Math.max(1, Math.min(5, Number(c(`home.depoimentos.${n}.stars`)) || 5)),
  }));

  return (
    <div className="min-h-screen bg-[#FAF9FB]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-700 rounded-xl flex items-center justify-center">
              <span className="text-white text-sm font-black">TB</span>
            </div>
            <span className="font-black text-purple-700 text-lg tracking-tight">
              Troca<span className="text-yellow-500">Bairro</span>
            </span>
          </div>
          <div className="flex gap-2">
            {!authLoading && user ? (
              <Link
                href="/dashboard"
                className="text-sm font-semibold bg-purple-700 text-white rounded-2xl px-4 py-2 hover:bg-purple-800 transition-colors"
              >
                Meu Painel
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-semibold text-purple-700 px-3 py-2"
                >
                  Entrar
                </Link>
                <Link
                  href="/cadastro"
                  className="text-sm font-semibold bg-purple-700 text-white rounded-2xl px-4 py-2 hover:bg-purple-800 transition-colors"
                >
                  Cadastrar
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-900 via-purple-800 to-purple-700 pt-20">
        <div className="absolute inset-0 bg-black/20" />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `url('/images/hero-bg.jpg')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="relative max-w-lg mx-auto px-5 py-12 text-center">
          <div className="inline-flex items-center gap-2 bg-yellow-400/20 border border-yellow-400/40 rounded-full px-4 py-1.5 mb-6">
            <MapPin className="w-4 h-4 text-yellow-400" />
            <span className="text-yellow-300 text-sm font-semibold">
              {c("home.hero.badge")}
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-4">
            {c("home.hero.title")}
            <span className="text-yellow-400">
              {" "}
              {c("home.hero.title_highlight")}
            </span>
          </h1>
          <p className="text-purple-100 text-lg mb-8 leading-relaxed">
            {renderRichText(c("home.hero.subtitle")).map((part, i) =>
              part.bold ? (
                <span key={i} className="font-bold text-white">
                  {part.part}
                </span>
              ) : (
                <span key={i}>{part.part}</span>
              )
            )}
          </p>

          <div className="flex flex-col gap-3">
            <Link
              href="/cadastro"
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold text-lg py-4 rounded-2xl transition-all active:scale-95 shadow-lg"
            >
              {c("home.hero.cta_primary")}
            </Link>
            <Link
              href="/buscar"
              className="w-full bg-white/15 hover:bg-white/25 text-white font-semibold text-base py-3.5 rounded-2xl border border-white/30 transition-all"
            >
              {c("home.hero.cta_secondary")}
            </Link>
          </div>

          {/* Quick stats */}
          {(stats.users > 0 || stats.ads > 0) && (
            <div className="flex justify-center gap-8 mt-8">
              <div className="text-center">
                <p className="text-2xl font-black text-white">{stats.users}</p>
                <p className="text-purple-200 text-sm">Usuários</p>
              </div>
              <div className="w-px bg-white/20" />
              <div className="text-center">
                <p className="text-2xl font-black text-white">{stats.ads}</p>
                <p className="text-purple-200 text-sm">Anúncios</p>
              </div>
              <div className="w-px bg-white/20" />
              <div className="text-center">
                <p className="text-2xl font-black text-white">{stats.trades}</p>
                <p className="text-purple-200 text-sm">Trocas</p>
              </div>
            </div>
          )}
        </div>

        {/* Wave */}
        <div className="relative">
          <svg viewBox="0 0 1440 60" className="w-full" fill="#FAF9FB">
            <path d="M0,30 C360,60 1080,0 1440,30 L1440,60 L0,60 Z" />
          </svg>
        </div>
      </section>

      <main className="max-w-lg mx-auto px-4 pb-28">
        {/* How it works */}
        <section className="py-8">
          <h2 className="text-2xl font-black text-gray-900 text-center mb-6">
            {c("home.como_funciona.title")}
          </h2>
          <div className="flex flex-col gap-4">
            {steps.map(({ emoji, num, title, desc }) => (
              <div
                key={num}
                className="flex gap-4 items-start bg-white rounded-2xl p-4 shadow-sm"
              >
                <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl">
                  {emoji}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base mb-1">
                    {title}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Featured Ads */}
        {featuredAds === null ? (
          <section className="py-4">
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl overflow-hidden animate-pulse"
                >
                  <div className="aspect-[4/3] bg-gray-200" />
                  <div className="p-3 flex flex-col gap-2">
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                    <div className="h-4 bg-gray-200 rounded" />
                    <div className="h-3 bg-gray-200 rounded w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : featuredAds.length > 0 ? (
          <section className="py-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-gray-900">
                Anúncios em destaque ✨
              </h2>
              <Link
                href="/buscar"
                className="flex items-center gap-1 text-purple-700 font-semibold text-sm"
              >
                Ver todos
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {featuredAds.map((ad) => (
                <AdCard key={ad.id} ad={ad} />
              ))}
            </div>
          </section>
        ) : (
          <section className="py-8">
            <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
              <div className="text-5xl mb-4">🌱</div>
              <h3 className="font-bold text-gray-900 text-lg mb-2">
                Seja o primeiro do bairro!
              </h3>
              <p className="text-gray-600 mb-4">
                Nenhum anúncio ainda. Publique o primeiro e comece a trocar!
              </p>
              <Link
                href="/cadastro"
                className="inline-block bg-purple-700 text-white font-bold py-3 px-6 rounded-2xl"
              >
                Publicar grátis
              </Link>
            </div>
          </section>
        )}

        {/* Benefits */}
        <section className="py-6">
          <h2 className="text-xl font-black text-gray-900 text-center mb-4">
            {c("home.porque.title")}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {beneficios.map(({ emoji, text }, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-4 shadow-sm flex flex-col items-center gap-2 text-center"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl bg-purple-100">
                  {emoji}
                </div>
                <span className="text-sm font-semibold text-gray-800">
                  {text}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-4">
          <h2 className="text-xl font-black text-gray-900 text-center mb-4">
            {c("home.depoimentos.title")}
          </h2>
          <div className="flex flex-col gap-3">
            {depoimentos.map(
              ({ name, bairro, text, stars }, i) =>
                name && (
                  <div key={i} className="bg-white rounded-2xl p-4 shadow-sm">
                    <div className="flex gap-0.5 mb-2">
                      {Array.from({ length: stars }).map((_, j) => (
                        <Star
                          key={j}
                          className="w-4 h-4 fill-yellow-400 text-yellow-400"
                        />
                      ))}
                    </div>
                    <p className="text-gray-700 text-sm mb-3">&quot;{text}&quot;</p>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-purple-200 rounded-full flex items-center justify-center">
                        <span className="text-purple-800 text-sm font-bold">
                          {name[0]}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {name}
                        </p>
                        <p className="text-xs text-gray-500">{bairro}</p>
                      </div>
                    </div>
                  </div>
                )
            )}
          </div>
        </section>

        {/* Planos Freemium */}
        <section className="py-6">
          <h2 className="text-xl font-black text-gray-900 text-center mb-1">
            Planos para crescer no bairro 🚀
          </h2>
          <p className="text-center text-gray-500 text-sm mb-4">
            Comece grátis e impulsione quando quiser
          </p>
          <div className="flex flex-col gap-3">
            {PLANOS_ASSINATURA.map((plano) => (
              <Link
                key={plano.id}
                href="/planos"
                className={`bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 active:scale-98 transition-transform ${
                  plano.destaque ? "ring-2 ring-yellow-400" : ""
                }`}
              >
                <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">
                  {plano.badge}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-900">{plano.nome}</p>
                    {plano.destaque && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-400 text-gray-900">
                        MAIS POPULAR
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {plano.descricao}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  {plano.preco === 0 ? (
                    <p className="font-black text-green-600 text-sm">Grátis</p>
                  ) : (
                    <p className="font-black text-gray-900">
                      R${" "}
                      {plano.preco.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                      <span className="text-xs text-gray-400 font-medium">
                        /mês
                      </span>
                    </p>
                  )}
                </div>
              </Link>
            ))}
            <Link
              href="/impulsionar"
              className="flex items-center justify-center gap-2 py-3 border-2 border-dashed border-purple-300 rounded-2xl text-purple-700 font-semibold text-sm hover:bg-purple-50 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              Impulsionamentos a partir de R$ 3,00
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="py-6">
          <div className="bg-gradient-to-br from-purple-700 to-purple-900 rounded-3xl p-6 text-center text-white">
            <h2 className="text-2xl font-black mb-2">{c("home.cta.title")}</h2>
            <p className="text-purple-100 mb-5 text-sm">{c("home.cta.subtitle")}</p>
            <Link
              href="/cadastro"
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold text-base py-4 rounded-2xl transition-all inline-block active:scale-95"
            >
              Criar conta grátis
            </Link>
          </div>
        </section>
      </main>

      {/* Bottom Nav */}
      <BottomNav />
    </div>
  );
}
