import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { interests, users, notifications } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { status } = body;

    if (!["aceito", "concluido", "cancelado"].includes(status)) {
      return NextResponse.json({ error: "Status inválido" }, { status: 400 });
    }

    const interestResult = await db
      .select()
      .from(interests)
      .where(eq(interests.id, id))
      .limit(1);

    if (!interestResult.length) {
      return NextResponse.json(
        { error: "Interesse não encontrado" },
        { status: 404 }
      );
    }

    const interest = interestResult[0];

    if (
      interest.receiverId !== session.id &&
      interest.senderId !== session.id
    ) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const [updated] = await db
      .update(interests)
      .set({ status: status as "aceito" | "concluido" | "cancelado", updatedAt: new Date() })
      .where(eq(interests.id, id))
      .returning();

    // If concluded, increment trocas_concluidas for both users
    if (status === "concluido") {
      await db
        .update(users)
        .set({ trocasConcluidas: sql`${users.trocasConcluidas} + 1` })
        .where(eq(users.id, interest.senderId));

      await db
        .update(users)
        .set({ trocasConcluidas: sql`${users.trocasConcluidas} + 1` })
        .where(eq(users.id, interest.receiverId));

      // Notify both to leave review
      await db.insert(notifications).values([
        {
          userId: interest.senderId,
          titulo: "Troca concluída! Avalie o parceiro 🌟",
          mensagem: "Como foi a experiência? Deixe uma avaliação.",
          tipo: "avaliacao",
          link: `/avaliar/${id}`,
        },
        {
          userId: interest.receiverId,
          titulo: "Troca concluída! Avalie o parceiro 🌟",
          mensagem: "Como foi a experiência? Deixe uma avaliação.",
          tipo: "avaliacao",
          link: `/avaliar/${id}`,
        },
      ]);
    }

    return NextResponse.json({ success: true, interest: updated });
  } catch (error) {
    console.error("Update interest error:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar interesse" },
      { status: 500 }
    );
  }
}
