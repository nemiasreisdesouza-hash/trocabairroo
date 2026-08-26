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
import { isSupabaseConfigured } from "./supabase";

const DB_KEY = "trocabairro:demo:db";
const SESSION_KEY = "trocabairro:demo:session";
const DEMO_DB_VERSION = 1;

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
    whatsappShareStatus?: string;
    whatsappRequestedBy?: string | null;
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
  /** Chat temporário (opcional p/ compat com bancos locais antigos) */
  messages?: {
    id: string;
    tradeId: string;
    senderId: string;
    content: string;
    createdAt: string;
    readAt: string | null;
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

// 📌 DATAS FIXAS E DETERMINÍSTICAS: o seed gera exatamente os mesmos
// ISO strings no prerender do servidor e no navegador — requisito para
// hidratação 100% limpa com dados estáticos renderizados direto.
const SEED_EPOCH = Date.UTC(2026, 7, 24, 12, 0, 0); // 24/08/2026 12:00 UTC
const daysAgo = (n: number) =>
  new Date(SEED_EPOCH - n * 24 * 60 * 60 * 1000).toISOString();

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
      nome: "Admin TrocaES",
      email: "admin@trocabairro.com",
      senhaHash: hAdmin,
      whatsapp: "(27) 99999-0001",
      avatarUrl: null,
      uf: "ES",
      cidade: "Vitória",
      bairro: "Centro",
      tipoPerfil: "ambos",
      categorias: [],
      verificado: true,
      verificadoManual: true,
      verifiedUntil: new Date(SEED_EPOCH + 3650 * 864e5).toISOString(),
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
      verifiedUntil: new Date(SEED_EPOCH + 3650 * 864e5).toISOString(),
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
      whatsappShareStatus: "approved",
      whatsappRequestedBy: "demo-michelle",
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
      whatsappShareStatus: "none",
      whatsappRequestedBy: null,
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
      whatsappShareStatus: "none",
      whatsappRequestedBy: null,
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

  const messages: NonNullable<DemoDB["messages"]> = [
    {
      id: "demo-msg-1",
      tradeId: "demo-trade-2",
      senderId: SEED_IDS.michelle,
      content: "Oi Ana! Vi que você faz logos. Topa trocar pelo açaí da equipe? 🍇",
      createdAt: daysAgo(6),
      readAt: daysAgo(6),
    },
    {
      id: "demo-msg-2",
      tradeId: "demo-trade-2",
      senderId: SEED_IDS.ana,
      content: "Oi Michelle! Topo sim 😄 Faço o logo completo em troca do açaí de 500ml por 3 semanas.",
      createdAt: daysAgo(5),
      readAt: daysAgo(5),
    },
    {
      id: "demo-msg-3",
      tradeId: "demo-trade-2",
      senderId: SEED_IDS.michelle,
      content: "Fechado! Já delivery toda segunda 🚚",
      createdAt: daysAgo(4),
      readAt: daysAgo(4),
    },
    {
      id: "demo-msg-4",
      tradeId: "demo-trade-3",
      senderId: SEED_IDS.patricia,
      content: "Oi João! Troco um ensaio fotográfico completo por corte + barba. Topa?",
      createdAt: daysAgo(1),
      readAt: null,
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
    version: DEMO_DB_VERSION,
    users,
    ads,
    adImages,
    trades,
    reviews,
    siteContent: {},
    subscriptions,
    messages,
  };
}

// ─────────────────────────────────────────────
// Persistência · BLINDADA contra iframes sandbox
//
// Em iframes restritos (preview), o simples acesso a
// window.localStorage lança SecurityError. TODA operação
// de storage passa por helpers seguros com try/catch —
// em caso de falha o app segue com o SEED ESTÁTICO em
// memória (nunca quebra, nunca trava o loading).
// ─────────────────────────────────────────────
let cache: DemoDB | null = null;
let storageOk = true;
let memorySessionId: string | null = null;

/** Acesso seguro ao localStorage (nunca lança) */
function safeStorage(): Storage | null {
  if (typeof window === "undefined" || !storageOk) return null;
  try {
    // Acessar a propriedade em si pode lançar SecurityError
    const st = window.localStorage;
    const probe = "__tb_probe__";
    st.setItem(probe, "1");
    st.removeItem(probe);
    return st;
  } catch {
    storageOk = false;
    return null;
  }
}

function safeGetItem(key: string): string | null {
  const st = safeStorage();
  if (!st) return null;
  try {
    return st.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): boolean {
  const st = safeStorage();
  if (!st) return false;
  try {
    st.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemoveItem(key: string): void {
  const st = safeStorage();
  if (!st) return;
  try {
    st.removeItem(key);
  } catch {
    /* noop */
  }
}

/** Espelha a sessão em cookie (fallback quando storage falha) */
function mirrorSessionCookie(id: string | null): void {
  try {
    if (id) {
      document.cookie = `${SESSION_KEY}=${encodeURIComponent(id)}; path=/; max-age=2592000; SameSite=Lax`;
    } else {
      document.cookie = `${SESSION_KEY}=; path=/; max-age=0`;
    }
  } catch {
    /* noop */
  }
}

function readSessionCookie(): string | null {
  try {
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${SESSION_KEY}=([^;]*)`)
    );
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

/**
 * BUG 2 (skeleton infinito): valida rigorosamente o payload do
 * localStorage. Qualquer dado corrompido/antigo → re-semeia na hora,
 * garantindo que os anúncios apareçam instantaneamente.
 */
function isValidDemoDB(db: unknown): db is DemoDB {
  if (!db || typeof db !== "object") return false;
  const d = db as Record<string, unknown>;
  const base =
    d.version === DEMO_DB_VERSION &&
    Array.isArray(d.users) &&
    Array.isArray(d.ads) &&
    Array.isArray(d.adImages) &&
    Array.isArray(d.trades) &&
    Array.isArray(d.reviews) &&
    Array.isArray(d.subscriptions) &&
    typeof d.siteContent === "object" &&
    d.siteContent !== null;
  if (!base) return false;
  // messages é opcional (bancos locais anteriores ao chat)
  if (d.messages !== undefined && !Array.isArray(d.messages)) return false;
  return true;
}

/** Normaliza campos opcionais ausentes (ex.: messages) */
function normalizeDemoDB(db: DemoDB): DemoDB {
  if (!Array.isArray(db.messages)) db.messages = [];
  return db;
}

export function getDemoDB(): DemoDB {
  if (typeof window === "undefined") {
    // Server-side: devolve vazio (páginas client nunca devem chegar aqui)
    return {
      version: DEMO_DB_VERSION,
      users: [],
      ads: [],
      adImages: [],
      trades: [],
      reviews: [],
      siteContent: {},
      subscriptions: [],
    };
  }
  if (cache && isValidDemoDB(cache)) return cache;

  const raw = safeGetItem(DB_KEY);
  if (raw !== null) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (isValidDemoDB(parsed)) {
        cache = normalizeDemoDB(parsed);
        return cache;
      }
      // Dado corrompido/antigo → limpa e re-semeia (auto-heal)
      safeRemoveItem(DB_KEY);
      safeRemoveItem(SESSION_KEY);
    } catch {
      safeRemoveItem(DB_KEY);
      safeRemoveItem(SESSION_KEY);
    }
  }

  // 🎯 FALLBACK IMEDIATO: SEMPRE devolve o seed estático
  // (mesmo sem localStorage algum) — dados disponíveis de
  // forma SÍNCRONA no primeiro render.
  cache = normalizeDemoDB(cloneStaticSeed());
  safeSetItem(DB_KEY, JSON.stringify(cache));
  return cache;
}

/** Cópia profunda do SEED ESTÁTICO exportado (nunca muta o original) */
function cloneStaticSeed(): DemoDB {
  return JSON.parse(JSON.stringify(STATIC_DEMO_SEED)) as DemoDB;
}

export function saveDemoDB(db: DemoDB) {
  cache = db;
  if (typeof window === "undefined") return;
  // Nunca lança: sem storage/quota → segue apenas em memória
  if (!safeSetItem(DB_KEY, JSON.stringify(db))) {
    console.warn(
      "[TrocaES·Demo] localStorage indisponível — dados mantidos apenas em memória nesta sessão."
    );
  }
}

/** Força reset do banco demo (botão no admin) */
export function resetDemoDB(): void {
  if (typeof window === "undefined") return;
  cache = cloneStaticSeed();
  saveDemoDB(cache);
}

/**
 * 🚨 RESET DE EMERGÊNCIA (rodapé do modo demo):
 * limpa dados corrompidos (localStorage.clear() se necessário),
 * restaura a lista padrão de anúncios e recarrega.
 * Nunca lança — em pior caso segue com o seed em memória.
 */
export function emergencyDemoReset(): void {
  cache = null;
  memorySessionId = null;
  try {
    localStorage.removeItem(DB_KEY);
    localStorage.removeItem(SESSION_KEY);
  } catch {
    try {
      localStorage.clear();
    } catch {
      /* storage bloqueado — segue em memória */
    }
  }
  cache = cloneStaticSeed();
  saveDemoDB(cache);
}

export function getDemoSessionId(): string | null {
  if (typeof window === "undefined") return null;
  // 1) memória (sessão atual) 2) localStorage 3) cookie — nunca lança
  if (memorySessionId) return memorySessionId;
  const fromStorage = safeGetItem(SESSION_KEY);
  if (fromStorage) return fromStorage;
  return readSessionCookie();
}

export function setDemoSessionId(id: string | null) {
  if (typeof window === "undefined") return;
  memorySessionId = id; // sempre — garante login mesmo sem storage
  if (id) {
    safeSetItem(SESSION_KEY, id);
    mirrorSessionCookie(id);
  } else {
    safeRemoveItem(SESSION_KEY);
    mirrorSessionCookie(null);
  }
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
    // 🎫 Passe pré-pago: selo apaga quando a validade vence
    if (
      u.verificado &&
      !u.verificadoManual &&
      u.verifiedUntil &&
      new Date(u.verifiedUntil).getTime() < now
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
    whatsappShareStatus: trade.whatsappShareStatus ?? "none",
    whatsappRequestedBy: trade.whatsappRequestedBy ?? null,
    createdAt: trade.createdAt,
    updatedAt: trade.updatedAt,
    otherId,
    otherNome: other?.nome || "Usuário",
    otherAvatar: other?.avatarUrl ?? null,
    otherWhatsapp:
      (trade.whatsappShareStatus ?? "none") === "approved"
        ? other?.whatsapp ?? null
        : null,
  };
}

export { DEFAULT_SITE_CONTENT };

// ═══════════════════════════════════════════════════════════
// 🎯 SEED ESTÁTICO EXPORTADO (CONSTANTE)
// Anúncios e usuários iniciais como CONSTANTES ESTÁTICAS —
// disponíveis de forma SÍNCRONA, sem qualquer dependência de
// localStorage. Se o storage falhar/estiver bloqueado (iframe
// sandbox) ou corrompido, o app usa estes dados IMEDIATAMENTE.
// ═══════════════════════════════════════════════════════════
export const STATIC_DEMO_SEED: DemoDB = buildSeed();
export const DEMO_STATIC_USERS = STATIC_DEMO_SEED.users;
export const DEMO_STATIC_ADS = STATIC_DEMO_SEED.ads;

// ═══════════════════════════════════════════════════════════
// INICIALIZAÇÃO INSTANTÂNEA (BUG 2)
// Pré-aquece o cache do banco demo assim que este módulo é
// avaliado no navegador — ANTES do primeiro render das páginas.
// Nunca lança (getDemoDB é totalmente blindado).
// ═══════════════════════════════════════════════════════════
if (typeof window !== "undefined" && !isSupabaseConfigured()) {
  try {
    getDemoDB();
  } catch {
    // noop — getDemoDB já é resiliente
  }
}
