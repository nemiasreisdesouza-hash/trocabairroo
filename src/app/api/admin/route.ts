import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, ads, interests, reviews, payments, reports } from "@/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const [
      totalUsers,
      totalAds,
      totalInterests,
      totalReviews,
      totalReports,
      recentUsers,
      recentAds,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(users),
      db.select({ count: sql<number>`count(*)` }).from(ads),
      db.select({ count: sql<number>`count(*)` }).from(interests),
      db.select({ count: sql<number>`count(*)` }).from(reviews),
      db
        .select({ count: sql<number>`count(*)` })
        .from(reports)
        .where(eq(reports.status, "pendente")),
      db
        .select()
        .from(users)
        .orderBy(desc(users.createdAt))
        .limit(10),
      db
        .select({
          id: ads.id,
          titulo: ads.titulo,
          status: ads.status,
          categoria: ads.categoria,
          bairro: ads.bairro,
          createdAt: ads.createdAt,
          userName: users.nome,
        })
        .from(ads)
        .innerJoin(users, eq(ads.userId, users.id))
        .orderBy(desc(ads.createdAt))
        .limit(10),
    ]);

    return NextResponse.json({
      stats: {
        users: Number(totalUsers[0]?.count || 0),
        ads: Number(totalAds[0]?.count || 0),
        interests: Number(totalInterests[0]?.count || 0),
        reviews: Number(totalReviews[0]?.count || 0),
        pendingReports: Number(totalReports[0]?.count || 0),
      },
      recentUsers,
      recentAds,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
