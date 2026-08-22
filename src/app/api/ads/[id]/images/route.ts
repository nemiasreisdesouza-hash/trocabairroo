import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ads, adImages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { uploadImage } from "@/lib/upload";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const adResult = await db
      .select({ userId: ads.userId })
      .from(ads)
      .where(eq(ads.id, id))
      .limit(1);

    if (!adResult.length || adResult[0].userId !== session.id) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    // Check existing images count
    const existingImages = await db
      .select()
      .from(adImages)
      .where(eq(adImages.adId, id));

    if (existingImages.length >= 3) {
      return NextResponse.json(
        { error: "Máximo de 3 fotos por anúncio" },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Arquivo não encontrado" },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Apenas imagens são permitidas" },
        { status: 400 }
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Arquivo muito grande. Máximo 5MB" },
        { status: 400 }
      );
    }

    const url = await uploadImage(file, "ads");

    const [newImage] = await db
      .insert(adImages)
      .values({
        adId: id,
        imageUrl: url,
        ordem: existingImages.length,
      })
      .returning();

    return NextResponse.json({ success: true, image: newImage });
  } catch (error) {
    console.error("Upload ad image error:", error);
    return NextResponse.json({ error: "Erro ao fazer upload" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get("imageId");

    if (!imageId) {
      return NextResponse.json(
        { error: "ID da imagem obrigatório" },
        { status: 400 }
      );
    }

    await db.delete(adImages).where(eq(adImages.id, imageId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete ad image error:", error);
    return NextResponse.json(
      { error: "Erro ao excluir imagem" },
      { status: 500 }
    );
  }
}
