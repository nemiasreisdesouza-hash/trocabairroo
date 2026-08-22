import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { interests, ads, users, notifications } from "@/db/schema";
import { eq, and, or, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get("tipo") || "recebidos"; // recebidos | enviados

    const conditions =
      tipo === "recebidos"
        ? eq(interests.receiverId, session.id)
        : eq(interests.senderId, session.id);

    const result = await db
      .select({
        id: interests.id,
        status: interests.status,
        createdAt: interests.createdAt,
        adId: interests.adId,
        adTitulo: ads.titulo,
        adTipo: ads.tipo,
        adCategoria: ads.categoria,
        senderId: interests.senderId,
        senderNome: users.nome,
        senderAvatar: users.avatarUrl,
        senderWhatsapp: users.whatsapp,
      })
      .from(interests)
      .innerJoin(ads, eq(interests.adId, ads.id))
      .innerJoin(users, eq(interests.senderId, users.id))
      .where(conditions)
      .orderBy(desc(interests.createdAt));

    return NextResponse.json({ interests: result });
  } catch (error) {
    console.error("Get interests error:", error);
    return NextResponse.json(
      { error: "Erro ao buscar interesses" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { adId } = body;

    if (!adId) {
      return NextResponse.json({ error: "ID do anúncio obrigatório" }, { status: 400 });
    }

    // Get ad info
    const adResult = await db
      .select({ userId: ads.userId, titulo: ads.titulo, status: ads.status })
      .from(ads)
      .where(eq(ads.id, adId))
      .limit(1);

    if (!adResult.length || adResult[0].status !== "ativo") {
      return NextResponse.json(
        { error: "Anúncio não encontrado ou inativo" },
        { status: 404 }
      );
    }

    const ad = adResult[0];

    if (ad.userId === session.id) {
      return NextResponse.json(
        { error: "Você não pode demonstrar interesse no seu próprio anúncio" },
        { status: 400 }
      );
    }

    // Check if already expressed interest
    const existing = await db
      .select({ id: interests.id })
      .from(interests)
      .where(
        and(eq(interests.adId, adId), eq(interests.senderId, session.id))
      )
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Você já demonstrou interesse neste anúncio" },
        { status: 400 }
      );
    }

    const [newInterest] = await db
      .insert(interests)
      .values({
        adId,
        senderId: session.id,
        receiverId: ad.userId,
      })
      .returning();

    // Create notification for ad owner
    await db.insert(notifications).values({
      userId: ad.userId,
      titulo: "Novo interesse no seu anúncio! 🤝",
      mensagem: `${session.nome} demonstrou interesse em "${ad.titulo}"`,
      tipo: "interesse",
      link: `/anuncio/${adId}`,
    });

    return NextResponse.json({ success: true, interest: newInterest });
  } catch (error) {
    console.error("Create interest error:", error);
    return NextResponse.json(
      { error: "Erro ao registrar interesse" },
      { status: 500 }
    );
  }
}
