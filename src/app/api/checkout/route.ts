// ═══════════════════════════════════════════════════════════
// POST /api/checkout · cria o Checkout Pro do Mercado Pago
//
// Body: { plano, valor, titulo?, adId? }
// Auth: Authorization: Bearer <access_token do Supabase>
//
// 1) cria subscriptions.status='pendente' (service role)
// 2) cria a preferência no MP (external_reference = id da sub)
// 3) devolve { ok, init_point, sandbox_init_point? }
//
// Se o pagamento real ainda não estiver configurado
// (sem MERCADOPAGO_ACCESS_TOKEN), responde 503 code=MP_NOT_CONFIGURED
// e o front faz o fallback de simulação local (dev/demo).
// ═══════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import {
  createMercadoPagoPreference,
  canonicalPrice,
  buildBackUrls,
  defaultTitulo,
  getAdminSupabase,
  getCheckoutUser,
  isPayablePlan,
} from "@/lib/mercadopago";
import { isValidUUID } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** APP_URL se configurado; senão monta a base a partir da própria request. */
function requestBaseUrl(req: NextRequest): string {
  const env = process.env.APP_URL;
  if (env && env.trim().length > 10) return env.trim().replace(/\/+$/, "");
  const host = req.headers.get("host") || "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") || "http";
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  try {
    const admin = getAdminSupabase();
    if (!admin) {
      return NextResponse.json(
        {
          ok: false,
          code: "SUPABASE_NOT_CONFIGURED",
          error: "Supabase não configurado no servidor",
        },
        { status: 503 }
      );
    }

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
    }

    // ── 1) Validação do plano (whitelist server-side) ──
    const plano = typeof body.plano === "string" ? body.plano.trim().toLowerCase() : "";
    if (!isPayablePlan(plano)) {
      return NextResponse.json({ ok: false, error: "Plano inválido" }, { status: 400 });
    }

    // ── 2) Preço CANÔNICO (o client não define o valor cobrado) ──
    const rawValor =
      typeof body.valor === "number"
        ? body.valor
        : typeof body.valor === "string" && body.valor.trim() !== ""
          ? Number.parseFloat(body.valor)
          : undefined;
    const price = canonicalPrice(plano, rawValor);
    if (!price) {
      return NextResponse.json({ ok: false, error: "Valor inválido" }, { status: 400 });
    }

    // ── 3) adId (obrigatório p/ topo_feed e destaque; opcional demais) ──
    let adId: string | null = null;
    if (body.adId != null && body.adId !== "") {
      if (typeof body.adId !== "string" || !isValidUUID(body.adId)) {
        return NextResponse.json({ ok: false, error: "adId inválido" }, { status: 400 });
      }
      adId = body.adId;
    }
    const needAd = plano === "topo_feed" || plano === "destaque";
    if (needAd && !adId) {
      return NextResponse.json(
        { ok: false, error: "Selecione um anúncio para este impulsionamento" },
        { status: 400 }
      );
    }

    // ── 4) Identifica o usuário logado (Bearer token validado pelo Supabase) ──
    const user = await getCheckoutUser(req.headers.get("authorization"));
    if (!user) {
      return NextResponse.json(
        { ok: false, code: "UNAUTHORIZED", error: "Faça login para continuar" },
        { status: 401 }
      );
    }

    // ── 5) Ownership do anúncio (impulsionamentos só no próprio anúncio) ──
    if (adId) {
      const { data: adRow, error: adErr } = await admin
        .from("ads")
        .select("id, user_id, status")
        .eq("id", adId)
        .maybeSingle();
      if (adErr || !adRow) {
        return NextResponse.json({ ok: false, error: "Anúncio não encontrado" }, { status: 404 });
      }
      if (adRow.user_id !== user.id) {
        return NextResponse.json({ ok: false, error: "Este anúncio não é seu" }, { status: 403 });
      }
      if (adRow.status !== "ativo") {
        return NextResponse.json(
          { ok: false, error: "Anúncio não está ativo" },
          { status: 400 }
        );
      }
    }

    // ── 6) Checkout Pro do Mercado Pago ──
    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      return NextResponse.json(
        {
          ok: false,
          code: "MP_NOT_CONFIGURED",
          error: "Pagamento real ainda não configurado",
        },
        { status: 503 }
      );
    }

    const titulo =
      typeof body.titulo === "string" && body.titulo.trim()
        ? body.titulo.trim().slice(0, 250)
        : defaultTitulo(plano);

    // ── 7) Pedido pendente no banco (service role) ──
    const { data: sub, error: subErr } = await admin
      .from("subscriptions")
      .insert({
        user_id: user.id,
        ad_id: adId,
        plano,
        valor: price,
        status: "pendente",
        expires_at: null,
      })
      .select("id")
      .single();
    if (subErr || !sub?.id) {
      return NextResponse.json(
        { ok: false, error: "Falha ao criar o pedido: " + (subErr?.message ?? "erro interno") },
        { status: 500 }
      );
    }
    const subscriptionId = String(sub.id);

    // ── 8) Preferência no Mercado Pago ──
    const base = requestBaseUrl(req);
    const backPath = needAd ? "/impulsionar" : "/planos";
    const pref = await createMercadoPagoPreference({
      subscriptionId,
      titulo,
      price,
      backUrls: buildBackUrls(base, backPath, subscriptionId),
      notificationUrl: `${base}/api/mercadopago/webhook`,
    });

    if ("error" in pref) {
      // Limpa o pedido pendente (preferência não foi criada → não há como pagar)
      try {
        await admin.from("subscriptions").delete().eq("id", subscriptionId);
      } catch {
        /* best-effort */
      }
      const code = pref.error === "MP_NOT_CONFIGURED" ? "MP_NOT_CONFIGURED" : "MP_CHECKOUT_ERROR";
      console.error(`[CHECKOUT] falha ao criar preferência (${subscriptionId}): ${pref.error}`);
      return NextResponse.json(
        {
          ok: false,
          code,
          error:
            code === "MP_CHECKOUT_ERROR"
              ? "Não foi possível criar o pagamento. Tente novamente em instantes."
              : "Pagamento real ainda não configurado",
        },
        { status: 502 }
      );
    }

    console.log(
      `[CHECKOUT] preferência criada (${subscriptionId}) plano=${plano} valor=${price}`
    );
    return NextResponse.json({
      ok: true,
      init_point: pref.initPoint,
      sandbox_init_point: pref.sandboxInitPoint,
    });
  } catch (e) {
    console.error("[CHECKOUT] erro inesperado:", e);
    return NextResponse.json(
      { ok: false, error: "Erro interno ao criar o checkout" },
      { status: 500 }
    );
  }
}
