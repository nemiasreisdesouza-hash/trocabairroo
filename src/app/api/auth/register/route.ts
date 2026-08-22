import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, neighborhoods, notifications } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, createSession, setSessionCookie } from "@/lib/auth";
import { z } from "zod";

const registerSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  senha: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  whatsapp: z.string().min(10, "WhatsApp inválido"),
  tipoPerfil: z.enum(["empreendedor", "criador", "ambos"]),
  bairro: z.string().min(1, "Bairro obrigatório"),
  categorias: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = registerSchema.parse(body);

    // Check existing email
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, data.email.toLowerCase()))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Este email já está cadastrado" },
        { status: 400 }
      );
    }

    // Find or create neighborhood
    let neighborhoodId: string | undefined;
    const existingNeighborhood = await db
      .select()
      .from(neighborhoods)
      .where(eq(neighborhoods.nome, data.bairro))
      .limit(1);

    if (existingNeighborhood.length > 0) {
      neighborhoodId = existingNeighborhood[0].id;
    }

    const hashedPassword = await hashPassword(data.senha);

    const [newUser] = await db
      .insert(users)
      .values({
        nome: data.nome.trim(),
        email: data.email.toLowerCase().trim(),
        senha: hashedPassword,
        whatsapp: data.whatsapp.replace(/\D/g, ""),
        tipoPerfil: data.tipoPerfil,
        bairro: data.bairro,
        neighborhoodId,
        categorias: data.categorias || [],
      })
      .returning();

    // Welcome notification
    await db.insert(notifications).values({
      userId: newUser.id,
      titulo: "Bem-vindo ao TrocaBairro! 🎉",
      mensagem:
        "Sua conta foi criada com sucesso. Publique seu primeiro anúncio e comece a trocar!",
      tipo: "boas_vindas",
    });

    const token = await createSession(newUser.id);
    await setSessionCookie(token);

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        nome: newUser.nome,
        email: newUser.email,
        tipoPerfil: newUser.tipoPerfil,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues ?? [];
      return NextResponse.json(
        { error: issues[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      );
    }
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Erro ao criar conta. Tente novamente." },
      { status: 500 }
    );
  }
}
