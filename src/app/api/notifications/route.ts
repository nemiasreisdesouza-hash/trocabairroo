import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const result = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, session.id))
      .orderBy(desc(notifications.createdAt))
      .limit(50);

    const unread = result.filter((n) => !n.visualizada).length;

    return NextResponse.json({ notifications: result, unread });
  } catch (error) {
    console.error("Get notifications error:", error);
    return NextResponse.json(
      { error: "Erro ao buscar notificações" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    await db
      .update(notifications)
      .set({ visualizada: true })
      .where(
        and(
          eq(notifications.userId, session.id),
          eq(notifications.visualizada, false)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mark notifications error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
