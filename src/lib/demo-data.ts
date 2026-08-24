// ═══════════════════════════════════════════════════════════
// DEMO DATA · DADOS ESTÁTICOS SIMPLES E DIRETOS
//
// Nada de gerenciador de estado complexo: são CONSTANTES PURAS
// derivadas do seed estático, consumidas DIRETAMENTE no useState
// das páginas públicas. Como são determinísticas (datas fixas),
// servidor e cliente renderizam EXATAMENTE o mesmo HTML →
// hidratação 100% limpa, zero skeleton, zero loading.
// ═══════════════════════════════════════════════════════════
import { STATIC_DEMO_SEED } from "./demo-store";
import type { AdCardData, AuthUser } from "./types";

function mapStaticAd(ad: (typeof STATIC_DEMO_SEED.ads)[number]): AdCardData {
  const user = STATIC_DEMO_SEED.users.find((u) => u.id === ad.userId);
  return {
    id: ad.id,
    userId: ad.userId,
    tipo: ad.tipo,
    titulo: ad.titulo,
    descricao: ad.descricao,
    categoria: ad.categoria,
    bairro: ad.bairro,
    cidade: ad.cidade,
    uf: ad.uf,
    aceitaEmTroca: ad.aceitaEmTroca,
    destaque: ad.destaque,
    topoFeed: ad.topoFeed,
    status: ad.status,
    visualizacoes: ad.visualizacoes,
    createdAt: ad.createdAt, // data FIXA (determinística)
    images: STATIC_DEMO_SEED.adImages
      .filter((i) => i.adId === ad.id)
      .sort((x, y) => x.ordem - y.ordem)
      .map((i) => i.imageUrl),
    userName: user?.nome ?? "Usuário",
    userAvatar: user?.avatarUrl ?? null,
    userVerificado: !!user?.verificado,
    userMediaAvaliacao: user?.mediaAvaliacao ?? 0,
    userTrocasConcluidas: user?.trocasConcluidas ?? 0,
    userAprovacao: user?.aprovacao ?? 100,
  };
}

const SORTED_STATIC_ADS = [...STATIC_DEMO_SEED.ads].sort(
  (a, b) =>
    Number(b.topoFeed) - Number(a.topoFeed) ||
    Number(b.destaque) - Number(a.destaque) ||
    b.createdAt.localeCompare(a.createdAt)
);

/** Cards da Home (6 destaques) — inicialização direta do useState */
export const DEMO_HOME_ADS: AdCardData[] = SORTED_STATIC_ADS.slice(0, 6).map(mapStaticAd);

/** Cards do Feed/Busca — inicialização direta do useState */
export const DEMO_FEED_ADS: AdCardData[] = SORTED_STATIC_ADS.slice(0, 12).map(mapStaticAd);

/** Stats estáticas para o primeiro render (refresh assíncrono depois) */
export const DEMO_STATIC_STATS = {
  users: STATIC_DEMO_SEED.users.length,
  ads: STATIC_DEMO_SEED.ads.filter((a) => a.status === "ativo").length,
  trades: STATIC_DEMO_SEED.trades.filter((t) => t.status === "finished").length,
};

/** Login demo síncrono: busca o usuário pelas contas de teste */
export function getDemoUserByEmail(email: string): Omit<AuthUser, never> | null {
  const user = STATIC_DEMO_SEED.users.find(
    (u) => u.email.toLowerCase() === email.trim().toLowerCase()
  );
  if (!user) return null;
  const { senhaHash: _drop, ...clean } = user;
  void _drop;
  return clean;
}
