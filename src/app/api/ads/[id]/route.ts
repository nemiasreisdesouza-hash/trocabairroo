import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ads, adImages, users, reviews, interests } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { z } from "zod";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const adResult = await db
      .select({
        id: ads.id,
        userId: ads.userId,
        tipo: ads.tipo,
        titulo: ads.titulo,
        descricao: ads.descricao,
        categoria: ads.categoria,
        bairro: ads.bairro,
        aceitaEmTroca: ads.aceitaEmTroca,
        destaque: ads.destaque,
        topoFeed: ads.topoFeed,
        status: ads.status,
        visualizacoes: ads.visualizacoes,
        createdAt: ads.createdAt,
        updatedAt: ads.updatedAt,
        userName: users.nome,
        userAvatar: users.avatarUrl,
        userWhatsapp: users.whatsapp,
        userBio: users.bio,
        userBairro: users.bairro,
        userMediaAvaliacao: users.mediaAvaliacao,
        userTrocasConcluidas: users.trocasConcluidas,
        userVerificado: users.verificado,
        userTipoPerfil: users.tipoPerfil,
      })
      .from(ads)
      .innerJoin(users, eq(ads.userId, users.id))
      .where(eq(ads.id, id))
      .limit(1);

    if (!adResult.length) {
      return NextResponse.json({ error: "Anúncio não encontrado" }, { status: 404 });
    }

    const ad = adResult[0];

    // Get images
    const images = await db
      .select()
      .from(adImages)
      .where(eq(adImages.adId, id))
      .orderBy(adImages.ordem);

    // Get reviews for user
    const userReviews = await db
      .select({
        id: reviews.id,
        nota: reviews.nota,
        comentario: reviews.comentario,
        cumprimento: reviews.cumprimento,
        createdAt: reviews.createdAt,
        avaliadorNome: users.nome,
        avaliadorAvatar: users.avatarUrl,
      })
      .from(reviews)
      .innerJoin(users, eq(reviews.avaliadorId, users.id))
      .where(eq(reviews.avaliadoId, ad.userId))
      .orderBy(desc(reviews.createdAt))
      .limit(5);

    // Count interests
    const interestCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(interests)
      .where(eq(interests.adId, id));

    // Increment views
    await db
      .update(ads)
      .set({ visualizacoes: sql`${ads.visualizacoes} + 1` })
      .where(eq(ads.id, id));

    return NextResponse.json({
      ...ad,
      images: images.map((img) => img.imageUrl),
      reviews: userReviews,
      interestCount: Number(interestCount[0]?.count || 0),
    });
  } catch (error) {
    console.error("Get ad error:", error);
    return NextResponse.json({ error: "Erro ao buscar anúncio" }, { status: 500 });
  }
}

const updateAdSchema = z.object({
  titulo: z.string().min(5).max(255).optional(),
  descricao: z.string().min(20).optional(),
  categoria: z.string().optional(),
  bairro: z.string().optional(),
  aceitaEmTroca: z.string().optional(),
  status: z.enum(["ativo", "pausado"]).optional(),
});

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

    const adResult = await db
      .select({ userId: ads.userId })
      .from(ads)
      .where(eq(ads.id, id))
      .limit(1);

    if (!adResult.length) {
      return NextResponse.json({ error: "Anúncio não encontrado" }, { status: 404 });
    }

    if (adResult[0].userId !== session.id && session.role !== "admin") {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const body = await request.json();
    const data = updateAdSchema.parse(body);

    const [updated] = await db
      .update(ads)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(ads.id, id))
      .returning();

    return NextResponse.json({ success: true, ad: updated });
  } catch (error) {
    console.error("Update ad error:", error);
    return NextResponse.json({ error: "Erro ao atualizar anúncio" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const adResult = await db
      .select({ userId: ads.userId })
      .from(ads)
      .where(eq(ads.id, id))
      .limit(1);

    if (!adResult.length) {
      return NextResponse.json({ error: "Anúncio não encontrado" }, { status: 404 });
    }

    if (adResult[0].userId !== session.id && session.role !== "admin") {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    await db.delete(ads).where(eq(ads.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete ad error:", error);
    return NextResponse.json({ error: "Erro ao excluir anúncio" }, { status: 500 });
  }
}
