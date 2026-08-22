import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ads, adImages } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const userAds = await db
      .select()
      .from(ads)
      .where(eq(ads.userId, session.id))
      .orderBy(desc(ads.createdAt));

    // Get images
    const adIds = userAds.map((a) => a.id);
    const imagesMap: Record<string, string[]> = {};

    if (adIds.length > 0) {
      const images = await db
        .select()
        .from(adImages)
        .where(
          sql`${adImages.adId} = ANY(${sql.raw(`ARRAY['${adIds.join("','")}']::uuid[]`)})`
        )
        .orderBy(adImages.ordem);

      images.forEach((img) => {
        if (!imagesMap[img.adId]) imagesMap[img.adId] = [];
        imagesMap[img.adId].push(img.imageUrl);
      });
    }

    const adsWithImages = userAds.map((ad) => ({
      ...ad,
      images: imagesMap[ad.id] || [],
    }));

    return NextResponse.json({ ads: adsWithImages });
  } catch (error) {
    console.error("Get my ads error:", error);
    return NextResponse.json({ error: "Erro ao buscar anúncios" }, { status: 500 });
  }
}
