import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { payments, ads, users, notifications } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { PLANOS } from "@/lib/constants";
import { z } from "zod";

const paymentSchema = z.object({
  tipoPlano: z.enum(["topo_feed", "destaque", "verificado"]),
  adId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const data = paymentSchema.parse(body);

    const plano = PLANOS.find((p) => p.id === data.tipoPlano);
    if (!plano) {
      return NextResponse.json({ error: "Plano inválido" }, { status: 400 });
    }

    // Create payment record (awaiting Mercado Pago integration)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + plano.duracao);

    const [newPayment] = await db
      .insert(payments)
      .values({
        userId: session.id,
        adId: data.adId || null,
        tipoPlano: data.tipoPlano,
        valor: plano.valor.toString(),
        status: "pendente",
        expiresAt,
      })
      .returning();

    // For now, auto-approve (Mercado Pago integration pending)
    await db
      .update(payments)
      .set({ status: "aprovado" })
      .where(eq(payments.id, newPayment.id));

    // Apply the plan
    if (data.tipoPlano === "verificado") {
      await db
        .update(users)
        .set({ verificado: true })
        .where(eq(users.id, session.id));
    } else if (data.adId) {
      if (data.tipoPlano === "destaque") {
        await db
          .update(ads)
          .set({ destaque: true })
          .where(eq(ads.id, data.adId));
      } else if (data.tipoPlano === "topo_feed") {
        await db
          .update(ads)
          .set({ topoFeed: true })
          .where(eq(ads.id, data.adId));
      }
    }

    await db.insert(notifications).values({
      userId: session.id,
      titulo: "Plano ativado! 🚀",
      mensagem: `Seu plano "${plano.nome}" foi ativado com sucesso!`,
      tipo: "pagamento",
    });

    return NextResponse.json({
      success: true,
      payment: { ...newPayment, status: "aprovado" },
    });
  } catch (error) {
    console.error("Payment error:", error);
    return NextResponse.json({ error: "Erro ao processar pagamento" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const result = await db
      .select()
      .from(payments)
      .where(eq(payments.userId, session.id))
      .orderBy(desc(payments.createdAt));

    return NextResponse.json({ payments: result });
  } catch (error) {
    console.error("Get payments error:", error);
    return NextResponse.json({ error: "Erro ao buscar pagamentos" }, { status: 500 });
  }
}
