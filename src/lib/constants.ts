// ═══════════════════════════════════════════════════════════
// Constantes do TrocaES
// ═══════════════════════════════════════════════════════════

export const CATEGORIAS = [
  "Alimentação",
  "Beleza & Estética",
  "Design & Arte",
  "Educação",
  "Eventos",
  "Fotografia",
  "Informática & TI",
  "Marketing Digital",
  "Moda & Costura",
  "Música",
  "Saúde & Bem-estar",
  "Serviços Domésticos",
  "Vendas & Comércio",
  "Vídeo & Produção",
];

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

// Padrão do produto: Espírito Santo 🌱
export const UF_PADRAO = "ES";
export const CIDADE_PADRAO = "Vitória";

export const CIDADES_ES = [
  "Vitória",
  "Vila Velha",
  "Serra",
  "Cariacica",
  "Viana",
  "Guarapari",
];

// ─────────────────────────────────────────────
// 👑 SUPER ADMIN MESTRE (Proprietário Fundador)
// Configurável via NEXT_PUBLIC_SUPER_ADMIN_EMAIL.
// Regras invioláveis no banco: supabase/schema.sql
// (auto-promoção no cadastro + trava anti-exclusão/rebaixamento).
// ─────────────────────────────────────────────
export const SUPER_ADMIN_EMAIL = (
  process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || "nemiasreisdesouza@gmail.com"
).toLowerCase();

// ─────────────────────────────────────────────
// Opção dinâmica "Outro..." (cidade e bairro)
// Sentinela interna — o valor REAL salvo no banco
// é sempre o texto digitado pelo usuário.
// ─────────────────────────────────────────────
export const CIDADE_OUTRA = "__outra_cidade__";
export const BAIRRO_OUTRO = "__outra_bairro__";

export const BAIRROS_POR_CIDADE: Record<string, string[]> = {
  "Vitória": [
    "Jesus de Nazaré",
    "Ilha de Santa Maria",
    "Inhanguetá",
    "Goiabeiras",
    "Jardim Camburi",
    "Jardim da Penha",
    "Mata da Praia",
    "Praia do Canto",
    "Santa Luíza",
    "Bento Ferreira",
    "Jucutuquara",
    "Maruípe",
    "Santo Antônio",
    "Centro",
  ],
  "Vila Velha": [
    "Praia da Costa",
    "Itapoã",
    "Itararé",
    "Glória",
    "Santa Luíza",
    "Grande Vitória",
    "Cobilândia",
    "Airports",
    "Ipiranguinha",
    "Ataíde",
  ],
  "Serra": [
    "Laranjeiras",
    "Praia de Laranjeiras",
    "Bairro de Fátima",
    "Serra Centro",
    "Jardim Limoeiro",
    "Feu Rosa",
    "Manguinhos",
    "Soteco",
    "Novo Horizonte",
  ],
  "Cariacica": [
    "Campo Grande",
    "Jardim América",
    "Porto de Santana",
    "Itacibá",
    "Rio Branco",
    "Cobiça",
  ],
  "Viana": ["Centro", "Jardim Colorado", "Nova Canaã", "Iconha"],
  "Guarapari": ["Centro", "Praia do Morro", "Muquiçaba", "Bela Vista"],
};

/** Compat: lista de bairros de Vitória (usada como fallback) */
export const BAIRROS_VITORIA = BAIRROS_POR_CIDADE["Vitória"];

// ─────────────────────────────────────────────
// IMPULSIONAMENTOS (pagos por uso)
// ─────────────────────────────────────────────
export type Impulsionamento = {
  id: "topo_feed" | "destaque" | "verificado";
  nome: string;
  descricao: string;
  valor: number;
  badge: string;
  duracaoDias: number;
};

export const IMPULSIONAMENTOS: Impulsionamento[] = [
  {
    id: "topo_feed",
    nome: "Topo do Feed",
    descricao: "Apareça no topo do feed por 7 dias",
    valor: 3.0,
    badge: "🚀",
    duracaoDias: 7,
  },
  {
    id: "destaque",
    nome: "Selo Destaque",
    descricao: "Receba um selo de destaque no seu anúncio",
    valor: 5.0,
    badge: "⭐",
    duracaoDias: 30,
  },
  {
    id: "verificado",
    nome: "Profissional Verificado",
    descricao: "Selo de verificação no seu perfil por 30 dias",
    valor: 29.9,
    badge: "✅",
    duracaoDias: 30,
  },
];

// ─────────────────────────────────────────────
// PLANOS FREEMIUM (assinaturas mensais)
// ─────────────────────────────────────────────
export type PlanoAssinatura = {
  id: "experimente" | "conexao" | "expansao";
  nome: string;
  preco: number;
  periodo: string;
  badge: string;
  destaque: boolean;
  descricao: string;
  features: string[];
};

export const PLANOS_ASSINATURA: PlanoAssinatura[] = [
  {
    id: "experimente",
    nome: "Experimente",
    preco: 0,
    periodo: "para sempre",
    badge: "🌱",
    destaque: false,
    descricao: "Ideal para conhecer a plataforma e realizar suas primeiras trocas no bairro.",
    features: [
      "Anúncios de troca ilimitados",
      "Contato direto via WhatsApp",
      "Reputação com estrelas e % de aprovação",
      "Avaliações recíprocas após cada troca",
    ],
  },
  {
    id: "conexao",
    nome: "Conexão",
    preco: 49.9,
    periodo: "/mês",
    badge: "🚀",
    destaque: true,
    descricao: "Para profissionais e vizinhos ativos que buscam mais trocas e conexões.",
    features: [
      "Tudo do plano Experimente",
      "1 Topo do Feed por mês incluso",
      "Selo Destaque em 1 anúncio",
      "Estatísticas de visualizações",
      "Suporte prioritário via WhatsApp",
    ],
  },
  {
    id: "expansao",
    nome: "Expansão",
    preco: 89.9,
    periodo: "/mês",
    badge: "👑",
    destaque: false,
    descricao: "Visibilidade máxima para destacar seus serviços em todo o município.",
    features: [
      "Tudo do plano Conexão",
      "Selo Profissional Verificado incluso",
      "3 impulsionamentos por mês",
      "Anúncios em destaque em toda a cidade",
      "Divulgação nas redes do TrocaES",
    ],
  },
];

/** Compat com código antigo: alias para impulsionamentos */
export const PLANOS = IMPULSIONAMENTOS;
