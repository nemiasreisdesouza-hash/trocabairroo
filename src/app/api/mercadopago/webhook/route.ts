// ═══════════════════════════════════════════════════════════
// /api/mercadopago/webhook · notificações do Mercado Pago
//
// O MP avisa (notification_url). Esta rota NUNCA confia no corpo
// da notificação para ativar benefício: ela busca o pagamento na
// API oficial (GET /v1/payments/{id}) e age pelo status real.
//
//   approved                  → subscriptions.status='ativo',
//                               expires_at = now + prazo do plano,
//                               + benefícios (topo_feed/destaque/verificado)
//   rejected / cancelled      → status='cancelado' (só se ainda pendente)
//   demais (pending, etc.)    → nada (MP re-notifica quando concluir)
//
// IDEMPOTÊNCIA: a transição é um UPDATE condicional
//   UPDATE ... WHERE id = X AND status IN (pendente, cancelado, expirado)
// — notificações repetidas atualizam 0 linhas e saem como no-op.
//
// RESPOSTA: sempre 200 { ok: true } (evita retries infinitos do MP).
// ═══════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import {
  boostDurationDays,
  decideAction,
  extractPaymentId,
  fetchMercadoPagoPayment,
  getAdminSupabase,
} from "@/lib/mercadopago";
import { isValidUUID } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ok = () => NextResponse.json({ ok: true });

async function applyActivation(sub: {
  id: string;
  user_id: string;
  ad_id: string | null;
  plano: string;
}, admin: NonNullable<ReturnType<typeof getAdminSupabase>>) {
  const plano = String(sub.plano ?? "");
  const days = boostDurationDays(plano);
  const expiresAt = new Date(Date.now() + days * 864e5).toISOString();

  // Benefício de anúncio só para topo_feed/destaque (vinculados a ad_id)
  let adId: string | null = sub.ad_id ?? null;
  if (plano !== "topo_feed" && plano !== "destaque") adId = null;

  // Defesa em profundidade: o anúncio precisa pertencer ao assinante
  if (adId) {
    const { data: adRow, error: adErr } = await admin
      .from("ads")
      .select("id, user_id")
      .eq("id", adId)
      .maybeSingle();
    if (adErr || !adRow || adRow.user_id !== sub.user_id) {
      console.error(
        `[MP-WEBHOOK] ad_id não pertence ao assinante — boost ignorado (sub ${sub.id})`
      );
      adId = null;
    }
  }

  // ── 1) Ativa a subscription (UPDATE condicional = idempotência) ──
  const { data: updated, error: upErr } = await admin
    .from("subscriptions")
    .update({ status: "ativo", expires_at: expiresAt })
    .eq("id", sub.id)
    .in("status", ["pendente", "cancelado", "expirado"])
    .select("id");
  if (upErr) {
    console.error(`[MP-WEBHOOK] falha ao ativar subscription ${sub.id}: ${upErr.message}`);
    return;
  }
  if (!updated || updated.length === 0) {
    console.log(`[MP-WEBHOOK] subscription ${sub.id} já processada (idempotente) — no-op`);
    return;
  }

  // ── 2) Benefícios (espelha o branch supabase do activatePlan) ──
  if (adId) {
    if (plano === "topo_feed") {
      const { error } = await admin.from("ads").update({ topo_feed: true }).eq("id", adId);
      if (error) console.error(`[MP-WEBHOOK] topo_feed falhou: ${error.message}`);
    } else if (plano === "destaque") {
      const { error } = await admin.from("ads").update({ destaque: true }).eq("id", adId);
      if (error) console.error(`[MP-WEBHOOK] destaque falhou: ${error.message}`);
    }
  }
  if (plano === "verificado") {
    // Equivalente do RPC extend_verified_pass — mas service_role não tem
    // auth.uid(), então atualiza diretamente o perfil do assinante:
    // verified_until = greatest(verified_until, now()) + 30 dias (soma).
    try {
      const { data: prof } = await admin
        .from("profiles")
        .select("verified_until")
        .eq("id", sub.user_id)
        .maybeSingle();
      const base =
        prof?.verified_until != null
          ? Math.max(new Date(String(prof.verified_until)).getTime(), Date.now())
          : Date.now();
      const until = new Date(base + 30 * 864e5).toISOString();
      const { error: vErr } = await admin
        .from("profiles")
        .update({ verificado: true, verified_until: until })
        .eq("id", sub.user_id);
      if (vErr) console.error(`[MP-WEBHOOK] verificado falhou: ${vErr.message}`);
    } catch (e) {
      console.error("[MP-WEBHOOK] verificado (exceção):", e);
    }
  }

  console.log(
    `[MP-WEBHOOK] ✅ ativado sub ${sub.id} plano=${plano} user=${sub.user_id} até=${expiresAt}`
  );
}

async function handlePaymentNotification(paymentId: string): Promise<void> {
  if (!/^\d{1,20}$/.test(paymentId)) return;

  const admin = getAdminSupabase();
  if (!admin) {
    console.error("[MP-WEBHOOK] SUPABASE_SERVICE_ROLE_KEY ausente — não dá para processar");
    return;
  }

  // Status VERDADEIRO vem da API do MP (nunca do corpo da notificação)
  const payment: Record<string, any> | { error: string } = await fetchMercadoPagoPayment(paymentId);
  if ("error" in payment) {
    console.error(`[MP-WEBHOOK] falha ao consultar pagamento ${paymentId}: ${payment.error}`);
    return;
  }

  const extRef = payment?.external_reference;
  if (!extRef || !isValidUUID(String(extRef))) {
    console.error(`[MP-WEBHOOK] external_reference ausente/inválido (payment ${paymentId})`);
    return;
  }
  const subscriptionId = String(extRef);
  const paymentStatus = String(payment?.status ?? "").toLowerCase();

  const { data: sub, error: subErr } = await admin
    .from("subscriptions")
    .select("id, user_id, ad_id, plano, status")
    .eq("id", subscriptionId)
    .maybeSingle();
  if (subErr || !sub) {
    console.error(`[MP-WEBHOOK] subscription não encontrada: ${subscriptionId}`);
    return;
  }

  const action = decideAction(paymentStatus, String(sub.status));
  if (action === "noop") {
    console.log(
      `[MP-WEBHOOK] no-op (payment ${paymentStatus} x sub ${sub.status}) payment=${paymentId}`
    );
    return;
  }
  if (action === "cancel") {
    // fecha apenas se ainda pendente (a condição no WHERE é idempotente)
    const { error: cErr } = await admin
      .from("subscriptions")
      .update({ status: "cancelado" })
      .eq("id", subscriptionId)
      .eq("status", "pendente");
    if (cErr) console.error(`[MP-WEBHOOK] falha ao cancelar sub: ${cErr.message}`);
    else
      console.log(
        `[MP-WEBHOOK] pagamento ${paymentStatus} → sub ${subscriptionId} marcada cancelada`
      );
    return;
  }

  // action === "activate"
  await applyActivation(sub as { id: string; user_id: string; ad_id: string | null; plano: string }, admin);
}

/** POST — notificações da API v2 do MP (JSON { data: { id, type } }). */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const paymentId = extractPaymentId(body, req.nextUrl.searchParams);
    if (!paymentId) {
      console.log("[MP-WEBHOOK] notificação sem paymentId — ignorada");
      return ok();
    }
    await handlePaymentNotification(paymentId);
    return ok();
  } catch (e) {
    console.error("[MP-WEBHOOK] erro inesperado:", e);
    return ok();
  }
}

/** GET — formato legado do notification_url (?data.id=...&data.type=payment). */
export async function GET(req: NextRequest) {
  try {
    const paymentId = extractPaymentId(null, req.nextUrl.searchParams);
    if (!paymentId) return ok();
    await handlePaymentNotification(paymentId);
    return ok();
  } catch (e) {
    console.error("[MP-WEBHOOK] erro inesperado:", e);
    return ok();
  }
}
