// ═══════════════════════════════════════════════════════════
// CMS · CONTEÚDO DINÂMICO DO SITE (tabela site_content)
// A Home lê os textos do Supabase (ou localStorage em demo).
// Se a tabela estiver vazia → usa estes defaults.
// ═══════════════════════════════════════════════════════════

export const DEFAULT_SITE_CONTENT: Record<string, string> = {
  "home.hero.badge": "Jesus de Nazaré · Vitória/ES",
  "home.hero.title": "Troque serviços com",
  "home.hero.title_highlight": "gente do seu bairro",
  "home.hero.subtitle":
    "Sem dinheiro. Apenas **confiança**, parcerias e oportunidades.",
  "home.hero.cta_primary": "🚀 Começar minha troca agora",
  "home.hero.cta_secondary": "Explorar anúncios perto de mim",

  "home.como_funciona.title": "Como funciona? 🤔",
  "home.como_funciona.1.emoji": "📣",
  "home.como_funciona.1.title": "Publique o que tem",
  "home.como_funciona.1.desc":
    "Ofereça um serviço ou diga o que você precisa. É grátis!",
  "home.como_funciona.2.emoji": "🤝",
  "home.como_funciona.2.title": "Encontre seu par",
  "home.como_funciona.2.desc":
    "Conecte com alguém do bairro pelo WhatsApp e combinem a troca.",
  "home.como_funciona.3.emoji": "⭐",
  "home.como_funciona.3.title": "Avalie e ganhe reputação",
  "home.como_funciona.3.desc":
    "Após a troca, ambos avaliam. Sua reputação cresce no bairro!",

  "home.porque.title": "Por que usar o TrocaBairro?",
  "home.porque.1.emoji": "🛡️",
  "home.porque.1.text": "100% Gratuito",
  "home.porque.2.emoji": "👥",
  "home.porque.2.text": "Gente do bairro",
  "home.porque.3.emoji": "⭐",
  "home.porque.3.text": "Sistema de reputação",
  "home.porque.4.emoji": "⚡",
  "home.porque.4.text": "Via WhatsApp",

  "home.depoimentos.title": "Quem já trocou 💬",
  "home.depoimentos.1.name": "Michelle A.",
  "home.depoimentos.1.bairro": "Jesus de Nazaré",
  "home.depoimentos.1.text":
    "Troquei vídeos pro meu açaí por 3 semanas. Incrível demais!",
  "home.depoimentos.1.stars": "5",
  "home.depoimentos.2.name": "Carlos V.",
  "home.depoimentos.2.bairro": "Goiabeiras",
  "home.depoimentos.2.text":
    "Consegui um designer pro meu logo em troca de aula de violão.",
  "home.depoimentos.2.stars": "5",
  "home.depoimentos.3.name": "Ana P.",
  "home.depoimentos.3.bairro": "Jardim Camburi",
  "home.depoimentos.3.text": "A plataforma é simples e direta. Já fiz 4 trocas!",
  "home.depoimentos.3.stars": "5",

  "home.cta.title": "Comece agora, é grátis! 🎉",
  "home.cta.subtitle": "Cadastre-se em 2 minutos e conecte com seu bairro.",
};

// ─────────────────────────────────────────────
// Definição dos campos editáveis no /admin/cms
// ─────────────────────────────────────────────
export type SiteContentField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "number";
  placeholder?: string;
};

export type SiteContentGroup = {
  id: string;
  label: string;
  icon: string;
  description: string;
  fields: SiteContentField[];
};

export const SITE_CONTENT_GROUPS: SiteContentGroup[] = [
  {
    id: "hero",
    label: "Hero (topo da Home)",
    icon: "🟣",
    description: "Título roxo-escuro e botões amarelos de alto contraste.",
    fields: [
      { key: "home.hero.badge", label: "Selo de localização (acima do título)", type: "text" },
      { key: "home.hero.title", label: "Título da Hero (parte branca)", type: "text" },
      { key: "home.hero.title_highlight", label: "Título da Hero (destaque amarelo)", type: "text" },
      { key: "home.hero.subtitle", label: "Subtítulo (use **texto** para negrito)", type: "textarea" },
      { key: "home.hero.cta_primary", label: "Botão amarelo principal", type: "text" },
      { key: "home.hero.cta_secondary", label: "Botão secundário (transparente)", type: "text" },
    ],
  },
  {
    id: "como_funciona",
    label: 'Seção "Como Funciona?"',
    icon: "🤔",
    description: "Os 3 passos exibidos na Home.",
    fields: [
      { key: "home.como_funciona.title", label: "Título da seção", type: "text" },
      { key: "home.como_funciona.1.emoji", label: "Passo 1 · Emoji", type: "text" },
      { key: "home.como_funciona.1.title", label: "Passo 1 · Título", type: "text" },
      { key: "home.como_funciona.1.desc", label: "Passo 1 · Descrição", type: "textarea" },
      { key: "home.como_funciona.2.emoji", label: "Passo 2 · Emoji", type: "text" },
      { key: "home.como_funciona.2.title", label: "Passo 2 · Título", type: "text" },
      { key: "home.como_funciona.2.desc", label: "Passo 2 · Descrição", type: "textarea" },
      { key: "home.como_funciona.3.emoji", label: "Passo 3 · Emoji", type: "text" },
      { key: "home.como_funciona.3.title", label: "Passo 3 · Título", type: "text" },
      { key: "home.como_funciona.3.desc", label: "Passo 3 · Descrição", type: "textarea" },
    ],
  },
  {
    id: "porque",
    label: 'Seção "Por que usar o TrocaBairro?"',
    icon: "💜",
    description: "Os 4 cards de benefícios.",
    fields: [
      { key: "home.porque.title", label: "Título da seção", type: "text" },
      { key: "home.porque.1.emoji", label: "Benefício 1 · Emoji", type: "text" },
      { key: "home.porque.1.text", label: "Benefício 1 · Texto", type: "text" },
      { key: "home.porque.2.emoji", label: "Benefício 2 · Emoji", type: "text" },
      { key: "home.porque.2.text", label: "Benefício 2 · Texto", type: "text" },
      { key: "home.porque.3.emoji", label: "Benefício 3 · Emoji", type: "text" },
      { key: "home.porque.3.text", label: "Benefício 3 · Texto", type: "text" },
      { key: "home.porque.4.emoji", label: "Benefício 4 · Emoji", type: "text" },
      { key: "home.porque.4.text", label: "Benefício 4 · Texto", type: "text" },
    ],
  },
  {
    id: "depoimentos",
    label: 'Seção "Quem já trocou" (Depoimentos)',
    icon: "💬",
    description: "Os 3 depoimentos exibidos na Home.",
    fields: [
      { key: "home.depoimentos.title", label: "Título da seção", type: "text" },
      { key: "home.depoimentos.1.name", label: "Depoimento 1 · Nome", type: "text" },
      { key: "home.depoimentos.1.bairro", label: "Depoimento 1 · Bairro", type: "text" },
      { key: "home.depoimentos.1.text", label: "Depoimento 1 · Texto", type: "textarea" },
      { key: "home.depoimentos.1.stars", label: "Depoimento 1 · Estrelas (1-5)", type: "number" },
      { key: "home.depoimentos.2.name", label: "Depoimento 2 · Nome", type: "text" },
      { key: "home.depoimentos.2.bairro", label: "Depoimento 2 · Bairro", type: "text" },
      { key: "home.depoimentos.2.text", label: "Depoimento 2 · Texto", type: "textarea" },
      { key: "home.depoimentos.2.stars", label: "Depoimento 2 · Estrelas (1-5)", type: "number" },
      { key: "home.depoimentos.3.name", label: "Depoimento 3 · Nome", type: "text" },
      { key: "home.depoimentos.3.bairro", label: "Depoimento 3 · Bairro", type: "text" },
      { key: "home.depoimentos.3.text", label: "Depoimento 3 · Texto", type: "textarea" },
      { key: "home.depoimentos.3.stars", label: "Depoimento 3 · Estrelas (1-5)", type: "number" },
    ],
  },
  {
    id: "cta",
    label: "Chamada final (CTA)",
    icon: "🎉",
    description: "Card roxo final da Home com botão amarelo.",
    fields: [
      { key: "home.cta.title", label: "Título", type: "text" },
      { key: "home.cta.subtitle", label: "Subtítulo", type: "textarea" },
    ],
  },
];

/** Une defaults com overrides do banco (override vence se não-vazio) */
export function mergeSiteContent(overrides: Record<string, string>): Record<string, string> {
  const merged = { ...DEFAULT_SITE_CONTENT };
  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value === "string" && value.length > 0) merged[key] = value;
  }
  return merged;
}

/** Renderiza **negrito** em um texto simples (para o subtítulo da Hero) */
export function renderRichText(text: string): { bold: boolean; part: string }[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return { bold: true, part: part.slice(2, -2) };
    }
    return { bold: false, part };
  });
}
