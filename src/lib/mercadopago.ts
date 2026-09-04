// ═══════════════════════════════════════════════════════════
// MERCADO PAGO · Checkout Pro (PIX / cartão) — SOMENTE SERVIDOR
//
// Fluxo:
//   1) POST /api/checkout  → cria subscriptions.status='pendente'
//      + preferência no MP (external_reference = id da subscription)
//      → devolve init_point (front redireciona o navegador).
//   2) MP notifica /api/mercadopago/webhook → webhook consulta o
//      pagamento na API do MP e, se approved, ativa a subscription
//      (status='ativo', expires_at) + aplica os benefícios.
//
// Segurança:
//   • SUPABASE_SERVICE_ROLE_KEY NUNCA vai para o client (este módulo
//     só é importado por API routes — runtime nodejs);
//   • o usuário é identificado no checkout via Bearer access_token
//     validado pelo Supabase Auth (auth.getUser);
//   • o valor cobrado é sempre o CANÔNICO do plano (server-side);
//     o valor vindo do client só é usado como fallback para planos
//     desconhecidos (e ainda assim limitado a 0,10–10.000,00);
//   • webhook é IDEMPOTENTE: a transição de status é um UPDATE
//     condicional (WHERE status in pendente/cancelado/expirado) —
//     notificações repetidas não duplicam benefício.
// ═══════════════════════════════════════════════════════════
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { IMPULSIONAMENTOS, PLANOS_ASSINATURA } from "./constants";

const MP_API = "https://api.mercadopago.com";

// ─────────────────────────────────────────────
// FUNÇÕES PURAS (testáveis no harness, sem rede/DB)
// ─────────────────────────────────────────────

/** Planos que passam por pagamento real. "experimente" é grátis. */
export const PAYABLE_PLANS = [
  "conexao",
  "expansao",
  "topo_feed",
  "destaque",
  "verificado",
] as const;

export type PayablePlan = (typeof PAYABLE_PLANS)[number];

export function isPayablePlan(plano: string): plano is PayablePlan {
  return (PAYABLE_PLANS as readonly string[]).includes(plano);
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Preço CANÔNICO do plano (fonte da verdade: constants.ts).
 * O valor informado pelo client só é aceito como fallback para
 * planos fora da tabela (sempre limitado a 0,10–10.000,00).
 * Retorna null quando não há preço válido.
 */
export function canonicalPrice(plano: string, clientValue?: number): number | null {
  if (isPayablePlan(plano)) {
    const boost = IMPULSIONAMENTOS.find((p) => p.id === plano);
    if (boost) return round2(boost.valor);
    const sub = PLANOS_ASSINATURA.find((p) => p.id === plano);
    if (sub) return round2(sub.preco);
  }
  if (typeof clientValue === "number" && Number.isFinite(clientValue)) {
    const v = round2(clientValue);
    if (v >= 0.1 && v <= 10000) return v;
  }
  return null;
}

/** Duração (dias) do benefício — mesmo prazo que o app já usa em activatePlan. */
export function boostDurationDays(plano: string): number {
  if (plano === "topo_feed" || plano === "destaque" || plano === "verificado") {
    const b = IMPULSIONAMENTOS.find((p) => p.id === plano);
    return b ? b.duracaoDias : 30;
  }
  // Planos mensais (conexao/expansao) e qualquer outro → 30 dias
  return 30;
}

/** Título padrão exibido no checkout do Mercado Pago. */
export function defaultTitulo(plano: string): string {
  switch (plano) {
    case "conexao":
      return "TrocaES · Plano Conexão (mensal)";
    case "expansao":
      return "TrocaES · Plano Expansão (mensal)";
    case "topo_feed":
      return "TrocaES · Topo do Feed (7 dias)";
    case "destaque":
      return "TrocaES · Selo Destaque (30 dias)";
    case "verificado":
      return "TrocaES · Profissional Verificado (30 dias)";
    default:
      return "TrocaES";
  }
}

/**
 * Extrai o id do pagamento de uma notificação do MP.
 * Suporta:
 *   • POST JSON (API v2):  { data: { id, type } }  ou  { data: "123" }
 *   • GET legado (notification_url): ?data.id=123&data.type=payment
 */
export function extractPaymentId(body: unknown, searchParams?: URLSearchParams): string | null {
  if (body && typeof body === "object") {
    const data = (body as { data?: unknown }).data;
    if (typeof data === "string" && data.trim()) return data.trim().slice(0, 40);
    if (data && typeof data === "object") {
      const d = data as { id?: unknown; type?: unknown };
      if (typeof d.id === "string" && d.id.trim()) return d.id.trim().slice(0, 40);
      if (typeof d.id === "number" && Number.isFinite(d.id)) return String(d.id);
    }
  }
  if (searchParams) {
    const id =
      searchParams.get("data.id") ?? searchParams.get("data_id") ?? searchParams.get("payment_id");
    if (id && /^\d{1,20}$/.test(id)) return id;
  }
  return null;
}

/**
 * Máquina de estados do webhook (IDEMPOTENTE):
 *   approved  → "activate" (a menos que a sub já esteja "ativo" → noop)
 *   rejected/cancelled/failed → "cancel" (apenas se ainda "pendente";
 *              sub já ativa NUNCA é revertida — o benefício foi entregue)
 *   demais (pending/processing/authorized/refunded…) → "noop"
 */
export type WebhookAction = "activate" | "cancel" | "noop";

export function decideAction(paymentStatus: string, subStatus: string): WebhookAction {
  const s = String(paymentStatus ?? "").toLowerCase();
  const st = String(subStatus ?? "").toLowerCase();
  if (s === "approved") return st === "ativo" ? "noop" : "activate";
  if (["rejected", "cancelled", "failed"].includes(s)) return st === "pendente" ? "cancel" : "noop";
  return "noop";
}

/** back_urls do checkout (o app lê ?checkout=sucesso|pendente|erro). */
export function buildBackUrls(
  baseUrl: string,
  path: string,
  subscriptionId: string
): { success: string; pending: string; failure: string } {
  const base = String(baseUrl || "").replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  const mk = (checkout: string) =>
    `${base}${p}?checkout=${checkout}&sub=${encodeURIComponent(subscriptionId)}`;
  return { success: mk("sucesso"), pending: mk("pendente"), failure: mk("erro") };
}

// ─────────────────────────────────────────────
// CLIENTES SUPABASE (somente servidor)
// ─────────────────────────────────────────────

/** Config base do Supabase (URL + anon) — lê as mesmas vars do lib/supabase.ts. */
export function getSupabaseBaseConfig(): { url: string; anonKey: string } | null {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_PROJECT_URL || "";
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY || "";
  if (url.length < 10 || anonKey.length < 20) return null;
  return { url, anonKey };
}

let adminClient: SupabaseClient | null = null;

/**
 * Cliente SERVICE ROLE (webhook/checkout). NUNCA exposto ao client.
 * Retorna null quando a chave não está configurada (as rotas tratam).
 */
export function getAdminSupabase(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const cfg = getSupabaseBaseConfig();
  if (!cfg || !key || key.length < 20) return null;
  if (!adminClient) {
    adminClient = createClient(cfg.url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

/**
 * Valida o access_token (Bearer) enviado pelo front e devolve o usuário.
 * O JWT é validado pelo próprio Supabase (auth.getUser).
 */
export async function getCheckoutUser(
  authorizationHeader: string | null
): Promise<{ id: string; email: string } | null> {
  const cfg = getSupabaseBaseConfig();
  if (!cfg) return null;
  const raw = String(authorizationHeader || "");
  const token = raw.startsWith("Bearer ") ? raw.slice(7).trim() : raw.trim();
  if (!token || token.length < 20) return null;
  try {
    const sb = createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await sb.auth.getUser();
    if (error || !data?.user) return null;
    return { id: data.user.id, email: (data.user.email as string | undefined) ?? "" };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// API DO MERCADO PAGO
// ─────────────────────────────────────────────

export type MpPreferenceInput = {
  subscriptionId: string;
  titulo: string;
  price: number;
  backUrls: { success: string; pending: string; failure: string };
  notificationUrl: string;
};

export type MpPreferenceResult =
  | { initPoint: string; sandboxInitPoint?: string }
  | { error: string };

/** Cria a preferência do Checkout Pro. `error` é string amigável p/ log/resposta. */
export async function createMercadoPagoPreference(
  input: MpPreferenceInput
): Promise<MpPreferenceResult> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) return { error: "MP_NOT_CONFIGURED" };

  const body = {
    items: [
      {
        title: input.titulo.slice(0, 250),
        quantity: 1,
        currency_id: "BRL",
        unit_price: input.price,
      },
    ],
    // ⚓ external_reference = id da subscription (o webhook usa para ativar)
    external_reference: input.subscriptionId,
    notification_url: input.notificationUrl,
    back_urls: input.backUrls,
    statement_descriptor: "TROCAES",
    auto_return: "all",
  };

  try {
    const res = await fetch(`${MP_API}/checkout/preferences`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const msg =
        (json.message as string | undefined) ||
        (json.error as string | undefined) ||
        `erro ${res.status}`;
      return { error: `MP_ERROR: ${msg}` };
    }
    const initPoint = json.init_point as string | undefined;
    if (!initPoint) return { error: "MP_ERROR: init_point ausente na resposta" };
    const sandbox = (json.sandbox_init_point as string | undefined) || undefined;
    return { initPoint, sandboxInitPoint: sandbox };
  } catch (e) {
    return { error: `MP_NETWORK: ${e instanceof Error ? e.message : "falha de rede"}` };
  }
}

/** Busca os detalhes do pagamento (o webhook confia na API, não no corpo da notificação). */
export async function fetchMercadoPagoPayment(
  paymentId: string
): Promise<Record<string, any> | { error: string }> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) return { error: "MP_NOT_CONFIGURED" };
  try {
    const res = await fetch(`${MP_API}/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, any>;
    if (!res.ok) {
      const msg = (json.message as string | undefined) || `erro ${res.status}`;
      return { error: `MP_ERROR: ${msg}` };
    }
    return json;
  } catch (e) {
    return { error: `MP_NETWORK: ${e instanceof Error ? e.message : "falha de rede"}` };
  }
}
