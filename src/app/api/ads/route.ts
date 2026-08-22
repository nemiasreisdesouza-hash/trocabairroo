import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ads, adImages, users, reviews } from "@/db/schema";
import { eq, desc, ilike, and, or, sql, avg } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { z } from "zod";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const categoria = searchParams.get("categoria") || "";
    const bairro = searchParams.get("bairro") || "";
    const tipo = searchParams.get("tipo") || "";
    const ordenacao = searchParams.get("ordenacao") || "recentes";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "12");
    const offset = (page - 1) * limit;

    const conditions = [eq(ads.status, "ativo")];

    if (search) {
      conditions.push(
        or(
          ilike(ads.titulo, `%${search}%`),
          ilike(ads.descricao, `%${search}%`)
        )!
      );
    }

    if (categoria) {
      conditions.push(eq(ads.categoria, categoria));
    }

    if (bairro) {
      conditions.push(ilike(ads.bairro, `%${bairro}%`));
    }

    if (tipo && (tipo === "ofereço" || tipo === "preciso")) {
      conditions.push(eq(ads.tipo, tipo as "ofereço" | "preciso"));
    }

    let orderBy;
    switch (ordenacao) {
      case "destaque":
        orderBy = [desc(ads.destaque), desc(ads.createdAt)];
        break;
      case "topo":
        orderBy = [desc(ads.topoFeed), desc(ads.createdAt)];
        break;
      case "populares":
        orderBy = [desc(ads.visualizacoes), desc(ads.createdAt)];
        break;
      default:
        orderBy = [desc(ads.topoFeed), desc(ads.destaque), desc(ads.createdAt)];
    }

    const result = await db
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
        visualizacoes: ads.visualizacoes,
        createdAt: ads.createdAt,
        userName: users.nome,
        userAvatar: users.avatarUrl,
        userWhatsapp: users.whatsapp,
        userMediaAvaliacao: users.mediaAvaliacao,
        userTrocasConcluidas: users.trocasConcluidas,
        userVerificado: users.verificado,
      })
      .from(ads)
      .innerJoin(users, eq(ads.userId, users.id))
      .where(and(...conditions))
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset);

    // Get images for each ad
    const adIds = result.map((ad) => ad.id);
    let imagesMap: Record<string, string[]> = {};

    if (adIds.length > 0) {
      const images = await db
        .select()
        .from(adImages)
        .where(
          sql`${adImages.adId} = ANY(${sql.raw(`ARRAY['${adIds.join("','")}']::uuid[]`)})`
        )
        .orderBy(adImages.ordem);

      images.forEach((img) => {
        if (!imagesMap[img.adId]) imagesMap[img.adId] = [];
        imagesMap[img.adId].push(img.imageUrl);
      });
    }

    const adsWithImages = result.map((ad) => ({
      ...ad,
      images: imagesMap[ad.id] || [],
    }));

    // Count total
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(ads)
      .innerJoin(users, eq(ads.userId, users.id))
      .where(and(...conditions));

    const total = Number(countResult[0]?.count || 0);

    return NextResponse.json({
      ads: adsWithImages,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get ads error:", error);
    return NextResponse.json({ error: "Erro ao buscar anúncios" }, { status: 500 });
  }
}

const createAdSchema = z.object({
  tipo: z.enum(["ofereço", "preciso"]),
  titulo: z.string().min(5).max(255),
  descricao: z.string().min(20),
  categoria: z.string().min(1),
  bairro: z.string().min(1),
  aceitaEmTroca: z.string().min(5),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const data = createAdSchema.parse(body);

    const [newAd] = await db
      .insert(ads)
      .values({
        userId: session.id,
        tipo: data.tipo,
        titulo: data.titulo.trim(),
        descricao: data.descricao.trim(),
        categoria: data.categoria,
        bairro: data.bairro,
        aceitaEmTroca: data.aceitaEmTroca.trim(),
        status: "ativo",
      })
      .returning();

    return NextResponse.json({ success: true, ad: newAd });
  } catch (error) {
    console.error("Create ad error:", error);
    return NextResponse.json({ error: "Erro ao criar anúncio" }, { status: 500 });
  }
}
