import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ads, users } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = 20;
    const offset = (page - 1) * limit;

    const conditions = status
      ? [
          eq(
            ads.status,
            status as "pendente" | "aprovado" | "rejeitado" | "pausado" | "ativo"
          ),
        ]
      : [];

    const result = await db
      .select({
        id: ads.id,
        tipo: ads.tipo,
        titulo: ads.titulo,
        categoria: ads.categoria,
        bairro: ads.bairro,
        status: ads.status,
        destaque: ads.destaque,
        visualizacoes: ads.visualizacoes,
        createdAt: ads.createdAt,
        userName: users.nome,
        userEmail: users.email,
        userId: ads.userId,
      })
      .from(ads)
      .innerJoin(users, eq(ads.userId, users.id))
      .where(conditions.length ? conditions[0] : undefined)
      .orderBy(desc(ads.createdAt))
      .limit(limit)
      .offset(offset);

    const count = await db
      .select({ count: sql<number>`count(*)` })
      .from(ads)
      .where(conditions.length ? conditions[0] : undefined);

    return NextResponse.json({
      ads: result,
      total: Number(count[0]?.count || 0),
    });
  } catch (error) {
    console.error("Admin ads error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
