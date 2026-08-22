import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { reports } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const reportSchema = z.object({
  adId: z.string().uuid(),
  motivo: z.string().min(10).max(500),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const data = reportSchema.parse(body);

    const [newReport] = await db
      .insert(reports)
      .values({
        adId: data.adId,
        reporterId: session.id,
        motivo: data.motivo,
      })
      .returning();

    return NextResponse.json({ success: true, report: newReport });
  } catch (error) {
    console.error("Create report error:", error);
    return NextResponse.json({ error: "Erro ao enviar denúncia" }, { status: 500 });
  }
}
