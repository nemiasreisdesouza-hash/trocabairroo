// [CONTENT] Central de Ajuda TrocaES - conteúdo estático + dinâmico (equipe) sem XSS
export type HelpTopicId =
  | "como_publicar"
  | "planos"
  | "impulsionar"
  | "selo_verificado"
  | "selo_dourado"
  | "whatsapp";

export type HelpTopic = {
  id: HelpTopicId;
  icon: string;
  label: string;
  title: string;
  steps: string[];
  ctaLabel?: string;
  ctaHref?: string;
  extra?: string;
};

export type HelpTeamMember = {
  id: 'admin' | 'founder';
  displayName: string;
  roleTitle: string;
  message: string;
  avatarUrl: string | null;
  avatarPath?: string | null;
  namePosition?: 'above_role' | 'below_role';
  accent?: 'violet' | 'amber';
  updatedAt?: string;
};

export const HELP_WELCOME_ADMIN = {
  author: "Admin TrocaES 🛡️",
  avatar: "🛡️",
  role: "official",
  message: `Olá! 👋 Seja muito bem-vindo(a) ao TrocaES!

Aqui você troca serviços e produtos com vizinhos do seu bairro de forma segura, prática e sem usar dinheiro.

Escolha uma opção abaixo para tirar suas dúvidas 👇`,
};

export const HELP_WELCOME_FOUNDER = {
  author: "Fundadora 💜",
  avatar: "💜",
  role: "founder",
  message: `Oi, tudo bem? 💜

Sou a idealizadora do TrocaES. Criei essa plataforma pensando em fortalecer a comunidade e ajudar cada vizinho a prosperar através de trocas justas.

Qualquer dúvida, estou por aqui! Vamos juntos transformar nosso bairro. 🏘️✨`,
};

export function getDefaultHelpTeam(): HelpTeamMember[] {
  return [
    {
      id: 'admin',
      displayName: '',
      roleTitle: 'Admin TrocaES 🛡️',
      message: HELP_WELCOME_ADMIN.message,
      avatarUrl: null,
      avatarPath: null,
      namePosition: 'below_role',
      accent: 'violet',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'founder',
      displayName: '',
      roleTitle: 'Fundadora 💜',
      message: HELP_WELCOME_FOUNDER.message,
      avatarUrl: null,
      avatarPath: null,
      namePosition: 'below_role',
      accent: 'amber',
      updatedAt: new Date().toISOString(),
    },
  ];
}

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: "como_publicar",
    icon: "📝",
    label: "Como publicar um anúncio",
    title: "Como publicar um anúncio",
    steps: [
      "Clique no botão roxo + Publicar no menu inferior (ou no topo).",
      "Escolha entre OFEREÇO (algo que você faz/tem) ou PRECISO (algo que busca).",
      "Adicione fotos do serviço/produto (recomendado! Anúncios com foto têm 3x mais interesse).",
      "Escreva um título claro e descrição objetiva.",
      "Escolha uma categoria e defina o que aceita em troca.",
      "Clique em Publicar e pronto! 🎉",
    ],
    ctaLabel: "Publicar anúncio agora →",
    ctaHref: "/anuncio/criar",
  },
  {
    id: "planos",
    icon: "💰",
    label: "Planos de assinatura",
    title: "Planos de assinatura (Conexão / Expansão)",
    steps: [
      "Experimente (grátis) — o padrão de todos. Anúncios ilimitados e contato via WhatsApp.",
      "Conexão — R$ 49,90/mês — 1 Topo do Feed + Selo Destaque + Estatísticas + Suporte prioritário.",
      "Expansão — R$ 89,90/mês — Selo Verificado incluso + 3 impulsionamentos + Divulgação nas redes do TrocaES + Destaque em toda cidade.",
      "Você pode começar grátis e fazer upgrade quando quiser em Planos.",
    ],
    ctaLabel: "Ver planos completos →",
    ctaHref: "/planos",
  },
  {
    id: "impulsionar",
    icon: "🚀",
    label: "Como impulsionar meu anúncio",
    title: "Como impulsionar meu anúncio",
    steps: [
      "Você tem 2 formas rápidas pagas por uso:",
      "Topo do Feed — R$ 3,00 (7 dias): seu anúncio no topo da Home e feed.",
      "Selo Destaque — R$ 5,00 (30 dias): aparece na aba 'Em Destaque' com badge dourado ⭐.",
      "Vá em Perfil → Impulsionar anúncio e escolha o anúncio ativo.",
      "Ou marque a opção 'Quer mais visibilidade?' ao criar o anúncio — aplica no mesmo anúncio na hora.",
    ],
    ctaLabel: "Impulsionar agora →",
    ctaHref: "/impulsionar",
  },
  {
    id: "selo_verificado",
    icon: "✅",
    label: "Selo Verificado Azul (R$ 29,90)",
    title: "Como ativar o Selo Verificado Azul",
    steps: [
      "O Selo Verificado Azul mostra que você é um usuário confiável e sério!",
      "Custa R$ 29,90 por 30 dias (passe pré-pago).",
      "Seu perfil ganha selo azul ✔️ ao lado do nome (igual Instagram) e destaque na vitrine de verificados.",
      "Ative em: Perfil → Ativar Selo Verificado (ou botão amarelo na Home).",
      "Ideal para quem quer profissionalizar e passar mais confiança nas trocas.",
    ],
    ctaLabel: "Ativar meu selo →",
    ctaHref: "/planos",
  },
  {
    id: "selo_dourado",
    icon: "🟡",
    label: "O que é o Selo Dourado (Parceiro)",
    title: "Selo Dourado (Parceiro Oficial)",
    steps: [
      "O Selo Dourado é EXCLUSIVO para nossos Parceiros Oficiais! 🌟",
      "Não é comprado. É concedido pela equipe TrocaES.",
      "Destinado a influenciadores, empresas parceiras e figuras que contribuem para o crescimento da plataforma.",
      "Parceiros têm: trocas ILIMITADAS ♾️, foto de capa personalizada e prioridade nas buscas.",
      "Quer se tornar Parceiro? Entre em contato pelo WhatsApp da fundadora!",
    ],
    extra: "💜 Fale com a fundadora para avaliação de parceria.",
  },
  {
    id: "whatsapp",
    icon: "💬",
    label: "Falar com atendente (WhatsApp)",
    title: "Falar com um atendente humano",
    steps: [
      "Nossa equipe está pronta para te ajudar!",
      "Clique abaixo para abrir uma conversa direta no WhatsApp da equipe TrocaES.",
      "Atendimento em horário comercial, mas pode mandar mensagem a qualquer hora.",
    ],
    ctaLabel: "Abrir WhatsApp →",
    ctaHref: "",
  },
];

export function getHelpTopic(id: HelpTopicId): HelpTopic | undefined {
  return HELP_TOPICS.find((t) => t.id === id);
}

export function getSupportWhatsappLink(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || "";
  const cleaned = raw.replace(/\D/g, "");
  if (!cleaned) return null;
  return `https://wa.me/${cleaned}`;
}

// Wrapper que tenta ler do backend (demo-store / site_content) com fallback defaults
export async function getHelpTeam(): Promise<HelpTeamMember[]> {
  try {
    const backend = await import('./backend');
    if (backend.getHelpTeam) {
      return await backend.getHelpTeam();
    }
  } catch {}
  return getDefaultHelpTeam();
}
