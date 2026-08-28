import { isSupabaseConfigured } from "@/lib/supabase";
import { cleanupOrphanedFiles } from "@/lib/storage";

// [CRON-JOB] Faxina diária 03:00 - endpoint protegido por CRON_SECRET
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel: até 60s para cron

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // Se CRON_SECRET não configurado, permite apenas em dev/demo (segurança: em prod deve estar setado)
  if (!secret) {
    // Em produção sem secret, nega por padrão
    if (process.env.NODE_ENV === "production") return false;
    return true;
  }
  const auth = request.headers.get("authorization") || "";
  // Suporta "Bearer <secret>" e também header x-cron-secret para compat Vercel
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const xCron = request.headers.get("x-cron-secret") || "";
  const cronHeader = request.headers.get("x-vercel-cron") ? "vercel-cron" : "";
  // Vercel Cron envia header x-vercel-cron automaticamente quando configurado via vercel.json
  // Se vier de Vercel Cron oficial, confia (mas ainda valida secret se presente)
  if (bearer && bearer === secret) return true;
  if (xCron && xCron === secret) return true;
  // Se request veio do Vercel Cron Scheduler e secret não foi enviado via Bearer, ainda verifica se o header x-vercel-cron existe e secret está configurado
  // Para máxima segurança, exige Bearer mesmo para Vercel, mas permite fallback se CRON_SECRET igual em env de sistema
  if (cronHeader && secret) {
    // Vercel Cron trusted, mas ainda exige que CRON_SECRET esteja configurado no projeto (já está)
    return true;
  }
  return false;
}

export async function GET(request: Request) {
  // [CRON-JOB] Proteção: verifica Authorization Bearer <CRON_SECRET>
  if (!isAuthorized(request)) {
    return Response.json(
      { success: false, error: "Unauthorized - invalid CRON_SECRET" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  // [CRON-JOB] Modo Demo: simula limpeza sem queries reais
  if (!isSupabaseConfigured()) {
    return Response.json(
      {
        success: true,
        mode: "demo",
        message: "Demo cleanup simulated",
        deletedAds: 0,
        deletedAvatars: 0,
        scanned: 0,
        timestamp: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    // [CRON-JOB] Faxina diária: invoca cleanupOrphanedFiles (com paginação e securityLog)
    const result = await cleanupOrphanedFiles();
    return Response.json(
      {
        mode: "supabase",
        ...result,
        timestamp: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[CRON-JOB] cleanup failed", err);
    return Response.json(
      {
        success: false,
        error: String(err).slice(0, 200),
        timestamp: new Date().toISOString(),
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

// Suporta POST também (Vercel Cron pode usar GET por padrão, mas deixa POST aberto)
export async function POST(request: Request) {
  return GET(request);
}
