// ═══════════════════════════════════════════════════════════
// Tipos compartilhados do TrocaBairro (Supabase + Modo Demo)
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
  status: string;
  visualizacoes: number;
  createdAt: string;
};

export type AdCardData = AdBase & {
  images: string[];
  userName: string;
  userAvatar: string | null;
  userVerificado: boolean;
  userMediaAvaliacao: number;
  userTrocasConcluidas: number;
  userAprovacao?: number;
};

export type AdDetail = AdCardData & {
  userWhatsapp: string | null;
  userBio: string | null;
  userBairro: string | null;
  userTipoPerfil: string;
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
