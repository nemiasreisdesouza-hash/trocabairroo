import { isSupabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    service: "trocabairro",
    mode: isSupabaseConfigured() ? "supabase" : "demo (localStorage)",
  });
}
