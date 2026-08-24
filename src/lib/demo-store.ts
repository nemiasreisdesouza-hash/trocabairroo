// ═══════════════════════════════════════════════════════════
// MODO DEMO · Banco local em localStorage
// Usado automaticamente quando o .env.local não tem chaves
// do Supabase (Interruptor Inteligente).
// ═══════════════════════════════════════════════════════════
import type {
  AuthUser,
  Trade,
  TradeStatus,
} from "./types";
import { DEFAULT_SITE_CONTENT } from "./site-content";

const DB_KEY = "trocabairro:demo:db";
const SESSION_KEY = "trocabairro:demo:session";

export type DemoDB = {
  version: number;
  users: (AuthUser & { senhaHash: string })[];
  ads: {
    id: string;
    userId: string;
    tipo: string;
    titulo: string;
    descricao: string;
    categoria: string;
    bairro: string;
    cidade: string;
    uf: string;
    aceitaEmTroca: string;
    destaque: boolean;
    topoFeed: boolean;
    status: string;
    visualizacoes: number;
    createdAt: string;
  }[];
  adImages: { id: string; adId: string; imageUrl: string; ordem: number }[];
  trades: {
    id: string;
    adId: string;
    requesterId: string;
    ownerId: string;
    status: TradeStatus;
    requesterCompleted: boolean;
    ownerCompleted: boolean;
    requesterReviewed: boolean;
    ownerReviewed: boolean;
    message: string | null;
    createdAt: string;
    updatedAt: string;
  }[];
  reviews: {
    id: string;
    tradeId: string;
    avaliadorId: string;
    avaliadoId: string;
    nota: number;
    comentario: string | null;
    cumprimento: string;
    createdAt: string;
  }[];
  siteContent: Record<string, string>;
  subscriptions: {
    id: string;
    userId: string;
    adId: string | null;
    plano: string;
    valor: number;
    status: string;
    expiresAt: string | null;
    createdAt: string;
  }[];
};

export const DEMO_ACCOUNTS = [
  { label: "👑 Admin", email: "admin@trocabairro.com", senha: "admin123" },
  { label: "🏪 Michelle (açaí)", email: "michelle@demo.com", senha: "123456" },
  { label: "🎸 Carlos (violão)", email: "carlos@demo.com", senha: "123456" },
];

// ─────────────────────────────────────────────
// Senhas (hash determinístico — apenas para o modo demo,
// não tem propósito criptográfico real)
// ─────────────────────────────────────────────
export function demoHash(senha: string): string {
  const input = `trocabairro-demo::${senha}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let round = 0; round < 4; round++) {
    for (let i = 0; i < input.length; i++) {
      const c = input.charCodeAt(i);
      h1 ^= c;
      h1 = Math.imul(h1, 0x01000193) >>> 0;
      h2 = Math.imul(h2 ^ ((c + round) & 0xff), 0x85ebca6b) >>> 0;
    }
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}-${Date.now()}`;

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

// ─────────────────────────────────────────────
// SEED · dados de demonstração
// ─────────────────────────────────────────────
export const SEED_IDS = {
  admin: "demo-admin",
  michelle: "demo-michelle",
  carlos: "demo-carlos",
  ana: "demo-ana",
  joao: "demo-joao",
  patricia: "demo-patricia",
};

function buildSeed(): DemoDB {
  const hAdmin = demoHash("admin123");
  const hUser = demoHash("123456");
  const avatarUrl = "/uploads/avatars/8a0be886-c849-4d22-b436-3d9d577dd654.jpg";
  const adImg = "/uploads/ads/febb10ea-3cad-480d-a5a1-97d88bb2da14.jpg";

  const base = {
    cpf: null,
    bio: null,
    mediaAvaliacao: 0,
    aprovacao: 100,
    totalAvaliacoes: 0,
    trocasConcluidas: 0,
    verificado: false,
    verificadoManual: false,
    role: "usuario",
    ativo: true,
  };

  const users: DemoDB["users"] = [
    {
      ...base,
      id: SEED_IDS.admin,
      nome: "Admin TrocaBairro",
      email: "admin@trocabairro.com",
      senhaHash: hAdmin,
      whatsapp: "(27) 99999-0001",
      avatarUrl: null,
      uf: "ES",
      cidade: "Vitória",
      bairro: "Centro",
      tipoPerfil: "ambos",
      categorias: [],
      role: "admin",
      createdAt: daysAgo(120),
    },
    {
      ...base,
      id: SEED_IDS.michelle,
      nome: "Michelle Almeida",
      email: "michelle@demo.com",
      senhaHash: hUser,
      whatsapp: "(27) 98888-1010",
      avatarUrl,
      bio: "Donça do açaí da Jesus de Nazaré 🍇 Também faço trufas e doces.",
      uf: "ES",
      cidade: "Vitória",
      bairro: "Jesus de Nazaré",
      tipoPerfil: "empreendedor",
      categorias: ["Alimentação", "Vendas & Comércio"],
      verificado: true,
      verificadoManual: true,
      createdAt: daysAgo(90),
    },
    {
      ...base,
      id: SEED_IDS.carlos,
      nome: "Carlos Vieira",
      email: "carlos@demo.com",
      senhaHash: hUser,
      whatsapp: "(27) 97777-2020",
      avatarUrl: null,
      bio: "Professor de violão há 12 anos. Toco em eventos nos fins de semana.",
      uf: "ES",
      cidade: "Vitória",
      bairro: "Goiabeiras",
      tipoPerfil: "criador",
      categorias: ["Música", "Educação"],
      createdAt: daysAgo(60),
    },
    {
      ...base,
      id: SEED_IDS.ana,
      nome: "Ana Prado",
      email: "ana@demo.com",
      senhaHash: hUser,
      whatsapp: "(27) 96666-3030",
      avatarUrl: null,
      bio: "Designer grática — logos, embalagens e social media.",
      uf: "ES",
      cidade: "Vitória",
      bairro: "Jardim Camburi",
      tipoPerfil: "criador",
      categorias: ["Design & Arte", "Marketing Digital"],
      createdAt: daysAgo(45),
    },
    {
      ...base,
      id: SEED_IDS.joao,
      nome: "João Barber",
      email: "joao@demo.com",
      senhaHash: hUser,
      whatsapp: "(27) 95555-4040",
      avatarUrl: null,
      bio: "Barbeiro profissional. Corte + barba na régua.",
      uf: "ES",
      cidade: "Vila Velha",
      bairro: "Praia da Costa",
      tipoPerfil: "empreendedor",
      categorias: ["Beleza & Estética"],
      createdAt: daysAgo(30),
    },
    {
      ...base,
      id: SEED_IDS.patricia,
      nome: "Patrícia Souza",
      email: "patricia@demo.com",
      senhaHash: hUser,
      whatsapp: "(27) 94444-5050",
      avatarUrl: null,
      bio: "Fotógrafa de eventos e produtos.",
      uf: "ES",
      cidade: "Serra",
      bairro: "Laranjeiras",
      tipoPerfil: "criador",
      categorias: ["Fotografia", "Eventos"],
      createdAt: daysAgo(20),
    },
  ];

  const ads: DemoDB["ads"] = [
    {
      id: "demo-ad-1",
      userId: SEED_IDS.michelle,
      tipo: "ofereço",
      titulo: "Açaí de 500ml e trufas artesanais",
      descricao:
        "Ofereço açaí cremoso de 500ml com 2 acompanhamentos e trufas artesanais para festas e eventos do bairro. Ideal para quem quer adoçar o dia!",
      categoria: "Alimentação",
      bairro: "Jesus de Nazaré",
      cidade: "Vitória",
      uf: "ES",
      aceitaEmTroca: "Vídeos para Instagram, design de cardápio",
      destaque: true,
      topoFeed: true,
      status: "ativo",
      visualizacoes: 214,
      createdAt: daysAgo(12),
    },
    {
      id: "demo-ad-2",
      userId: SEED_IDS.carlos,
      tipo: "ofereço",
      titulo: "Aulas de violão (iniciante e intermediário)",
      descricao:
        "Dou aulas de violão há 12 anos. Método prático, focado em música que você gosta. Aulas de 50 minutos, presencial ou online.",
      categoria: "Música",
      bairro: "Goiabeiras",
      cidade: "Vitória",
      uf: "ES",
      aceitaEmTroca: "Logo profissional, corte de cabelo",
      destaque: false,
      topoFeed: false,
      status: "ativo",
      visualizacoes: 132,
      createdAt: daysAgo(9),
    },
    {
      id: "demo-ad-3",
      userId: SEED_IDS.ana,
      tipo: "ofereço",
      titulo: "Criação de logo e identidade visual",
      descricao:
        "Crio sua logo, paleta de cores e mini manual de marca. Entrego em 7 dias com 2 rodadas de revisão. Portfólio no perfil!",
      categoria: "Design & Arte",
      bairro: "Jardim Camburi",
      cidade: "Vitória",
      uf: "ES",
      aceitaEmTroca: "Açaí para equipe, aulas de violão",
      destaque: false,
      topoFeed: false,
      status: "ativo",
      visualizacoes: 98,
      createdAt: daysAgo(7),
    },
    {
      id: "demo-ad-4",
      userId: SEED_IDS.joao,
      tipo: "ofereço",
      titulo: "Corte masculino + barba na régua",
      descricao:
        "Corte na tesoura ou máquina, incluindo barba com toalha quente. Atendo com hora marcada na Praia da Costa.",
      categoria: "Beleza & Estética",
      bairro: "Praia da Costa",
      cidade: "Vila Velha",
      uf: "ES",
      aceitaEmTroca: "Fotografia profissional, açaí",
      destaque: false,
      topoFeed: false,
      status: "ativo",
      visualizacoes: 76,
      createdAt: daysAgo(5),
    },
    {
      id: "demo-ad-5",
      userId: SEED_IDS.patricia,
      tipo: "ofereço",
      titulo: "Ensaio fotográfico de produtos e eventos",
      descricao:
        "Fotografia profissional para catálogos, redes sociais e eventos. Inclui 15 fotos tratadas por sessão.",
      categoria: "Fotografia",
      bairro: "Laranjeiras",
      cidade: "Serra",
      uf: "ES",
      aceitaEmTroca: "Corte de cabelo, manutenção de site",
      destaque: false,
      topoFeed: false,
      status: "ativo",
      visualizacoes: 54,
      createdAt: daysAgo(3),
    },
    {
      id: "demo-ad-6",
      userId: SEED_IDS.michelle,
      tipo: "preciso",
      titulo: "Preciso de vídeos curtos para o Instagram",
      descricao:
        "Quero 4 vídeos de até 30 segundos por semana mostrando os produtos da minha loja de açaí. Peguei bem o estilo descontraído.",
      categoria: "Vídeo & Produção",
      bairro: "Jesus de Nazaré",
      cidade: "Vitória",
      uf: "ES",
      aceitaEmTroca: "Açaí de 500ml diário por 3 semanas",
      destaque: false,
      topoFeed: false,
      status: "ativo",
      visualizacoes: 187,
      createdAt: daysAgo(2),
    },
  ];

  const adImages: DemoDB["adImages"] = [
    { id: "demo-img-1", adId: "demo-ad-1", imageUrl: adImg, ordem: 0 },
    { id: "demo-img-2", adId: "demo-ad-4", imageUrl: adImg, ordem: 0 },
  ];

  const trades: DemoDB["trades"] = [
    {
      // Troca finalizada (Michelle ⇄ Carlos) — exemplo de reputação
      id: "demo-trade-1",
      adId: "demo-ad-1",
      requesterId: SEED_IDS.carlos,
      ownerId: SEED_IDS.michelle,
      status: "finished",
      requesterCompleted: true,
      ownerCompleted: true,
      requesterReviewed: true,
      ownerReviewed: true,
      message: "Quero trocar aula de violão por açaí semanal!",
      createdAt: daysAgo(25),
      updatedAt: daysAgo(20),
    },
    {
      // Troca aguardando avaliação recíproca (Ana ⇄ Michelle)
      id: "demo-trade-2",
      adId: "demo-ad-3",
      requesterId: SEED_IDS.michelle,
      ownerId: SEED_IDS.ana,
      status: "awaiting_reviews",
      requesterCompleted: true,
      ownerCompleted: true,
      requesterReviewed: false,
      ownerReviewed: false,
      message: "Faço o logo da sua loja em troca do açaí da equipe!",
      createdAt: daysAgo(15),
      updatedAt: daysAgo(4),
    },
    {
      // Proposta pendente para João (corte ⇄ fotografia)
      id: "demo-trade-3",
      adId: "demo-ad-4",
      requesterId: SEED_IDS.patricia,
      ownerId: SEED_IDS.joao,
      status: "pending",
      requesterCompleted: false,
      ownerCompleted: false,
      requesterReviewed: false,
      ownerReviewed: false,
      message: "Troco ensaio fotográfico por corte + barba. Topa?",
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
  ];

  const reviews: DemoDB["reviews"] = [
    {
      id: "demo-review-1",
      tradeId: "demo-trade-1",
      avaliadorId: SEED_IDS.carlos,
      avaliadoId: SEED_IDS.michelle,
      nota: 5,
      comentario: "Açaí maravilhoso e sempre pontual! Super recomendo.",
      cumprimento: "sim",
      createdAt: daysAgo(20),
    },
    {
      id: "demo-review-2",
      tradeId: "demo-trade-1",
      avaliadorId: SEED_IDS.michelle,
      avaliadoId: SEED_IDS.carlos,
      nota: 5,
      comentario: "Carlos é um professor paciente. Minha filha adorou!",
      cumprimento: "sim",
      createdAt: daysAgo(20),
    },
  ];

  const subscriptions: DemoDB["subscriptions"] = [
    {
      id: "demo-sub-1",
      userId: SEED_IDS.michelle,
      adId: "demo-ad-1",
      plano: "topo_feed",
      valor: 3,
      status: "ativo",
      expiresAt: new Date(Date.now() + 5 * 864e5).toISOString(),
      createdAt: daysAgo(2),
    },
    {
      id: "demo-sub-2",
      userId: SEED_IDS.michelle,
      adId: "demo-ad-1",
      plano: "destaque",
      valor: 5,
      status: "ativo",
      expiresAt: new Date(Date.now() + 28 * 864e5).toISOString(),
      createdAt: daysAgo(2),
    },
  ];

  // Reputação derivada das reviews do seed
  const michelle = users.find((u) => u.id === SEED_IDS.michelle)!;
  michelle.mediaAvaliacao = 5;
  michelle.aprovacao = 100;
  michelle.totalAvaliacoes = 1;
  michelle.trocasConcluidas = 1;
  const carlos = users.find((u) => u.id === SEED_IDS.carlos)!;
  carlos.mediaAvaliacao = 5;
  carlos.aprovacao = 100;
  carlos.totalAvaliacoes = 1;
  carlos.trocasConcluidas = 1;

  return {
    version: 1,
    users,
    ads,
    adImages,
    trades,
    reviews,
    siteContent: {},
    subscriptions,
  };
}

// ─────────────────────────────────────────────
// Persistência
// ─────────────────────────────────────────────
let cache: DemoDB | null = null;

export function getDemoDB(): DemoDB {
  if (typeof window === "undefined") {
    // Server-side: devolve vazio (páginas client nunca devem chegar aqui)
    return {
      version: 1,
      users: [],
      ads: [],
      adImages: [],
      trades: [],
      reviews: [],
      siteContent: {},
      subscriptions: [],
    };
  }
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      cache = JSON.parse(raw) as DemoDB;
      return cache;
    }
  } catch {
    // segue para o seed
  }
  cache = buildSeed();
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(cache));
  } catch {
    // sem storage (modo privado) — mantém só em memória
  }
  return cache;
}

export function saveDemoDB(db: DemoDB) {
  cache = db;
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    throw new Error(
      "Armazenamento local cheio. Remova algumas imagens do modo demo."
    );
  }
}

/** Força reset do banco demo (botão no admin) */
export function resetDemoDB(): void {
  if (typeof window === "undefined") return;
  cache = buildSeed();
  saveDemoDB(cache);
}

export function getDemoSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_KEY);
}

export function setDemoSessionId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(SESSION_KEY, id);
  else localStorage.removeItem(SESSION_KEY);
}

export function newId(): string {
  return uid();
}

// ─────────────────────────────────────────────
// Regras de negócio demo (espelham os triggers SQL)
// ─────────────────────────────────────────────
export function recomputeDemoReputation(db: DemoDB, userId: string) {
  const user = db.users.find((u) => u.id === userId);
  if (!user) return;
  const received = db.reviews.filter((r) => r.avaliadoId === userId);
  const total = received.length;
  const positivas = received.filter((r) => r.cumprimento === "sim").length;
  const media =
    total > 0
      ? received.reduce((acc, r) => acc + r.nota, 0) / total
      : 0;
  user.totalAvaliacoes = total;
  user.aprovacao = total > 0 ? Math.round((positivas / total) * 100) : 100;
  user.mediaAvaliacao = Math.round(media * 100) / 100;
}

export function finishDemoTradeIfNeeded(db: DemoDB, tradeId: string) {
  const trade = db.trades.find((t) => t.id === tradeId);
  if (!trade) return;
  const reviewCount = db.reviews.filter((r) => r.tradeId === tradeId).length;
  if (reviewCount >= 2 && trade.status === "awaiting_reviews") {
    trade.status = "finished";
    trade.updatedAt = new Date().toISOString();
    for (const uid2 of [trade.requesterId, trade.ownerId]) {
      const u = db.users.find((x) => x.id === uid2);
      if (u) u.trocasConcluidas += 1;
    }
  }
}

export function expireDemoSubscriptions(db: DemoDB) {
  const now = Date.now();
  for (const sub of db.subscriptions) {
    if (
      sub.status === "ativo" &&
      sub.expiresAt &&
      new Date(sub.expiresAt).getTime() < now
    ) {
      sub.status = "expirado";
    }
  }
  const isActive = (adId: string, plano: string) =>
    db.subscriptions.some(
      (s) => s.adId === adId && s.plano === plano && s.status === "ativo"
    );
  for (const ad of db.ads) {
    if (ad.topoFeed && !isActive(ad.id, "topo_feed")) ad.topoFeed = false;
    if (ad.destaque && !isActive(ad.id, "destaque")) ad.destaque = false;
  }
  for (const u of db.users) {
    if (
      u.verificado &&
      !u.verificadoManual &&
      !db.subscriptions.some(
        (s) => s.userId === u.id && s.plano === "verificado" && s.status === "ativo"
      )
    ) {
      u.verificado = false;
    }
  }
}

/** Helper para construir Trade "com a outra parte" */
export function decorateDemoTrade(
  db: DemoDB,
  trade: DemoDB["trades"][number],
  viewerId: string
): Trade {
  const ad = db.ads.find((a) => a.id === trade.adId);
  const otherId =
    trade.requesterId === viewerId ? trade.ownerId : trade.requesterId;
  const other = db.users.find((u) => u.id === otherId);
  return {
    id: trade.id,
    adId: trade.adId,
    adTitulo: ad?.titulo || "Anúncio removido",
    adTipo: ad?.tipo || "ofereço",
    requesterId: trade.requesterId,
    ownerId: trade.ownerId,
    status: trade.status,
    requesterCompleted: trade.requesterCompleted,
    ownerCompleted: trade.ownerCompleted,
    requesterReviewed: trade.requesterReviewed,
    ownerReviewed: trade.ownerReviewed,
    createdAt: trade.createdAt,
    updatedAt: trade.updatedAt,
    otherId,
    otherNome: other?.nome || "Usuário",
    otherAvatar: other?.avatarUrl ?? null,
    otherWhatsapp: other?.whatsapp ?? null,
  };
}

export { DEFAULT_SITE_CONTENT };
