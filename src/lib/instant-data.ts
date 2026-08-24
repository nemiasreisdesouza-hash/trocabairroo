// ═══════════════════════════════════════════════════════════
// DADOS INSTANTÂNEOS · HIDRATION-SAFE
//
// Resolve os dois lados do problema do preview:
//  1. NUNCA fica em loading infinito: no modo demo os cards
//     vêm do SEED ESTÁTICO (síncrono, sem localStorage).
//  2. NÃO quebra a hidratação: consumido via
//     useSyncExternalStore(subscribeNoop, snapshot, serverSnapshot)
//     → o servidor/render de hidratação usa o serverSnapshot
//     (null/padrão, idêntico ao HTML) e o React aplica o
//     snapshot do cliente LOGO APÓS o mount SEM mismatch.
// ═══════════════════════════════════════════════════════════
import {
  listAdsSync,
  getSiteContentSync,
  getPublicStatsSync,
} from "./backend";
import { DEFAULT_SITE_CONTENT } from "./site-content";
import type { AdCardData } from "./types";

export type PublicStats = { users: number; ads: number; trades: number };

/** Subscribe imutável (dados estáticos por sessão; refresh via estado) */
export const subscribeNoop = () => () => {};

// ── Snapshots cacheados (referência estável entre chamadas) ──
let _homeAds: AdCardData[] | null | undefined;
export function homeAdsSnapshot(): AdCardData[] | null {
  if (_homeAds === undefined) {
    try {
      _homeAds =
        listAdsSync({ limit: 6, ordenacao: "recentes" })?.ads ?? null;
    } catch {
      _homeAds = null;
    }
  }
  return _homeAds;
}

let _feedAds: AdCardData[] | null | undefined;
export function feedAdsSnapshot(): AdCardData[] | null {
  if (_feedAds === undefined) {
    try {
      _feedAds =
        listAdsSync({ limit: 12, ordenacao: "recentes" })?.ads ?? null;
    } catch {
      _feedAds = null;
    }
  }
  return _feedAds;
}

let _content: Record<string, string> | undefined;
export function siteContentSnapshot(): Record<string, string> {
  if (_content === undefined) {
    try {
      _content = getSiteContentSync() ?? DEFAULT_SITE_CONTENT;
    } catch {
      _content = { ...DEFAULT_SITE_CONTENT };
    }
  }
  return _content;
}

let _stats: PublicStats | undefined;
export function publicStatsSnapshot(): PublicStats {
  if (_stats === undefined) {
    _stats = getPublicStatsSync() ?? { users: 0, ads: 0, trades: 0 };
  }
  return _stats;
}

/** Invalida os caches de snapshot (após reset de emergência) */
export function invalidateInstantSnapshots(): void {
  _homeAds = undefined;
  _feedAds = undefined;
  _content = undefined;
  _stats = undefined;
}
