"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import AdCard from "@/components/ads/AdCard";
import { CATEGORIAS, BAIRROS_VITORIA } from "@/lib/constants";
import * as backend from "@/lib/backend";
import type { AdCardData } from "@/lib/types";
import { DEMO_FEED_ADS } from "@/lib/demo-data";

export default function BuscarPage() {
  // ═══ HIDRATAÇÃO 100% LIMPA ═════════════════════════════════
  // useState inicializado DIRETAMENTE com os dados estáticos
  // (feed visível no primeiro render) + loading = false padrão.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const [ads, setAds] = useState<AdCardData[]>(DEMO_FEED_ADS);
  const [settled, setSettled] = useState(false);
  const [loading, setLoading] = useState(false); // NUNCA true por padrão
  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState("");
  const [bairro, setBairro] = useState("");
  const [tipo, setTipo] = useState("");
  const [ordenacao, setOrdenacao] = useState("recentes");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(DEMO_FEED_ADS.length);

  const fetchAds = useCallback(
    async (pageToFetch: number, reset: boolean) => {
      setLoading(true);
      try {
        const result = await backend.listAds({
          search,
          categoria,
          bairro,
          tipo,
          ordenacao: ordenacao as "recentes" | "destaque" | "topo" | "populares",
          page: pageToFetch,
          limit: 12,
        });

        if (reset) {
          setAds(result.ads);
          setPage(1);
        } else {
          setAds((prev) => [...(prev ?? []), ...result.ads]);
        }
        setTotal(result.total);
        setHasMore(result.page < result.pages);
      } catch {
        if (reset) setAds([]);
      } finally {
        // OBRIGATÓRIO em qualquer cenário — loading nunca fica preso
        setLoading(false);
        setSettled(true);
      }
    },
    [search, categoria, bairro, tipo, ordenacao]
  );

  useEffect(() => {
    if (!mounted) return;
    const t = setTimeout(() => fetchAds(1, true), search ? 350 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, search, categoria, bairro, tipo, ordenacao]);

  const activeFilters = [categoria, bairro, tipo].filter(Boolean).length;

  return (
    <AppLayout>
      <div className="px-4 py-4">
        {/* Search bar */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="search"
              placeholder="Buscar serviços ou produtos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border-2 border-gray-200 rounded-2xl pl-11 pr-4 py-3 text-base text-gray-900 focus:outline-none focus:border-purple-600 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`relative w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
              showFilters || activeFilters > 0
                ? "bg-purple-700 text-white"
                : "bg-white border-2 border-gray-200 text-gray-600"
            }`}
          >
            <SlidersHorizontal className="w-5 h-5" />
            {activeFilters > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 text-gray-900 text-xs rounded-full flex items-center justify-center font-bold">
                {activeFilters}
              </span>
            )}
          </button>
        </div>

        {/* Quick tipo filter */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
          {["", "ofereço", "preciso"].map((t) => (
            <button
              key={t}
              onClick={() => setTipo(t)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                tipo === t
                  ? "bg-purple-700 text-white"
                  : "bg-white border-2 border-gray-200 text-gray-700"
              }`}
            >
              {t === "" ? "Todos" : t === "ofereço" ? "OFEREÇO" : "PRECISO"}
            </button>
          ))}
          <div className="w-px bg-gray-200 flex-shrink-0" />
          {["recentes", "destaque", "populares"].map((o) => (
            <button
              key={o}
              onClick={() => setOrdenacao(o)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all capitalize ${
                ordenacao === o
                  ? "bg-gray-800 text-white"
                  : "bg-white border-2 border-gray-200 text-gray-700"
              }`}
            >
              {o === "recentes" ? "Recentes" : o === "destaque" ? "Destaque" : "Populares"}
            </button>
          ))}
        </div>

        {/* Expandable filters */}
        {showFilters && (
          <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900">Filtros</h3>
              {activeFilters > 0 && (
                <button
                  onClick={() => {
                    setCategoria("");
                    setBairro("");
                    setTipo("");
                  }}
                  className="text-sm text-red-500 font-semibold"
                >
                  Limpar tudo
                </button>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">
                  Categoria
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIAS.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategoria(categoria === cat ? "" : cat)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        categoria === cat
                          ? "bg-purple-700 text-white"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">
                  Bairro
                </label>
                <select
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-600"
                >
                  <option value="">Todos os bairros</option>
                  {BAIRROS_VITORIA.filter((b) => b !== "Outros").map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Results count */}
        {!loading && (
          <p className="text-sm text-gray-500 mb-3">
            {total} anúncio{total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""}
          </p>
        )}

        {/* Ads grid — render imediato com dados estáticos */}
        {ads.length === 0 && settled ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="font-bold text-gray-900 text-lg mb-2">
              Nenhum anúncio encontrado
            </h3>
            <p className="text-gray-500 text-sm">
              Tente outros termos ou remova os filtros
            </p>
          </div>
        ) : (
          <>
            <div className={`grid grid-cols-2 gap-3 transition-opacity ${loading ? "opacity-60" : ""}`}>
              {ads.map((ad) => (
                <AdCard key={ad.id} ad={ad} />
              ))}
            </div>

            {hasMore && (
              <button
                onClick={() => {
                  const next = page + 1;
                  setPage(next);
                  fetchAds(next, false);
                }}
                className="w-full mt-4 py-3 border-2 border-gray-200 rounded-2xl text-gray-700 font-semibold hover:border-purple-600 hover:text-purple-700 transition-colors"
              >
                {loading ? "Carregando..." : "Ver mais anúncios"}
              </button>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
