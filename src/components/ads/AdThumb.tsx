"use client";

import { useState, useEffect } from "react";
import {
  Utensils,
  Scissors,
  Palette,
  GraduationCap,
  Calendar,
  Camera,
  Laptop,
  Megaphone,
  Shirt,
  Music,
  Heart,
  Home,
  ShoppingBag,
  Video,
  Store,
} from "lucide-react";

/** [P0-IMG] Valida se a URL é renderizável como <img> (data:image, https, http, blob).
 *  NUNCA retorna false para string vazia, "undefined", "null" ou blob: morto. */
export function isRenderableImageUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  if (url.length < 14) return false; // data:image/png;base64,xx = 22 mínimo
  return (
    url.startsWith("data:image/") ||
    url.startsWith("https://") ||
    url.startsWith("http://")
  );
}

/** [P0-IMG] Categoria → ícone lucide para placeholder quando sem foto válida. */
function getCategoryIcon(categoria: string) {
  const c = (categoria || "").toLowerCase();
  if (c.includes("aliment")) return Utensils;
  if (c.includes("beleza") || c.includes("estética") || c.includes("estetica")) return Scissors;
  if (c.includes("design") || c.includes("arte")) return Palette;
  if (c.includes("educa")) return GraduationCap;
  if (c.includes("evento")) return Calendar;
  if (c.includes("foto")) return Camera;
  if (c.includes("inform") || c.includes("ti") || c.includes("tecnologia")) return Laptop;
  if (c.includes("marketing")) return Megaphone;
  if (c.includes("moda") || c.includes("costura")) return Shirt;
  if (c.includes("mús") || c.includes("mus")) return Music;
  if (c.includes("saúde") || c.includes("saude") || c.includes("bem-estar")) return Heart;
  if (c.includes("doméstico") || c.includes("domestico") || c.includes("servi")) return Home;
  if (c.includes("venda") || c.includes("comérc") || c.includes("comer")) return ShoppingBag;
  if (c.includes("vídeo") || c.includes("video") || c.includes("produ")) return Video;
  return Store;
}

type AdThumbProps = {
  /** URL da imagem (data:image, https, http). NUNCA blob: efêmero. */
  url?: string | null;
  category?: string;
  className?: string;
  alt?: string;
  /** Quando true, não renderiza placeholder categoria (ex: anúncio arquivado). */
  hidePlaceholder?: boolean;
};

/**
 * [P0-IMG] Thumb à prova de BALA:
 *  - valida URL com isRenderableImageUrl (rejeita blob, undefined, vazia, <14 chars)
 *  - <img> com onError que cai em placeholder (nunca cinza)
 *  - placeholder usa ícone da categoria (igual ao seed sem foto)
 *  - re-valida quando URL muda (useEffect)
 */
export default function AdThumb({
  url,
  category,
  className = "w-full h-full object-cover",
  alt = "",
}: AdThumbProps) {
  const valid = isRenderableImageUrl(url);
  const [ok, setOk] = useState(valid);

  useEffect(() => {
    setOk(isRenderableImageUrl(url));
  }, [url]);

  // SEM URL válida OU <img> falhou ao carregar → placeholder categoria
  if (!valid || !ok) {
    const Icon = getCategoryIcon(category || "");
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-purple-100 to-purple-200 gap-2"
        role="img"
        aria-label={alt || "Sem foto"}
      >
        <Icon className="w-10 h-10 text-purple-400" />
        {category && (
          <span className="text-[10px] font-semibold text-purple-600 uppercase tracking-wider">
            {category}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => {
        // [P0-IMG] Img quebrada (DataURL corrompido, https offline) → cai em placeholder
        if (typeof window !== "undefined") {
          console.warn("[AD-IMG-PROOF] onError on <img src>", {
            prefix: url.slice(0, 30),
            len: url.length,
          });
        }
        setOk(false);
      }}
    />
  );
}
