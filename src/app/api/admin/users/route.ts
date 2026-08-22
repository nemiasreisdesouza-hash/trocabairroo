import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, desc, ilike, or, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = 20;
    const offset = (page - 1) * limit;

    const conditions = search
      ? [or(ilike(users.nome, `%${search}%`), ilike(users.email, `%${search}%`))]
      : [];

    const result = await db
      .select()
      .from(users)
      .where(conditions.length ? conditions[0] : undefined)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    const count = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(conditions.length ? conditions[0] : undefined);

    return NextResponse.json({
      users: result,
      total: Number(count[0]?.count || 0),
    });
  } catch (error) {
    console.error("Admin users error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
