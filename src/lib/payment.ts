// ═══════════════════════════════════════════════════════════
// PAYMENT · helper do CLIENTE para iniciar o pagamento real
//
// Uso (páginas /planos e /impulsionar):
//   const r = await startCheckout({ plano, valor, titulo, adId, userId });
//   if (r.simulated) { /* ativação local (dev/demo) */ }
//   else window.location.href = r.initPoint;
//
// Regras:
//   • Modo demo (sem Supabase) → simulação local (experiência atual);
//   • MERCADOPAGO_ACCESS_TOKEN ainda não configurado (503
//     MP_NOT_CONFIGURED) → simulação local (fallback dev) — o site
//     continua funcionando até o pagamento real ser habilitado;
//   • Caso contrário → devolve o link de checkout (sandbox_init_point
//     quando existir — token de teste — senão init_point de produção).
// ═══════════════════════════════════════════════════════════
import { getSupabase, isSupabaseConfigured } from "./supabase";
import * as backend from "./backend";

export type CheckoutResult = {
  simulated: boolean;
  initPoint?: string;
  error?: string;
};

export async function startCheckout(params: {
  plano: string;
  valor: number;
  titulo: string;
  adId?: string | null;
  userId: string;
}): Promise<CheckoutResult> {
  // ── Modo demo (sem Supabase): mantém a simulação local ──
  const sb = isSupabaseConfigured() ? getSupabase() : null;
  if (!sb) {
    await backend.activatePlan(params.userId, params.plano, params.adId ?? null);
    return { simulated: true };
  }

  const { data } = await sb.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("Faça login para continuar");

  let res: Response;
  try {
    res = await fetch("/api/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        plano: params.plano,
        valor: params.valor,
        titulo: params.titulo,
        adId: params.adId ?? null,
      }),
    });
  } catch {
    throw new Error("Não foi possível conectar ao pagamento. Verifique sua internet e tente de novo.");
  }

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  // ── Pagamento real ainda não configurado → fallback de simulação ──
  if (res.status === 503 && json?.code === "MP_NOT_CONFIGURED") {
    await backend.activatePlan(params.userId, params.plano, params.adId ?? null);
    return { simulated: true };
  }

  if (!res.ok || json?.ok !== true) {
    throw new Error(
      (json?.error as string | undefined) || "Não foi possível iniciar o pagamento. Tente novamente."
    );
  }

  // sandbox_init_point existe quando o token do MP é de TESTE;
  // init_point é o link de produção.
  const initPoint =
    (json.sandbox_init_point as string | undefined) || (json.init_point as string | undefined);
  if (!initPoint) {
    throw new Error("Não foi possível obter o link de pagamento. Tente novamente.");
  }
  return { simulated: false, initPoint };
}
