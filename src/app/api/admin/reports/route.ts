import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { reports, ads, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const result = await db
      .select({
        id: reports.id,
        motivo: reports.motivo,
        status: reports.status,
        createdAt: reports.createdAt,
        adId: reports.adId,
        adTitulo: ads.titulo,
        reporterId: reports.reporterId,
        reporterNome: users.nome,
      })
      .from(reports)
      .innerJoin(ads, eq(reports.adId, ads.id))
      .innerJoin(users, eq(reports.reporterId, users.id))
      .orderBy(desc(reports.createdAt));

    return NextResponse.json({ reports: result });
  } catch (error) {
    console.error("Admin reports error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const body = await request.json();
    const { reportId, status } = body;

    await db
      .update(reports)
      .set({ status })
      .where(eq(reports.id, reportId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin update report error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
