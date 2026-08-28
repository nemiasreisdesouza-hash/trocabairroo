// ═══════════════════════════════════════════════════════════
// Tipos compartilhados do TrocaES (Supabase + Modo Demo)
// ═══════════════════════════════════════════════════════════

export type TipoPerfil = "empreendedor" | "criador" | "ambos";
export type TradeStatus =
  | "pending"
  | "accepted"
  | "in_progress"
  | "completed"
  | "awaiting_reviews"
  | "finished"
  | "cancelled"
  | "rejected";

export const TRADE_FLOW: TradeStatus[] = [
  "pending",
  "accepted",
  "in_progress",
  "completed",
  "awaiting_reviews",
  "finished",
];

export const TRADE_STATUS_LABEL: Record<TradeStatus, string> = {
  pending: "Aguardando aceite",
  accepted: "Aceita",
  in_progress: "Em andamento",
  completed: "Concluída (1/2)",
  awaiting_reviews: "Aguardando avaliação",
  finished: "Finalizada",
  cancelled: "Cancelada",
  rejected: "Rejeitada",
};

export type AuthUser = {
  id: string;
  nome: string;
  email: string;
  whatsapp: string | null;
  cpf: string | null;
  avatarUrl: string | null;
  avatarPath?: string | null; // [FASE 1] Path interno do avatar no Storage para limpeza automática
  bio?: string | null;
  uf: string;
  cidade: string;
  bairro: string | null;
  tipoPerfil: string;
  categorias: string[];
  mediaAvaliacao: number;
  aprovacao: number;
  totalAvaliacoes: number;
  trocasConcluidas: number;
  verificado: boolean;
  verificadoManual?: boolean;
  /** 🎫 Passe pré-pago do selo (30 dias) — null = sem data */
  verifiedUntil?: string | null;
  /** Slim Partner — checkmark dourado único */
  isPartner?: boolean;
  coverUrl?: string | null;
  coverPath?: string | null;
  role: string;
  ativo: boolean;
  createdAt: string;
};

export type AdBase = {
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
  // [P0-B] Novos campos explícitos para boost (paridade demo↔prod)
  isFeatured?: boolean;
  featuredUntil?: string | null;
  boostType?: 'top_feed' | 'selo_destaque' | null;
  isTopFeed?: boolean;
  topFeedUntil?: string | null;
  isUrgent?: boolean;
  status: string;
  visualizacoes: number;
  createdAt: string;
};

export type AdCardData = AdBase & {
  images: string[];
  userName: string;
  userAvatar: string | null;
  userVerificado: boolean;
  userIsPartner?: boolean;
  userMediaAvaliacao: number;
  userTrocasConcluidas: number;
  userAprovacao?: number;
};

export type AdDetail = AdCardData & {
  userWhatsapp: string | null;
  userBio: string | null;
  userBairro: string | null;
  userTipoPerfil: string;
  userCoverUrl?: string | null;
  reviews: ReviewWithReviewer[];
  tradeCount: number;
};

export type Trade = {
  id: string;
  adId: string;
  adTitulo: string;
  adTipo: string;
  requesterId: string;
  ownerId: string;
  status: TradeStatus;
  requesterCompleted: boolean;
  ownerCompleted: boolean;
  requesterReviewed: boolean;
  ownerReviewed: boolean;
  /** 🛡️ Duplo Escudo: none | requested | approved | rejected */
  whatsappShareStatus: string;
  whatsappRequestedBy: string | null;
  createdAt: string;
  updatedAt: string;
  // Dados da outra parte (contra-parte da troca)
  otherId: string;
  otherNome: string;
  otherAvatar: string | null;
  otherWhatsapp: string | null;
};

export type ReviewWithReviewer = {
  id: string;
  nota: number;
  comentario: string | null;
  cumprimento: string;
  createdAt: string;
  avaliadorId: string;
  avaliadorNome: string;
  avaliadorAvatar: string | null;
};

export type AdminStats = {
  users: number;
  ads: number;
  trades: number;
  reviews: number;
  subscriptions: number;
  awaitingReviews: number;
  pendingTrades: number;
};

export type Subscription = {
  id: string;
  userId: string;
  userName?: string;
  plano: string;
  valor: number;
  status: string;
  adId: string | null;
  expiresAt: string | null;
  createdAt: string;
};
