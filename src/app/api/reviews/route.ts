import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { reviews, users, interests, notifications } from "@/db/schema";
import { eq, and, avg, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const reviewSchema = z.object({
  avaliadoId: z.string().uuid(),
  interestId: z.string().uuid().optional(),
  nota: z.number().int().min(1).max(5),
  comentario: z.string().max(500).optional(),
  cumprimento: z.enum(["sim", "parcialmente", "nao"]),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const data = reviewSchema.parse(body);

    if (data.avaliadoId === session.id) {
      return NextResponse.json(
        { error: "Você não pode avaliar a si mesmo" },
        { status: 400 }
      );
    }

    // Check if already reviewed for this interest
    if (data.interestId) {
      const existing = await db
        .select({ id: reviews.id })
        .from(reviews)
        .where(
          and(
            eq(reviews.avaliadorId, session.id),
            eq(reviews.interestId, data.interestId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return NextResponse.json(
          { error: "Você já avaliou esta troca" },
          { status: 400 }
        );
      }
    }

    const [newReview] = await db
      .insert(reviews)
      .values({
        avaliadorId: session.id,
        avaliadoId: data.avaliadoId,
        interestId: data.interestId,
        nota: data.nota,
        comentario: data.comentario || null,
        cumprimento: data.cumprimento,
      })
      .returning();

    // Update average rating for the reviewed user
    const avgResult = await db
      .select({ avg: sql<number>`COALESCE(AVG(${reviews.nota}), 0)` })
      .from(reviews)
      .where(eq(reviews.avaliadoId, data.avaliadoId));

    const newAvg = Number(avgResult[0]?.avg || 0);

    await db
      .update(users)
      .set({ mediaAvaliacao: Math.round(newAvg * 10) / 10 })
      .where(eq(users.id, data.avaliadoId));

    // Notify reviewed user
    await db.insert(notifications).values({
      userId: data.avaliadoId,
      titulo: "Você recebeu uma avaliação! ⭐",
      mensagem: `${session.nome} te avaliou com ${data.nota} estrelas.`,
      tipo: "avaliacao",
    });

    return NextResponse.json({ success: true, review: newReview });
  } catch (error) {
    console.error("Create review error:", error);
    return NextResponse.json({ error: "Erro ao criar avaliação" }, { status: 500 });
  }
}
