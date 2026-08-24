// ═══════════════════════════════════════════════════════════
// INTERRUPTOR INTELIGENTE · Cliente Supabase
//
// Se NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY
// estiverem definidos no .env.local → app roda nativo no Supabase.
// Se estiverem vazios/ausentes → app roda em MODO DEMO (localStorage).
// ═══════════════════════════════════════════════════════════
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_PROJECT_URL ||
  "";

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_KEY ||
  "";

/**
 * Retorna true apenas quando as DUAS chaves estão presentes
 * (sem placeholder "your-..." — o .env.example usa placeholders).
 */
export function isSupabaseConfigured(): boolean {
  return (
    SUPABASE_URL.length > 10 &&
    SUPABASE_ANON_KEY.length > 20 &&
    !SUPABASE_URL.includes("your-") &&
    !SUPABASE_ANON_KEY.includes("your-")
  );
}

let client: SupabaseClient | null = null;

/** Cliente único do Supabase (browser). Retorna null em Modo Demo. */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: "trocabairro:auth",
      },
    });
  }
  return client;
}

/** Modo atual da aplicação (para exibir avisos de demo, etc.) */
export function appMode(): "supabase" | "demo" {
  return isSupabaseConfigured() ? "supabase" : "demo";
}
