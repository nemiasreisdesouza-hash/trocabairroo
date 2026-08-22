import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ads, users, notifications } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const body = await request.json();
    const { status, destaque, topoFeed } = body;

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (typeof destaque === "boolean") updateData.destaque = destaque;
    if (typeof topoFeed === "boolean") updateData.topoFeed = topoFeed;

    const [updated] = await db
      .update(ads)
      .set(updateData)
      .where(eq(ads.id, id))
      .returning();

    // Notify user if ad was approved or rejected
    if (status === "aprovado" || status === "rejeitado") {
      const adInfo = await db
        .select({ userId: ads.userId, titulo: ads.titulo })
        .from(ads)
        .where(eq(ads.id, id))
        .limit(1);

      if (adInfo.length) {
        await db.insert(notifications).values({
          userId: adInfo[0].userId,
          titulo:
            status === "aprovado"
              ? "Anúncio aprovado! ✅"
              : "Anúncio rejeitado ❌",
          mensagem:
            status === "aprovado"
              ? `Seu anúncio "${adInfo[0].titulo}" foi aprovado e está no ar!`
              : `Seu anúncio "${adInfo[0].titulo}" foi rejeitado. Entre em contato para mais informações.`,
          tipo: status === "aprovado" ? "aprovacao" : "rejeicao",
        });
      }
    }

    return NextResponse.json({ success: true, ad: updated });
  } catch (error) {
    console.error("Admin update ad error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
