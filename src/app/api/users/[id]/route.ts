import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, ads, reviews, adImages } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { z } from "zod";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const userResult = await db
      .select({
        id: users.id,
        nome: users.nome,
        bio: users.bio,
        avatarUrl: users.avatarUrl,
        bairro: users.bairro,
        tipoPerfil: users.tipoPerfil,
        categorias: users.categorias,
        mediaAvaliacao: users.mediaAvaliacao,
        trocasConcluidas: users.trocasConcluidas,
        verificado: users.verificado,
        createdAt: users.createdAt,
        whatsapp: users.whatsapp,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!userResult.length) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    const user = userResult[0];

    // Get user ads
    const userAds = await db
      .select({
        id: ads.id,
        tipo: ads.tipo,
        titulo: ads.titulo,
        categoria: ads.categoria,
        bairro: ads.bairro,
        aceitaEmTroca: ads.aceitaEmTroca,
        destaque: ads.destaque,
        status: ads.status,
        visualizacoes: ads.visualizacoes,
        createdAt: ads.createdAt,
      })
      .from(ads)
      .where(eq(ads.userId, id))
      .orderBy(desc(ads.createdAt))
      .limit(10);

    // Get first image for each ad
    const adIds = userAds.map((a) => a.id);
    const imagesMap: Record<string, string> = {};
    if (adIds.length > 0) {
      const images = await db
        .select({ adId: adImages.adId, imageUrl: adImages.imageUrl })
        .from(adImages)
        .where(
          sql`${adImages.adId} = ANY(${sql.raw(`ARRAY['${adIds.join("','")}']::uuid[]`)})`
        )
        .orderBy(adImages.ordem);
      images.forEach((img) => {
        if (!imagesMap[img.adId]) imagesMap[img.adId] = img.imageUrl;
      });
    }

    // Get recent reviews
    const userReviews = await db
      .select({
        id: reviews.id,
        nota: reviews.nota,
        comentario: reviews.comentario,
        cumprimento: reviews.cumprimento,
        createdAt: reviews.createdAt,
        avaliadorId: reviews.avaliadorId,
        avaliadorNome: users.nome,
        avaliadorAvatar: users.avatarUrl,
      })
      .from(reviews)
      .innerJoin(users, eq(reviews.avaliadorId, users.id))
      .where(eq(reviews.avaliadoId, id))
      .orderBy(desc(reviews.createdAt))
      .limit(10);

    // Count reviews
    const reviewCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(reviews)
      .where(eq(reviews.avaliadoId, id));

    return NextResponse.json({
      user: {
        ...user,
        reviewCount: Number(reviewCount[0]?.count || 0),
      },
      ads: userAds.map((a) => ({ ...a, imageUrl: imagesMap[a.id] || null })),
      reviews: userReviews,
    });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json({ error: "Erro ao buscar usuário" }, { status: 500 });
  }
}

const updateUserSchema = z.object({
  nome: z.string().min(2).optional(),
  bio: z.string().max(500).optional(),
  whatsapp: z.string().optional(),
  bairro: z.string().optional(),
  tipoPerfil: z.enum(["empreendedor", "criador", "ambos"]).optional(),
  categorias: z.array(z.string()).optional(),
  avatarUrl: z.string().optional(),
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

    if (session.id !== id && session.role !== "admin") {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const body = await request.json();
    const data = updateUserSchema.parse(body);

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.nome) updateData.nome = data.nome;
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.whatsapp) updateData.whatsapp = data.whatsapp.replace(/\D/g, "");
    if (data.bairro) updateData.bairro = data.bairro;
    if (data.tipoPerfil) updateData.tipoPerfil = data.tipoPerfil;
    if (data.categorias) updateData.categorias = data.categorias;
    if (data.avatarUrl) updateData.avatarUrl = data.avatarUrl;

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json({ error: "Erro ao atualizar perfil" }, { status: 500 });
  }
}
